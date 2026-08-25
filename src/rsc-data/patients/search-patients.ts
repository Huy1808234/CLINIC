import "server-only";
import { createClient } from "@/supabase-clients/server";
import type { PatientProfile, Patient, PatientInsuranceCard, PatientMeasurement, PatientAlert } from "@/types/patient";
import { normalizePhone } from "@/utils/normalize-phone";
import { normalizeCccd } from "@/utils/normalize-cccd";
import { normalizeBhyt } from "@/utils/normalize-bhyt";
import { removeVietnameseAccents } from "@/utils/format-person-name";

export interface PaginatedPatientsResult {
  items: PatientProfile[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getRecentPatients(limit: number = 50): Promise<PatientProfile[]> {
  const supabase = await createClient();
  const { data: patients } = await supabase
    .from("patients")
    .select("id")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (!patients || patients.length === 0) return [];
  return fetchProfilesByIds(supabase, patients.map((p) => p.id));
}

export async function getPaginatedPatients(
  page: number = 1,
  pageSize: number = 20,
  searchQuery?: string
): Promise<PaginatedPatientsResult> {
  const supabase = await createClient();
  const validPage = Math.max(1, page);
  const validPageSize = [10, 20, 50].includes(pageSize) ? pageSize : 20;
  const from = (validPage - 1) * validPageSize;
  const to = from + validPageSize - 1;

  if (searchQuery && searchQuery.trim()) {
    const searchResults = await searchPatients(searchQuery, validPageSize);
    return {
      items: searchResults,
      total: searchResults.length,
      page: 1,
      pageSize: validPageSize,
      totalPages: 1,
    };
  }

  const { data: patientIds, count, error } = await supabase
    .from("patients")
    .select("id", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (error || !patientIds) {
    return {
      items: [],
      total: 0,
      page: validPage,
      pageSize: validPageSize,
      totalPages: 0,
    };
  }

  const total = count ?? patientIds.length;
  const totalPages = Math.ceil(total / validPageSize) || 1;
  const items = await fetchProfilesByIds(supabase, patientIds.map((p) => p.id));

  return {
    items,
    total,
    page: validPage,
    pageSize: validPageSize,
    totalPages,
  };
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
      const patientIds = insuranceRecords.map((r) => r.patient_id);
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
      return fetchProfilesByIds(supabase, cccdPatients.map((p) => p.id));
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
      return fetchProfilesByIds(supabase, phonePatients.map((p) => p.id));
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
      return fetchProfilesByIds(supabase, codePatients.map((p) => p.id));
    }
  }

  // 5. Name Fuzzy / Accent-insensitive Search
  const unaccented = removeVietnameseAccents(query.toLowerCase());
  const { data: namePatients } = await supabase
    .from("patients")
    .select("id")
    .or(`full_name.ilike.%${query}%,normalized_name.ilike.%${unaccented}%`)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (namePatients && namePatients.length > 0) {
    return fetchProfilesByIds(supabase, namePatients.map((p) => p.id));
  }

  return [];
}

async function fetchProfilesByIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  patientIds: string[]
): Promise<PatientProfile[]> {
  if (!patientIds || patientIds.length === 0) {
    return [];
  }

  // Concurrently fetch primary records and all 1:N attributes in parallel
  const [patientRes, insuranceRes, measurementRes, alertRes] = await Promise.all([
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
        issue_date,
        expiration_date,
        initial_healthcare_code,
        initial_healthcare_name,
        is_current,
        notes,
        created_at
      `)
      .in("patient_id", patientIds)
      .eq("is_current", true),

    supabase
      .from("patient_measurements")
      .select(`
        id,
        patient_id,
        blood_pressure_systolic,
        blood_pressure_diastolic,
        heart_rate,
        temperature,
        height,
        weight,
        bmi,
        notes,
        measured_at,
        created_at
      `)
      .in("patient_id", patientIds)
      .order("measured_at", { ascending: false })
      .order("id", { ascending: false }),

    supabase
      .from("patient_alerts")
      .select(`
        id,
        patient_id,
        alert_type,
        alert_level,
        message,
        is_active,
        created_at
      `)
      .in("patient_id", patientIds)
      .eq("is_active", true),
  ]);

  const patients = patientRes.data || [];
  if (patients.length === 0) return [];

  const typedInsurances = (insuranceRes.data as unknown as PatientInsuranceCard[]) || [];
  const typedMeasurements = (measurementRes.data as unknown as PatientMeasurement[]) || [];
  const typedAlerts = (alertRes.data as unknown as PatientAlert[]) || [];

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
