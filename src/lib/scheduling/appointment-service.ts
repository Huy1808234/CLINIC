import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { RescheduleAppointmentInput, UpdateAppointmentStatusInput, CreateAppointmentInput } from "@/lib/validation/scheduling-schemas";
import { detectAppointmentConflicts } from "./detect-conflicts";

/**
 * Reschedules an appointment and flags it as manual_override = true (AC-06)
 */
export async function rescheduleAppointment(
  supabase: SupabaseClient<Database>,
  input: RescheduleAppointmentInput,
  actorUserId?: string
) {
  // Fetch existing appointment to get patient & course IDs
  const { data: existing, error: fetchError } = await supabase
    .from("appointments")
    .select("patient_id, treatment_course_id, doctor_id, appointment_date, scheduled_start_at")
    .eq("id", input.appointment_id)
    .single();

  if (fetchError || !existing) {
    throw new Error("Appointment not found.");
  }

  const typedExisting = existing as unknown as {
    patient_id: string;
    treatment_course_id: string;
    doctor_id: string | null;
  };

  const targetDoctorId = input.new_doctor_id !== undefined ? input.new_doctor_id : typedExisting.doctor_id;

  // Check for conflicts
  const conflict = await detectAppointmentConflicts(supabase, {
    patient_id: typedExisting.patient_id,
    treatment_course_id: typedExisting.treatment_course_id,
    doctor_id: targetDoctorId,
    appointment_date: input.new_date,
    scheduled_start_at: input.new_start_at,
    exclude_appointment_id: input.appointment_id,
  });

  if (conflict.has_conflict) {
    throw new Error(`Xung đột lịch hẹn: ${conflict.reasons.join(", ")}`);
  }

  const { data: updated, error: updateError } = await supabase
    .from("appointments")
    .update({
      appointment_date: input.new_date,
      scheduled_start_at: input.new_start_at,
      doctor_id: targetDoctorId,
      manual_override: input.manual_override ?? true,
      notes: input.notes !== undefined ? input.notes : null,
      status: "RESCHEDULED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.appointment_id)
    .select()
    .single();

  if (updateError || !updated) {
    throw new Error(`Failed to reschedule: ${updateError?.message}`);
  }

  // Audit log
  await supabase.from("audit_logs").insert({
    actor_user_id: actorUserId || null,
    action: "RESCHEDULE_APPOINTMENT",
    entity_type: "APPOINTMENT",
    entity_id: input.appointment_id,
    before_data: JSON.parse(JSON.stringify(existing)),
    after_data: JSON.parse(JSON.stringify(updated)),
  });

  return updated;
}

/**
 * Updates non-completion appointment status (e.g. CHECKED_IN, IN_TREATMENT, NO_SHOW, CANCELLED).
 * Clinical appointment completion (COMPLETED) MUST use complete_appointment_treatment_session RPC.
 */
export async function updateAppointmentStatus(
  supabase: SupabaseClient<Database>,
  input: UpdateAppointmentStatusInput,
  actorUserId?: string
) {
  if (input.status === "COMPLETED") {
    throw new Error(
      "ATOMIC_COMPLETION_REQUIRED: Clinical appointment completion must use complete_appointment_treatment_session RPC."
    );
  }

  const { data: existing, error: fetchError } = await supabase
    .from("appointments")
    .select("*, treatment_courses(*)")
    .eq("id", input.appointment_id)
    .single();

  if (fetchError || !existing) {
    throw new Error("Appointment not found.");
  }

  const { data: updated, error: updateError } = await supabase
    .from("appointments")
    .update({
      status: input.status,
      notes: input.notes !== undefined ? input.notes : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.appointment_id)
    .select()
    .single();

  if (updateError || !updated) {
    throw new Error(`Failed to update appointment status: ${updateError?.message}`);
  }

  // Audit log for non-completion status changes
  await supabase.from("audit_logs").insert({
    actor_user_id: actorUserId || null,
    action: `APPOINTMENT_STATUS_${input.status}`,
    entity_type: "APPOINTMENT",
    entity_id: input.appointment_id,
    before_data: JSON.parse(JSON.stringify(existing)),
    after_data: JSON.parse(JSON.stringify(updated)),
  });

  return updated;
}

/**
 * Creates single manual appointment
 */
export async function createManualAppointment(
  supabase: SupabaseClient<Database>,
  input: CreateAppointmentInput,
  actorUserId?: string
) {
  const conflict = await detectAppointmentConflicts(supabase, {
    patient_id: input.patient_id,
    treatment_course_id: input.treatment_course_id,
    doctor_id: input.doctor_id,
    appointment_date: input.appointment_date,
    scheduled_start_at: input.scheduled_start_at,
  });

  if (conflict.has_conflict) {
    throw new Error(`Xung đột lịch hẹn: ${conflict.reasons.join(", ")}`);
  }

  const { data: created, error } = await supabase
    .from("appointments")
    .insert({
      patient_id: input.patient_id,
      treatment_course_id: input.treatment_course_id,
      doctor_id: input.doctor_id || null,
      appointment_date: input.appointment_date,
      scheduled_start_at: input.scheduled_start_at,
      status: "PLANNED",
      schedule_source: "MANUAL",
      manual_override: true,
      notes: input.notes || null,
    })
    .select()
    .single();

  if (error || !created) {
    throw new Error(`Failed to create manual appointment: ${error?.message}`);
  }

  // Audit log
  await supabase.from("audit_logs").insert({
    actor_user_id: actorUserId || null,
    action: "CREATE_MANUAL_APPOINTMENT",
    entity_type: "APPOINTMENT",
    entity_id: created.id,
    after_data: JSON.parse(JSON.stringify(created)),
  });

  return created;
}
