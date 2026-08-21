import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Patient, DeduplicationMatchResult } from "@/types/patient";
import { patientFormSchema, type PatientFormInput } from "@/lib/validation/patient-schemas";
import { normalizePatientInputs } from "./normalizers";
import { matchPatientCandidate } from "./deduplication";

export interface CreatePatientResult {
  success: boolean;
  patient: Patient | null;
  deduplication: DeduplicationMatchResult;
  isExisting: boolean;
  message?: string;
}

/**
 * Creates or retrieves existing patient applying deduplication matching (AC-01)
 */
export async function createOrMatchPatient(
  supabase: SupabaseClient<Database>,
  input: PatientFormInput,
  actorUserId?: string
): Promise<CreatePatientResult> {
  const validated = patientFormSchema.parse(input);

  // 1. Normalize all inputs
  const normalized = normalizePatientInputs({
    full_name: validated.full_name,
    phone: validated.phone,
    citizen_id: validated.citizen_id,
    card_number: validated.insurance_card_number,
    birth_date_or_year: validated.birth_date || validated.birth_year,
    height: validated.height_cm,
    weight: validated.weight_kg,
  });

  // 2. Check for deduplication matches
  const matchResult = await matchPatientCandidate(supabase, normalized, validated.address);

  // If exact match found (e.g. BHYT or CCCD), return existing patient to prevent duplicate record
  if (matchResult.matched_patient_id && !matchResult.requires_merge_review && matchResult.existing_patient) {
    // Optionally update measurements if new ones provided
    if (normalized.height_cm || normalized.weight_kg) {
      await recordMeasurement(supabase, {
        patient_id: matchResult.matched_patient_id,
        height_cm: normalized.height_cm,
        weight_kg: normalized.weight_kg,
        source: "RECEPTION",
        recorded_by: actorUserId,
      });
    }

    return {
      success: true,
      patient: matchResult.existing_patient,
      deduplication: matchResult,
      isExisting: true,
      message: "Bệnh nhân đã tồn tại trong hệ thống. Đã tải thông tin hồ sơ.",
    };
  }

  // 3. Generate unique patient code (e.g., BN-YYYYMMDD-XXXX)
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
  const patientCode = `BN-${todayStr}-${randomSuffix}`;

  // 4. Insert new Patient Master record
  const { data: newPatient, error: patientError } = await supabase
    .from("patients")
    .insert({
      patient_code: patientCode,
      full_name: normalized.full_name,
      normalized_name: normalized.normalized_name,
      phone: normalized.phone,
      citizen_id: normalized.citizen_id,
      citizen_id_issued_at: validated.citizen_id_issued_at || null,
      citizen_id_issued_by: validated.citizen_id_issued_by || null,
      birth_date: normalized.birth_date,
      birth_year: normalized.birth_year,
      dob_precision: normalized.dob_precision,
      sex: validated.sex || null,
      address: validated.address || null,
      occupation: validated.occupation || null,
      notes: validated.notes || null,
      created_by: actorUserId || null,
    })
    .select()
    .single();

  if (patientError || !newPatient) {
    throw new Error(`Failed to create patient: ${patientError?.message}`);
  }

  const typedNewPatient = newPatient as unknown as Patient;

  // 5. Attach Insurance Card if provided
  if (normalized.card_number) {
    await supabase.from("patient_insurance_cards").insert({
      patient_id: typedNewPatient.id,
      card_number: normalized.card_number,
      registered_facility_code: validated.registered_facility_code || null,
      registered_facility_name: validated.registered_facility_name || null,
      benefit_rate: validated.benefit_rate || null,
      valid_from: validated.insurance_valid_from || null,
      valid_to: validated.insurance_valid_to || null,
      is_current: true,
    });
  }

  // 6. Record measurements if provided
  if (normalized.height_cm || normalized.weight_kg) {
    await recordMeasurement(supabase, {
      patient_id: typedNewPatient.id,
      height_cm: normalized.height_cm,
      weight_kg: normalized.weight_kg,
      source: "RECEPTION",
      recorded_by: actorUserId,
    });
  }

  // 7. Write Audit Log
  await supabase.from("audit_logs").insert({
    actor_user_id: actorUserId || null,
    action: "CREATE_PATIENT",
    entity_type: "PATIENT",
    entity_id: typedNewPatient.id,
    after_data: JSON.parse(JSON.stringify(typedNewPatient)),
  });

  return {
    success: true,
    patient: typedNewPatient,
    deduplication: matchResult,
    isExisting: false,
    message: "Tạo mới hồ sơ bệnh nhân thành công.",
  };
}

export async function recordMeasurement(
  supabase: SupabaseClient<Database>,
  measurement: {
    patient_id: string;
    height_cm: number | null;
    weight_kg: number | null;
    source?: string;
    recorded_by?: string | null;
  }
) {
  return supabase.from("patient_measurements").insert({
    patient_id: measurement.patient_id,
    height_cm: measurement.height_cm,
    weight_kg: measurement.weight_kg,
    source: measurement.source || "MANUAL",
    recorded_by: measurement.recorded_by || null,
  });
}
