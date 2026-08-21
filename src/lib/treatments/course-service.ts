import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { TreatmentCourse } from "@/types/treatment";
import {
  createTreatmentCourseSchema,
  updateTreatmentCourseSchema,
  type CreateTreatmentCourseInput,
  type UpdateTreatmentCourseInput,
} from "@/lib/validation/treatment-schemas";

export interface CreateCourseResult {
  success: boolean;
  course: TreatmentCourse | null;
  course_no: number;
  message?: string;
}

/**
 * Creates a new treatment course (LT1, LT2, LT3...) for a patient (AC-02)
 * Automatically calculates the next course number for the patient.
 */
export async function createTreatmentCourse(
  supabase: SupabaseClient<Database>,
  input: CreateTreatmentCourseInput,
  clinicId?: string | null,
  actorUserId?: string | null
): Promise<CreateCourseResult> {
  const validated = createTreatmentCourseSchema.parse(input);

  // 1. Calculate next course number for this patient (LT1, LT2, LT3...)
  const { data: existingCourses } = await supabase
    .from("treatment_courses")
    .select("course_no")
    .eq("patient_id", validated.patient_id)
    .order("course_no", { ascending: false })
    .limit(1);

  const nextCourseNo = (existingCourses && existingCourses.length > 0)
    ? ((existingCourses[0] as unknown as { course_no: number }).course_no + 1)
    : 1;

  // 2. Insert treatment course record with clinic ownership
  const { data: newCourse, error: courseError } = await supabase
    .from("treatment_courses")
    .insert({
      clinic_id: clinicId || null,
      patient_id: validated.patient_id,
      reception_id: validated.reception_id || null,
      course_no: nextCourseNo,
      primary_doctor_id: validated.primary_doctor_id || null,
      start_date: validated.start_date,
      planned_session_count: validated.planned_session_count,
      completed_session_count: 0,
      status: "ACTIVE",
      adherence_status: "NORMAL",
      notes: validated.notes || null,
      created_by: actorUserId || null,
    })
    .select()
    .single();

  if (courseError || !newCourse) {
    throw new Error(`Failed to create treatment course: ${courseError?.message}`);
  }

  const typedCourse = newCourse as unknown as TreatmentCourse;

  // 3. Attach diagnoses if provided
  if (validated.diagnoses && validated.diagnoses.length > 0) {
    const diagnosisInserts = validated.diagnoses.map((d) => ({
      treatment_course_id: typedCourse.id,
      diagnosis_id: d.diagnosis_id || null,
      raw_code: d.raw_code || null,
      raw_text: d.raw_text || null,
      diagnosis_type: d.diagnosis_type || "PRIMARY",
      is_primary: d.is_primary ?? true,
      created_by: actorUserId || null,
    }));

    await supabase.from("course_diagnoses").insert(diagnosisInserts);
  }

  // 4. Attach service orders if provided
  if (validated.service_orders && validated.service_orders.length > 0) {
    const serviceInserts = validated.service_orders.map((s, idx) => ({
      treatment_course_id: typedCourse.id,
      service_id: s.service_id,
      ordered_by_doctor_id: s.ordered_by_doctor_id || validated.primary_doctor_id || null,
      order_source: s.order_source || "FIRST_PLAN",
      sequence_no: s.sequence_no || idx + 1,
      side_or_location: s.side_or_location || null,
      notes: s.notes || null,
      is_active: true,
    }));

    await supabase.from("course_service_orders").insert(serviceInserts);
  }

  // 5. Attach tags if provided
  if (validated.tags && validated.tags.length > 0) {
    const tagInserts = validated.tags.map((t) => ({
      treatment_course_id: typedCourse.id,
      tag_id: t.tag_id,
      note: t.note || null,
    }));

    await supabase.from("treatment_course_tags").insert(tagInserts);
  }

  // 6. Record audit log
  await supabase.from("audit_logs").insert({
    actor_user_id: actorUserId || null,
    action: "CREATE_TREATMENT_COURSE",
    entity_type: "TREATMENT_COURSE",
    entity_id: typedCourse.id,
    after_data: JSON.parse(JSON.stringify(typedCourse)),
  });

  return {
    success: true,
    course: typedCourse,
    course_no: nextCourseNo,
    message: `Tạo liệu trình LT${nextCourseNo} thành công.`,
  };
}

/**
 * Updates status or details of a treatment course
 */
export async function updateTreatmentCourse(
  supabase: SupabaseClient<Database>,
  courseId: string,
  input: UpdateTreatmentCourseInput,
  actorUserId?: string
) {
  const validated = updateTreatmentCourseSchema.parse(input);

  const { data: updated, error } = await supabase
    .from("treatment_courses")
    .update(validated)
    .eq("id", courseId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update treatment course: ${error.message}`);
  }

  // Record audit log
  await supabase.from("audit_logs").insert({
    actor_user_id: actorUserId || null,
    action: "UPDATE_TREATMENT_COURSE",
    entity_type: "TREATMENT_COURSE",
    entity_id: courseId,
    after_data: JSON.parse(JSON.stringify(updated)),
  });

  return updated;
}
