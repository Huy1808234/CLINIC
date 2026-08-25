import "server-only";
import { createClient } from "@/supabase-clients/server";
import type { PatientProfile, PatientAlert, PatientInsuranceCard, PatientMeasurement, Patient } from "@/types/patient";

export async function getPatientProfile(patientId: string): Promise<PatientProfile | null> {
  const supabase = await createClient();

  const { data: patient, error } = await supabase
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
    .eq("id", patientId)
    .maybeSingle();

  if (error || !patient) {
    return null;
  }

  // Concurrently fetch sub-attributes
  const [insuranceRes, measurementRes, alertRes, activeCourseRes] = await Promise.all([
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
      .eq("patient_id", patientId)
      .eq("is_current", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("patient_measurements")
      .select(`
        id,
        patient_id,
        height_cm,
        weight_kg,
        source,
        recorded_by,
        measured_at
      `)
      .eq("patient_id", patientId)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("patient_alerts")
      .select(`
        id,
        patient_id,
        category,
        severity,
        message,
        is_active,
        created_by,
        created_at,
        resolved_at
      `)
      .eq("patient_id", patientId)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),

    supabase
      .from("treatment_courses")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .eq("status", "ACTIVE"),
  ]);

  return {
    ...(patient as unknown as Patient),
    current_insurance: (insuranceRes.data as unknown as PatientInsuranceCard) || null,
    latest_measurement: (measurementRes.data as unknown as PatientMeasurement) || null,
    active_alerts: (alertRes.data as unknown as PatientAlert[]) || [],
    active_treatment_courses_count: activeCourseRes.count || 0,
  };
}
