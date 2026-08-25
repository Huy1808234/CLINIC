import "server-only";
import { createClient } from "@/supabase-clients/server";
import { getActiveClinicContext } from "@/lib/auth/clinic-context";
import { getClinicTodayDate, getUtcBoundsForClinicDate, DEFAULT_CLINIC_TIMEZONE } from "@/utils/timezone";
import type { ReceptionQueueItem, ReceptionEncounter } from "@/types/reception";
import type { PatientProfile, Patient, PatientInsuranceCard } from "@/types/patient";

export async function getTodayReceptions(targetDate?: string): Promise<ReceptionQueueItem[]> {
  const supabase = await createClient();
  const clinicContext = await getActiveClinicContext();
  const clinicId = clinicContext?.id;
  const timeZone = clinicContext?.timezone || DEFAULT_CLINIC_TIMEZONE;

  const dateToFetch = targetDate || getClinicTodayDate(timeZone);
  const { startUtc, endUtc } = getUtcBoundsForClinicDate(dateToFetch, timeZone);

  let query = supabase
    .from("receptions")
    .select(`
      id,
      patient_id,
      clinic_id,
      insurance_card_id,
      arrived_at,
      registered_at,
      reception_source,
      patient_relation_type,
      paper_file_status,
      his_import_status,
      reason_for_visit,
      notes,
      created_by,
      created_at
    `)
    .gte("arrived_at", startUtc)
    .lt("arrived_at", endUtc)
    .order("arrived_at", { ascending: false })
    .order("id", { ascending: false });

  if (clinicId) {
    query = query.eq("clinic_id", clinicId);
  }

  const { data: receptions, error } = await query;

  if (error || !receptions) {
    return [];
  }

  const patientIds = receptions.map((r) => r.patient_id);
  if (patientIds.length === 0) return [];

  // Concurrently fetch patients, insurance cards, and active courses in parallel
  const [patientsRes, insurancesRes, coursesRes] = await Promise.all([
    supabase
      .from("patients")
      .select(`
        id,
        patient_code,
        full_name,
        normalized_name,
        phone,
        citizen_id,
        citizen_id_issued_at,
        citizen_id_issued_by,
        birth_date,
        birth_year,
        dob_precision,
        sex,
        address,
        occupation,
        notes,
        is_active,
        created_at,
        updated_at
      `)
      .in("id", patientIds),

    supabase
      .from("patient_insurance_cards")
      .select(`
        id,
        patient_id,
        card_number,
        registered_facility_code,
        registered_facility_name,
        subject_code,
        benefit_rate,
        valid_from,
        valid_to,
        raw_validity_text,
        verification_status,
        verified_at,
        is_current,
        created_at
      `)
      .in("patient_id", patientIds)
      .eq("is_current", true),

    supabase
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
      .eq("status", "ACTIVE"),
  ]);

  const typedPatients = (patientsRes.data as unknown as Patient[]) || [];
  const typedInsurances = (insurancesRes.data as unknown as PatientInsuranceCard[]) || [];
  const typedCourses = (coursesRes.data as unknown as Array<Record<string, unknown>>) || [];

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
