import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export interface ConflictCheckParams {
  patient_id: string;
  treatment_course_id: string;
  doctor_id?: string | null;
  appointment_date: string; // YYYY-MM-DD
  scheduled_start_at: string; // ISO timestamptz
  scheduled_end_at?: string | null;
  exclude_appointment_id?: string; // when rescheduling an existing appointment
}

export interface ConflictCheckResult {
  has_conflict: boolean;
  reasons: string[];
}

export async function detectAppointmentConflicts(
  supabase: SupabaseClient<Database>,
  params: ConflictCheckParams
): Promise<ConflictCheckResult> {
  const reasons: string[] = [];

  // 1. Check if patient already has another appointment on the same date
  let patientQuery = supabase
    .from("appointments")
    .select("id, status, scheduled_start_at")
    .eq("patient_id", params.patient_id)
    .eq("appointment_date", params.appointment_date)
    .neq("status", "CANCELLED");

  if (params.exclude_appointment_id) {
    patientQuery = patientQuery.neq("id", params.exclude_appointment_id);
  }

  const { data: patientAppts } = await patientQuery;
  if (patientAppts && patientAppts.length > 0) {
    reasons.push(
      `Bệnh nhân đã có lịch hẹn vào ngày ${params.appointment_date}.`
    );
  }

  // 2. Check if course already has an appointment on this date (AC-05)
  let courseQuery = supabase
    .from("appointments")
    .select("id, status")
    .eq("treatment_course_id", params.treatment_course_id)
    .eq("appointment_date", params.appointment_date)
    .neq("status", "CANCELLED");

  if (params.exclude_appointment_id) {
    courseQuery = courseQuery.neq("id", params.exclude_appointment_id);
  }

  const { data: courseAppts } = await courseQuery;
  if (courseAppts && courseAppts.length > 0) {
    reasons.push(
      `Liệu trình này đã có lịch hẹn vào ngày ${params.appointment_date}.`
    );
  }

  // 3. Check doctor load on that date
  if (params.doctor_id) {
    const { count: doctorDailyCount } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", params.doctor_id)
      .eq("appointment_date", params.appointment_date)
      .neq("status", "CANCELLED");

    // Fetch max capacity
    const { data: settings } = await supabase
      .from("scheduling_settings")
      .select("max_daily_patients_per_doctor")
      .limit(1)
      .maybeSingle();

    const maxPatients = settings?.max_daily_patients_per_doctor ?? 64;
    if (doctorDailyCount && doctorDailyCount >= maxPatients) {
      reasons.push(
        `Bác sĩ đã đạt công suất tối đa trong ngày (${doctorDailyCount}/${maxPatients} bệnh nhân).`
      );
    }
  }

  return {
    has_conflict: reasons.length > 0,
    reasons,
  };
}
