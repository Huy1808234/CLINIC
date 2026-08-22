import "server-only";
import { createClient } from "@/supabase-clients/server";
import type { ReceptionQueueItem, ReceptionEncounter } from "@/types/reception";
import type { PatientProfile, Patient, PatientInsuranceCard } from "@/types/patient";

export async function getTodayReceptions(): Promise<ReceptionQueueItem[]> {
  const supabase = await createClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: receptions, error } = await supabase
    .from("receptions")
    .select("*")
    .gte("arrived_at", todayStart.toISOString())
    .order("arrived_at", { ascending: false });

  if (error || !receptions) {
    return [];
  }

  const patientIds = receptions.map((r) => r.patient_id);
  if (patientIds.length === 0) return [];

  // Fetch patients
  const { data: patients } = await supabase
    .from("patients")
    .select("*")
    .in("id", patientIds);

  // Fetch active insurance cards
  const { data: insurances } = await supabase
    .from("patient_insurance_cards")
    .select("*")
    .in("patient_id", patientIds)
    .eq("is_current", true);

  // Fetch active treatment courses
  const { data: courses } = await supabase
    .from("treatment_courses")
    .select(`
      id,
      patient_id,
      course_no,
      planned_session_count,
      completed_session_count,
      status,
      staff:primary_doctor_id(full_name)
    `)
    .in("patient_id", patientIds)
    .eq("status", "ACTIVE");

  const typedPatients = (patients as unknown as Patient[]) || [];
  const typedInsurances = (insurances as unknown as PatientInsuranceCard[]) || [];
  const typedCourses = (courses as unknown as Array<Record<string, unknown>>) || [];

  return (receptions as unknown as ReceptionEncounter[]).map((rec) => {
    const p = typedPatients.find((pt) => pt.id === rec.patient_id);
    const ins = typedInsurances.find((i) => i.patient_id === rec.patient_id) || null;
    const crs = typedCourses.find((c) => c.patient_id === rec.patient_id);

    const patientProfile: PatientProfile = {
      ...(p || {
        id: rec.patient_id,
        patient_code: "UNKNOWN",
        full_name: "Không xác định",
        normalized_name: null,
        phone: null,
        citizen_id: null,
        citizen_id_issued_at: null,
        citizen_id_issued_by: null,
        birth_date: null,
        birth_year: null,
        dob_precision: "UNKNOWN",
        sex: null,
        address: null,
        occupation: null,
        notes: null,
        is_active: true,
        created_at: rec.created_at,
        updated_at: rec.created_at,
      }),
      current_insurance: ins,
      active_alerts: [],
      active_treatment_courses_count: crs ? 1 : 0,
    };

    return {
      ...rec,
      patient: patientProfile,
      active_course: crs
        ? {
            id: crs.id as string,
            course_no: crs.course_no as number,
            doctor_name: (crs.staff as { full_name?: string } | null)?.full_name || null,
            planned_session_count: (crs.planned_session_count as number | null) ?? null,
            completed_session_count: crs.completed_session_count as number,
            status: crs.status as string,
          }
        : null,
    };
  });
}
