import "server-only";
import { createClient } from "@/supabase-clients/server";
import type { PatientProfile, Patient, PatientInsuranceCard, PatientMeasurement, PatientAlert } from "@/types/patient";
import { normalizePhone } from "@/utils/normalize-phone";
import { normalizeCccd } from "@/utils/normalize-cccd";
import { normalizeBhyt } from "@/utils/normalize-bhyt";
import { removeVietnameseAccents } from "@/utils/format-person-name";

export async function getRecentPatients(limit: number = 50): Promise<PatientProfile[]> {
  const supabase = await createClient();
  const { data: patients } = await supabase
    .from("patients")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!patients || patients.length === 0) return [];
  return fetchProfilesByIds(supabase, (patients as unknown as Array<{ id: string }>).map((p) => p.id));
}

export async function searchPatients(queryStr: string, limit: number = 20): Promise<PatientProfile[]> {
  if (!queryStr || !queryStr.trim()) {
    return [];
  }

  const query = queryStr.trim();
  const supabase = await createClient();

  // 1. Try BHYT Exact Lookup
  const bhyt = normalizeBhyt(query);
  if (bhyt.isValid && bhyt.normalized) {
    const { data: insuranceRecords } = await supabase
      .from("patient_insurance_cards")
      .select("patient_id")
      .ilike("card_number", `%${bhyt.normalized}%`)
      .limit(limit);

    if (insuranceRecords && insuranceRecords.length > 0) {
      const patientIds = (insuranceRecords as unknown as Array<{ patient_id: string }>).map((r) => r.patient_id);
      return fetchProfilesByIds(supabase, patientIds);
    }
  }

  // 2. Try CCCD Exact/Partial Lookup
  const cccd = normalizeCccd(query);
  if (cccd.isValid && cccd.normalized) {
    const { data: cccdPatients } = await supabase
      .from("patients")
      .select("id")
      .ilike("citizen_id", `%${cccd.normalized}%`)
      .limit(limit);

    if (cccdPatients && cccdPatients.length > 0) {
      return fetchProfilesByIds(supabase, (cccdPatients as unknown as Array<{ id: string }>).map((p) => p.id));
    }
  }

  // 3. Try Phone Lookup
  const phone = normalizePhone(query);
  if (phone.isValid && phone.normalized) {
    const { data: phonePatients } = await supabase
      .from("patients")
      .select("id")
      .ilike("phone", `%${phone.normalized}%`)
      .limit(limit);

    if (phonePatients && phonePatients.length > 0) {
      return fetchProfilesByIds(supabase, (phonePatients as unknown as Array<{ id: string }>).map((p) => p.id));
    }
  }

  // 4. Try Patient Code Lookup
  if (query.toUpperCase().startsWith("BN-")) {
    const { data: codePatients } = await supabase
      .from("patients")
      .select("id")
      .ilike("patient_code", `%${query.toUpperCase()}%`)
      .limit(limit);

    if (codePatients && codePatients.length > 0) {
      return fetchProfilesByIds(supabase, (codePatients as unknown as Array<{ id: string }>).map((p) => p.id));
    }
  }

  // 5. Name Fuzzy / Accent-insensitive Search
  const unaccented = removeVietnameseAccents(query.toLowerCase());
  const { data: namePatients } = await supabase
    .from("patients")
    .select("id")
    .or(`full_name.ilike.%${query}%,normalized_name.ilike.%${unaccented}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (namePatients && namePatients.length > 0) {
    return fetchProfilesByIds(supabase, (namePatients as unknown as Array<{ id: string }>).map((p) => p.id));
  }

  return [];
}

async function fetchProfilesByIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  patientIds: string[]
): Promise<PatientProfile[]> {
  const { data: patients } = await supabase
    .from("patients")
    .select("*")
    .in("id", patientIds);

  if (!patients) return [];

  const { data: insurances } = await supabase
    .from("patient_insurance_cards")
    .select("*")
    .in("patient_id", patientIds)
    .eq("is_current", true);

  const { data: measurements } = await supabase
    .from("patient_measurements")
    .select("*")
    .in("patient_id", patientIds)
    .order("measured_at", { ascending: false });

  const { data: alerts } = await supabase
    .from("patient_alerts")
    .select("*")
    .in("patient_id", patientIds)
    .eq("is_active", true);

  const typedInsurances = (insurances as unknown as PatientInsuranceCard[]) || [];
  const typedMeasurements = (measurements as unknown as PatientMeasurement[]) || [];
  const typedAlerts = (alerts as unknown as PatientAlert[]) || [];

  return (patients as unknown as Patient[]).map((patient) => {
    const currentInsurance = typedInsurances.find((i) => i.patient_id === patient.id) || null;
    const latestMeasurement = typedMeasurements.find((m) => m.patient_id === patient.id) || null;
    const activeAlerts = typedAlerts.filter((a) => a.patient_id === patient.id);

    return {
      ...patient,
      current_insurance: currentInsurance,
      latest_measurement: latestMeasurement,
      active_alerts: activeAlerts,
      active_treatment_courses_count: 0,
    };
  });
}
