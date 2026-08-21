import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { RecordCourseDiagnosisParsed } from "@/lib/validation/clinical-schemas";

export interface RecordDiagnosisResult {
  success: boolean;
  diagnosis: Database["public"]["Tables"]["course_diagnoses"]["Row"];
  message?: string;
}

/**
 * Records a formal doctor-authored diagnosis on an active clinic treatment course.
 *
 * Invariants:
 * 1. Caller holds DOCTOR role at verified active clinic.
 * 2. Target Treatment Course belongs to the EXACT same active clinic (`treatment_courses.clinic_id === activeClinicId`).
 * 3. If diagnosis_id is provided, verifies `diagnosis_catalog.is_active === true`.
 * 4. Persists caller's Staff ID into `diagnosed_by_doctor_id`.
 */
export async function recordCourseDiagnosis(
  supabase: SupabaseClient<Database>,
  input: RecordCourseDiagnosisParsed,
  activeClinicId: string,
  doctorStaffId: string
): Promise<RecordDiagnosisResult> {
  // 1. Verify target treatment course exists and belongs to active clinic
  const { data: course, error: courseErr } = await supabase
    .from("treatment_courses")
    .select("id, clinic_id, status")
    .eq("id", input.treatment_course_id)
    .maybeSingle();

  if (courseErr || !course || course.clinic_id !== activeClinicId) {
    throw new Error("Không tìm thấy liệu trình phù hợp tại cơ sở hiện tại.");
  }

  // 2. Validate diagnosis catalog if diagnosis_id is provided
  const finalDiagnosisId = input.diagnosis_id || null;
  let finalRawCode = input.raw_code ? input.raw_code.trim() : null;
  let finalRawText = input.raw_text ? input.raw_text.trim() : null;

  if (input.diagnosis_id) {
    const { data: catalogItem, error: catErr } = await supabase
      .from("diagnosis_catalog")
      .select("id, code, name, is_active")
      .eq("id", input.diagnosis_id)
      .maybeSingle();

    if (catErr || !catalogItem || !catalogItem.is_active) {
      throw new Error("Chẩn đoán từ danh mục không tồn tại hoặc đã ngừng hoạt động.");
    }

    // SERVER CANONICALIZATION: Enforce canonical code and name from verified catalog entry
    finalRawCode = catalogItem.code;
    finalRawText = catalogItem.name;
  }

  // 3. Insert formal course diagnosis record with explicit Doctor authorship
  const { data: newDiagnosis, error: insertErr } = await supabase
    .from("course_diagnoses")
    .insert({
      treatment_course_id: course.id,
      diagnosis_id: finalDiagnosisId,
      raw_code: finalRawCode,
      raw_text: finalRawText,
      diagnosis_type: input.diagnosis_type || "PRIMARY",
      is_primary: input.is_primary ?? true,
      diagnosed_by_doctor_id: doctorStaffId,
      created_by: null,
    })
    .select()
    .single();

  if (insertErr || !newDiagnosis) {
    throw new Error(`Lỗi ghi nhận chẩn đoán: ${insertErr?.message}`);
  }

  // 4. Audit Log
  await supabase.from("audit_logs").insert({
    actor_user_id: null,
    action: "RECORD_COURSE_DIAGNOSIS",
    entity_type: "COURSE_DIAGNOSIS",
    entity_id: newDiagnosis.id,
    after_data: JSON.parse(JSON.stringify(newDiagnosis)),
  });

  return {
    success: true,
    diagnosis: newDiagnosis,
    message: "Ghi nhận chẩn đoán thành công.",
  };
}
