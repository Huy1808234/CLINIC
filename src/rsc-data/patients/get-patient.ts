import "server-only";
import { createClient } from "@/supabase-clients/server";
import type { PatientProfile, PatientAlert, PatientInsuranceCard, PatientMeasurement, Patient } from "@/types/patient";

export async function getPatientProfile(patientId: string): Promise<PatientProfile | null> {
  const supabase = await createClient();

  const { data: patient, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .maybeSingle();

  if (error || !patient) {
    return null;
  }

  // Fetch current insurance card
  const { data: insurance } = await supabase
    .from("patient_insurance_cards")
    .select("*")
    .eq("patient_id", patientId)
    .eq("is_current", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch latest measurement
  const { data: measurement } = await supabase
    .from("patient_measurements")
    .select("*")
    .eq("patient_id", patientId)
    .order("measured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch active alerts
  const { data: alerts } = await supabase
    .from("patient_alerts")
    .select("*")
    .eq("patient_id", patientId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  // Fetch active courses count
  const { count: activeCourseCount } = await supabase
    .from("treatment_courses")
    .select("*", { count: "exact", head: true })
    .eq("patient_id", patientId)
    .eq("status", "ACTIVE");

  return {
    ...(patient as unknown as Patient),
    current_insurance: (insurance as unknown as PatientInsuranceCard) || null,
    latest_measurement: (measurement as unknown as PatientMeasurement) || null,
    active_alerts: (alerts as unknown as PatientAlert[]) || [],
    active_treatment_courses_count: activeCourseCount || 0,
  };
}
