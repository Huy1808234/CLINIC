import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { ReceptionEncounter } from "@/types/reception";
import type { Patient } from "@/types/patient";
import type { TreatmentCourse } from "@/types/treatment";
import { createReceptionSchema, type CreateReceptionInput } from "@/lib/validation/reception-schemas";
import { matchPatientCandidate } from "@/lib/patients/deduplication";
import { normalizePatientInputs } from "@/lib/patients/normalizers";

export interface ProcessReceptionResult {
  success: boolean;
  reception: ReceptionEncounter;
  patient: Patient;
  course: TreatmentCourse | null;
  is_new_patient?: boolean;
  message?: string;
}

/**
 * Standard typed domain errors for Atomic Reception Intake
 */
export class ReceptionIntakeError extends Error {
  public readonly code: string;
  constructor(message: string, code = "RECEPTION_INTAKE_FAILED") {
    super(message);
    this.name = "ReceptionIntakeError";
    this.code = code;
    Object.setPrototypeOf(this, ReceptionIntakeError.prototype);
  }
}

/**
 * Executes atomic reception intake workflow via PostgreSQL RPC `process_reception_intake_atomic`.
 *
 * Guarantees all-or-nothing transactional integrity across:
 * - Patient Master creation (if new) with concurrency locks & exact re-checks
 * - Insurance Card attachment (if provided)
 * - Patient Measurements (height/weight with verified Auth User UUID)
 * - Reception Encounter creation
 * - Initial Treatment Course creation (when requested, with patient row lock & course_no allocation)
 * - Audit Logs insertion
 */
export async function processReceptionIntake(
  supabase: SupabaseClient<Database>,
  input: CreateReceptionInput,
  clinicId: string,
  actorStaffId: string,
  actorUserId: string
): Promise<ProcessReceptionResult> {
  const validated = createReceptionSchema.parse(input);

  if (!clinicId || !actorStaffId || !actorUserId) {
    throw new ReceptionIntakeError(
      "Thiếu thông tin cơ sở hoặc danh tính người thực hiện tiếp nhận.",
      "INVALID_INPUT"
    );
  }

  // 1. READ-ONLY Patient Candidate Pre-Matching in TypeScript
  let existingPatientId: string | null = null;
  let newPatientPayload: Record<string, unknown> | null = null;

  if (validated.patient_id) {
    existingPatientId = validated.patient_id;
  } else if (validated.patient_data) {
    const rawData = validated.patient_data;
    const normalized = normalizePatientInputs({
      full_name: rawData.full_name,
      phone: rawData.phone,
      citizen_id: rawData.citizen_id,
      card_number: rawData.insurance_card_number,
      birth_date_or_year: rawData.birth_date || rawData.birth_year,
      height: rawData.height_cm,
      weight: rawData.weight_kg,
    });

    // Execute read-only candidate matching
    const matchResult = await matchPatientCandidate(supabase, normalized, rawData.address);

    if (matchResult.matched_patient_id) {
      existingPatientId = matchResult.matched_patient_id;
    } else {
      // Build normalized payload for atomic RPC new patient creation
      newPatientPayload = {
        full_name: normalized.full_name,
        normalized_name: normalized.normalized_name,
        phone: normalized.phone,
        citizen_id: normalized.citizen_id,
        citizen_id_issued_at: rawData.citizen_id_issued_at || null,
        citizen_id_issued_by: rawData.citizen_id_issued_by || null,
        birth_date: normalized.birth_date,
        birth_year: normalized.birth_year,
        dob_precision: normalized.dob_precision,
        sex: rawData.sex || null,
        address: rawData.address || null,
        occupation: rawData.occupation || null,
        notes: rawData.notes || null,
        insurance_card_number: normalized.card_number,
        registered_facility_code: rawData.registered_facility_code || null,
        registered_facility_name: rawData.registered_facility_name || null,
        benefit_rate: rawData.benefit_rate || null,
        insurance_valid_from: rawData.insurance_valid_from || null,
        insurance_valid_to: rawData.insurance_valid_to || null,
      };
    }
  } else {
    throw new ReceptionIntakeError(
      "Yêu cầu cung cấp mã bệnh nhân hoặc thông tin bệnh nhân mới.",
      "INVALID_PATIENT_SELECTION"
    );
  }

  // 2. Call Atomic PostgreSQL RPC
  const { data: rpcRawRes, error: rpcError } = await supabase.rpc(
    "process_reception_intake_atomic",
    {
      p_clinic_id: clinicId,
      p_actor_staff_id: actorStaffId,
      p_actor_user_id: actorUserId,
      p_existing_patient_id: existingPatientId,
      p_new_patient: (newPatientPayload as unknown as Json) || null,
      p_reception_source: validated.reception_source || "MANUAL",
      p_reason_for_visit: validated.reason_for_visit || null,
      p_notes: validated.notes || null,
      p_height_cm: validated.patient_data?.height_cm ?? null,
      p_weight_kg: validated.patient_data?.weight_kg ?? null,
      p_create_course: validated.create_course ?? true,
      p_doctor_id: validated.doctor_id || null,
      p_start_date: validated.start_date || null,
    }
  );

  if (rpcError) {
    throw new ReceptionIntakeError(
      rpcError.message || "Lỗi thực thi giao dịch tiếp nhận bệnh nhân.",
      rpcError.code || "RPC_ERROR"
    );
  }

  const rpcRes = rpcRawRes as {
    success: boolean;
    error_code?: string;
    message?: string;
    reception?: ReceptionEncounter;
    patient?: { id: string; patient_code: string; full_name: string };
    course?: TreatmentCourse | null;
    is_new_patient?: boolean;
  } | null;

  if (!rpcRes || !rpcRes.success) {
    const errCode = rpcRes?.error_code || "RECEPTION_FAILED";
    const errMsg = mapRpcErrorCodeToMessage(errCode, rpcRes?.message);
    throw new ReceptionIntakeError(errMsg, errCode);
  }

  // 3. Fetch committed Patient profile for UI consistency
  const patientId = rpcRes.patient?.id || rpcRes.reception?.patient_id;
  let fullPatient: Patient | null = null;
  if (patientId) {
    const { data: patientRow } = await supabase
      .from("patients")
      .select("*")
      .eq("id", patientId)
      .maybeSingle();

    if (patientRow) {
      fullPatient = patientRow as unknown as Patient;
    }
  }

  if (!fullPatient) {
    fullPatient = {
      id: rpcRes.patient?.id || "",
      patient_code: rpcRes.patient?.patient_code || "",
      full_name: rpcRes.patient?.full_name || "",
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return {
    success: true,
    reception: rpcRes.reception as ReceptionEncounter,
    patient: fullPatient,
    course: rpcRes.course || null,
    is_new_patient: rpcRes.is_new_patient ?? false,
    message: "Tiếp nhận bệnh nhân thành công.",
  };
}

/**
 * Maps PostgreSQL domain error codes to user-friendly Vietnamese messages.
 */
function mapRpcErrorCodeToMessage(code: string, fallbackMessage?: string): string {
  switch (code) {
    case "PATIENT_IDENTITY_CONFLICT":
      return "Thông tin CCCD và BHYT đang thuộc hai hồ sơ bệnh nhân khác nhau.";
    case "PATIENT_INSURANCE_AMBIGUOUS":
      return "Số thẻ BHYT đang liên kết với nhiều hồ sơ bệnh nhân khác nhau.";
    case "INVALID_PATIENT_SELECTION":
      return "Yêu cầu cung cấp chính xác một trong hai: mã bệnh nhân đã có hoặc thông tin bệnh nhân mới.";
    case "PATIENT_CODE_GENERATION_FAILED":
      return "Không thể tạo mã bệnh nhân duy nhất sau nhiều lần thử. Vui lòng thử lại.";
    case "UNAUTHORIZED_RECEPTIONIST":
      return "Bạn không có quyền thực hiện tiếp nhận bệnh nhân tại cơ sở này.";
    case "INVALID_DOCTOR_TARGET":
      return "Bác sĩ được chọn không hợp lệ hoặc không được phân công tại cơ sở hiện tại.";
    case "PATIENT_NOT_FOUND":
      return "Không tìm thấy hồ sơ bệnh nhân.";
    case "INVALID_ACTOR":
      return "Tài khoản người dùng không hợp lệ hoặc đã bị vô hiệu hóa.";
    case "CLINIC_NOT_FOUND":
      return "Cơ sở phòng khám không tồn tại hoặc đã ngừng hoạt động.";
    default:
      return fallbackMessage || "Lỗi tiếp nhận bệnh nhân.";
  }
}
