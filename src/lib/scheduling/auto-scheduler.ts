import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { AutoScheduleInput, AutoScheduleResult } from "@/types/schedule";
import { autoScheduleSchema } from "@/lib/validation/scheduling-schemas";
import { generateTreatmentDates } from "./scheduling-rules";
import { detectAppointmentConflicts } from "./detect-conflicts";

export async function executeAutoSchedule(
  supabase: SupabaseClient<Database>,
  input: AutoScheduleInput,
  actorUserId?: string
): Promise<AutoScheduleResult> {
  const validated = autoScheduleSchema.parse(input);

  // 1. Try to invoke atomic Supabase RPC if database functions are configured
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc("schedule_treatment_course", {
      p_course_id: validated.treatment_course_id,
      p_doctor_id: validated.doctor_id,
      p_start_date: validated.start_date,
      p_session_count: validated.planned_session_count,
      p_preferred_time: validated.preferred_time || "07:30:00",
      p_selected_weekdays: validated.selected_weekdays,
    });

    if (!rpcError && rpcData) {
      const res = rpcData as {
        success: boolean;
        status: "FULL" | "PARTIAL" | "FAILED";
        scheduled_count: number;
        requested_count: number;
        appointment_ids: string[];
      };
      if (res.success) {
        return {
          success: true,
          status: res.status,
          scheduled_count: res.scheduled_count,
          requested_count: res.requested_count,
          appointment_ids: res.appointment_ids || [],
          message: `Xếp lịch tự động thành công (${res.scheduled_count}/${res.requested_count} buổi).`,
        };
      }
    }
  } catch {
    // Fallback to client-orchestrated transaction
  }

  // 2. TypeScript Fallback Scheduler
  // Fetch patient id for this treatment course
  const { data: course } = await supabase
    .from("treatment_courses")
    .select("patient_id, course_no")
    .eq("id", validated.treatment_course_id)
    .single();

  if (!course) {
    return {
      success: false,
      status: "FAILED",
      scheduled_count: 0,
      requested_count: validated.planned_session_count,
      appointment_ids: [],
      message: "Không tìm thấy liệu trình điều trị.",
    };
  }

  const patientId = (course as unknown as { patient_id: string }).patient_id;

  // Generate treatment dates
  const treatmentDates = generateTreatmentDates({
    startDate: validated.start_date,
    sessionCount: validated.planned_session_count,
    allowedWeekdays: validated.selected_weekdays,
  });

  const createdIds: string[] = [];
  const unscheduledDates: string[] = [];
  const targetTime = validated.preferred_time || "07:30";

  for (let i = 0; i < treatmentDates.length; i++) {
    const apptDate = treatmentDates[i];
    const scheduledStartAt = `${apptDate}T${targetTime}:00+07:00`;

    // Check conflict
    const conflict = await detectAppointmentConflicts(supabase, {
      patient_id: patientId,
      treatment_course_id: validated.treatment_course_id,
      doctor_id: validated.doctor_id,
      appointment_date: apptDate,
      scheduled_start_at: scheduledStartAt,
    });

    if (conflict.has_conflict) {
      unscheduledDates.push(apptDate);
      continue;
    }

    // Insert appointment
    const { data: inserted, error: insertError } = await supabase
      .from("appointments")
      .insert({
        patient_id: patientId,
        treatment_course_id: validated.treatment_course_id,
        doctor_id: validated.doctor_id,
        appointment_date: apptDate,
        scheduled_start_at: scheduledStartAt,
        status: "PLANNED",
        schedule_source: "AUTO",
        sequence_in_day: i + 1,
        priority: 0,
        manual_override: false,
      })
      .select("id")
      .single();

    if (!insertError && inserted) {
      createdIds.push((inserted as unknown as { id: string }).id);
    } else {
      unscheduledDates.push(apptDate);
    }
  }

  // Update treatment course doctor and planned count
  await supabase
    .from("treatment_courses")
    .update({
      primary_doctor_id: validated.doctor_id,
      planned_session_count: validated.planned_session_count,
    })
    .eq("id", validated.treatment_course_id);

  // Record audit log
  await supabase.from("audit_logs").insert({
    actor_user_id: actorUserId || null,
    action: "AUTO_SCHEDULE_TREATMENT_COURSE",
    entity_type: "TREATMENT_COURSE",
    entity_id: validated.treatment_course_id,
    after_data: {
      scheduled_count: createdIds.length,
      requested_count: validated.planned_session_count,
      appointment_ids: createdIds,
    },
  });

  const isFull = createdIds.length === validated.planned_session_count;
  return {
    success: createdIds.length > 0,
    status: isFull ? "FULL" : createdIds.length > 0 ? "PARTIAL" : "FAILED",
    scheduled_count: createdIds.length,
    requested_count: validated.planned_session_count,
    appointment_ids: createdIds,
    unscheduled_dates: unscheduledDates,
    message: isFull
      ? `Đã xếp đủ ${createdIds.length} buổi vào bảng giờ.`
      : `Đã xếp ${createdIds.length}/${validated.planned_session_count} buổi (có ngày bị trùng lịch).`,
  };
}
