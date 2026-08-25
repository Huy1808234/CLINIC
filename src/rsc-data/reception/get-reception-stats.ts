import "server-only";
import { createClient } from "@/supabase-clients/server";
import { getActiveClinicContext } from "@/lib/auth/clinic-context";
import { getClinicTodayDate, getUtcBoundsForClinicDate, DEFAULT_CLINIC_TIMEZONE } from "@/utils/timezone";
import type { ReceptionStats } from "@/types/reception";

export async function getReceptionStats(targetDate?: string): Promise<ReceptionStats> {
  const supabase = await createClient();
  const clinicContext = await getActiveClinicContext();
  const clinicId = clinicContext?.id;
  const timeZone = clinicContext?.timezone || DEFAULT_CLINIC_TIMEZONE;

  const todayDateStr = targetDate || getClinicTodayDate(timeZone);
  const { startUtc, endUtc } = getUtcBoundsForClinicDate(todayDateStr, timeZone);

  let query = supabase
    .from("receptions")
    .select("patient_relation_type")
    .gte("arrived_at", startUtc)
    .lt("arrived_at", endUtc);

  if (clinicId) {
    query = query.eq("clinic_id", clinicId);
  }

  const { data: todayReceptions } = await query;

  const records = todayReceptions || [];
  const total = records.length;
  const newPatients = records.filter((r) => r.patient_relation_type === "NEW").length;
  const returningPatients = records.filter((r) => r.patient_relation_type === "RETURNING").length;

  // Active appointments today count
  const { data: todayAppts } = await supabase
    .from("appointments")
    .select("status")
    .eq("appointment_date", todayDateStr);

  const appts = todayAppts || [];
  const waitingExam = appts.filter((a) => a.status === "CHECKED_IN" || a.status === "PLANNED").length;
  const inTreatment = appts.filter((a) => a.status === "IN_TREATMENT" || a.status === "IN_EXAM").length;
  const completed = appts.filter((a) => a.status === "COMPLETED").length;

  return {
    total_today: total,
    new_patients_today: newPatients,
    returning_patients_today: returningPatients,
    waiting_exam_count: waitingExam,
    in_treatment_count: inTreatment,
    completed_today: completed,
  };
}
