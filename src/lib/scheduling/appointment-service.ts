import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { RescheduleAppointmentInput, UpdateAppointmentStatusInput, CreateAppointmentInput } from "@/lib/validation/scheduling-schemas";
import { detectAppointmentConflicts } from "./detect-conflicts";

/**
 * Reschedules an appointment in place and returns it to PLANNED status (AC-06).
 */
export async function rescheduleAppointment(
  supabase: SupabaseClient<Database>,
  input: RescheduleAppointmentInput,
  actorUserId?: string
) {
  // Fetch existing appointment to get patient & course IDs, and current status
  const { data: existing, error: fetchError } = await supabase
    .from("appointments")
    .select("id, patient_id, treatment_course_id, doctor_id, appointment_date, scheduled_start_at, status")
    .eq("id", input.appointment_id)
    .single();

  if (fetchError || !existing) {
    throw new Error("Appointment not found.");
  }

  const typedExisting = existing as unknown as {
    id: string;
    patient_id: string;
    treatment_course_id: string;
    doctor_id: string | null;
    status: string;
  };

  // Validate allowed source statuses for rescheduling (must be pre-clinical / unstarted)
  const ALLOWED_RESCHEDULE_SOURCE_STATUSES = ["PLANNED", "CONFIRMED", "RESCHEDULED"];
  if (!ALLOWED_RESCHEDULE_SOURCE_STATUSES.includes(typedExisting.status)) {
    throw new Error(
      `Không thể đổi lịch cho lịch hẹn ở trạng thái ${typedExisting.status}. Chỉ cho phép đổi lịch các lịch hẹn chưa khám/trị liệu.`
    );
  }

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
      status: "PLANNED",
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
  actorStaffId?: string,
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

  const nowIso = new Date().toISOString();
  const updatePayload: Database["public"]["Tables"]["appointments"]["Update"] = {
    status: input.status,
    notes: input.notes !== undefined ? input.notes : null,
    updated_at: nowIso,
  };

  // Stamp specific transition timestamp and provenance actor
  if (input.status === "CHECKED_IN") {
    updatePayload.checked_in_at = nowIso;
    if (actorStaffId) updatePayload.checked_in_by = actorStaffId;
  } else if (input.status === "IN_TREATMENT") {
    updatePayload.started_at = nowIso;
    if (actorStaffId) updatePayload.started_by = actorStaffId;
  } else if (input.status === "NO_SHOW") {
    updatePayload.no_show_at = nowIso;
    if (actorStaffId) updatePayload.no_show_by = actorStaffId;
  } else if (input.status === "CANCELLED") {
    updatePayload.cancelled_at = nowIso;
    if (actorStaffId) updatePayload.cancelled_by = actorStaffId;
  }

  const { data: updated, error: updateError } = await supabase
    .from("appointments")
    .update(updatePayload)
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
