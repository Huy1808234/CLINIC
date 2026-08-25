"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/supabase-clients/server";
import { requireApplicationAccessContext } from "@/lib/auth/application-access";
import { getCurrentStaffRolesForClinic } from "@/lib/auth/role-resolver";
import type { ClinicalNoteItem } from "@/types/patient";

export interface CreateClinicalNoteInput {
  patientId: string;
  treatmentCourseId?: string | null;
  receptionId?: string | null;
  content: string;
}

export interface CreateClinicalNoteResult {
  success: boolean;
  note?: ClinicalNoteItem;
  error?: string;
}

export interface GetPatientClinicalNotesPageInput {
  patientId: string;
  page?: number;
  pageSize?: number;
}

export interface GetPatientClinicalNotesPageResult {
  success: boolean;
  notes?: ClinicalNoteItem[];
  total?: number;
  page?: number;
  pageSize?: number;
  error?: string;
}

export interface GetCourseClinicalNotesInput {
  courseId: string;
  patientId: string;
}

export interface GetCourseClinicalNotesResult {
  success: boolean;
  notes?: ClinicalNoteItem[];
  error?: string;
}

/**
 * Server Action for Doctors to create a new Doctor Clinical Note on a patient chart.
 *
 * Association Security Invariants:
 * 1. Caller must be authenticated with active staff membership at the active clinic.
 * 2. Caller must hold the DOCTOR role at the active clinic.
 * 3. Author ID is strictly assigned from authenticated Staff (cannot be chosen by client).
 * 4. Clinic ID and Org ID are strictly assigned from active clinic context.
 * 5. Patient must exist and be accessible under the organization/clinic.
 * 6. If treatment_course_id is provided, it must exist, belong to the patient, and belong to the active clinic.
 * 7. If reception_id is provided, it must exist, belong to the patient, and belong to the active clinic.
 */
export async function createClinicalNoteAction(
  input: CreateClinicalNoteInput
): Promise<CreateClinicalNoteResult> {
  try {
    const accessContext = await requireApplicationAccessContext();
    const roles = await getCurrentStaffRolesForClinic(accessContext.clinic.clinic_id);

    // 1. Role Authorization Guard (Doctor only)
    if (!roles.includes("DOCTOR")) {
      return {
        success: false,
        error: "Chỉ Bác sĩ phụ trách mới có quyền tạo ghi chú lâm sàng.",
      };
    }

    // 2. Input Validation
    const patientId = input.patientId?.trim();
    if (!patientId) {
      return {
        success: false,
        error: "Thiếu thông tin mã định danh bệnh nhân.",
      };
    }

    const content = input.content?.trim();
    if (!content) {
      return {
        success: false,
        error: "Nội dung ghi chú lâm sàng không được để trống.",
      };
    }

    if (content.length > 2000) {
      return {
        success: false,
        error: "Nội dung ghi chú không được vượt quá 2000 ký tự.",
      };
    }

    const supabase = await createClient();

    // 3. Verify Patient exists
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id")
      .eq("id", patientId)
      .maybeSingle();

    if (patientError || !patient) {
      return {
        success: false,
        error: "Không tìm thấy hồ sơ bệnh nhân.",
      };
    }

    // 4. Verify Treatment Course if provided (Must belong to this patient AND this clinic)
    let courseNo: number | null = null;
    if (input.treatmentCourseId) {
      const { data: course, error: courseError } = await supabase
        .from("treatment_courses")
        .select("id, course_no, patient_id, clinic_id")
        .eq("id", input.treatmentCourseId)
        .maybeSingle();

      if (courseError || !course) {
        return {
          success: false,
          error: "Không tìm thấy liệu trình điều trị được chỉ định.",
        };
      }

      if (course.patient_id !== patientId) {
        return {
          success: false,
          error: "Liệu trình điều trị không thuộc bệnh nhân này.",
        };
      }

      if (course.clinic_id && course.clinic_id !== accessContext.clinic.clinic_id) {
        return {
          success: false,
          error: "Liệu trình điều trị thuộc cơ sở y tế khác hoặc không hợp lệ.",
        };
      }

      courseNo = course.course_no;
    }

    // 5. Verify Reception if provided (Must belong to this patient AND this clinic)
    if (input.receptionId) {
      const { data: reception, error: receptionError } = await supabase
        .from("receptions")
        .select("id, patient_id, clinic_id")
        .eq("id", input.receptionId)
        .maybeSingle();

      if (receptionError || !reception) {
        return {
          success: false,
          error: "Không tìm thấy lượt tiếp nhận khám được chỉ định.",
        };
      }

      if (reception.patient_id !== patientId) {
        return {
          success: false,
          error: "Lượt tiếp nhận khám không thuộc bệnh nhân này.",
        };
      }

      if (reception.clinic_id && reception.clinic_id !== accessContext.clinic.clinic_id) {
        return {
          success: false,
          error: "Lượt tiếp nhận khám thuộc cơ sở y tế khác hoặc không hợp lệ.",
        };
      }
    }

    // 6. Insert Clinical Note row with strictly server-resolved author & clinic
    const { data: inserted, error: insertError } = await supabase
      .from("clinical_notes")
      .insert({
        organization_id: accessContext.clinic.organization_id,
        clinic_id: accessContext.clinic.clinic_id,
        patient_id: patientId,
        treatment_course_id: input.treatmentCourseId || null,
        reception_id: input.receptionId || null,
        author_staff_id: accessContext.staff.id,
        content,
      })
      .select("*")
      .single();

    if (insertError || !inserted) {
      console.error("Failed to insert clinical note:", insertError);
      return {
        success: false,
        error: "Không thể lưu ghi chú lâm sàng. Vui lòng thử lại.",
      };
    }

    // 7. Revalidate Patient Chart page
    revalidatePath(`/patients/${patientId}`);

    const newNote: ClinicalNoteItem = {
      id: inserted.id,
      patient_id: inserted.patient_id,
      clinic_id: inserted.clinic_id,
      organization_id: inserted.organization_id,
      treatment_course_id: inserted.treatment_course_id,
      reception_id: inserted.reception_id,
      author_staff_id: inserted.author_staff_id,
      author_name: accessContext.staff.full_name,
      content: inserted.content,
      created_at: inserted.created_at,
      updated_at: inserted.updated_at,
      course_no: courseNo,
    };

    return {
      success: true,
      note: newNote,
    };
  } catch (err: unknown) {
    console.error("createClinicalNoteAction error:", err);
    return {
      success: false,
      error: "Đã xảy ra lỗi khi tạo ghi chú lâm sàng.",
    };
  }
}

/**
 * Server Action to load paginated clinical notes for a patient on demand (View All Drawer).
 */
export async function getPatientClinicalNotesPageAction(
  input: GetPatientClinicalNotesPageInput
): Promise<GetPatientClinicalNotesPageResult> {
  try {
    const accessContext = await requireApplicationAccessContext();

    const patientId = input.patientId?.trim();
    if (!patientId) {
      return {
        success: false,
        error: "Thiếu thông tin mã định danh bệnh nhân.",
      };
    }

    const page = Math.max(1, input.page || 1);
    const pageSize = Math.min(50, Math.max(1, input.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const supabase = await createClient();

    // Verify patient access
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id")
      .eq("id", patientId)
      .maybeSingle();

    if (patientError || !patient) {
      return {
        success: false,
        error: "Không tìm thấy hồ sơ bệnh nhân.",
      };
    }

    const { data: rows, count, error: queryError } = await supabase
      .from("clinical_notes")
      .select(
        `
        id,
        patient_id,
        clinic_id,
        organization_id,
        treatment_course_id,
        reception_id,
        author_staff_id,
        content,
        created_at,
        updated_at,
        staff:author_staff_id(full_name),
        treatment_courses:treatment_course_id(course_no)
      `,
        { count: "exact" }
      )
      .eq("patient_id", patientId)
      .eq("clinic_id", accessContext.clinic.clinic_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (queryError) {
      console.error("getPatientClinicalNotesPageAction query error:", queryError);
      return {
        success: false,
        error: "Không thể tải danh sách ghi chú lâm sàng.",
      };
    }

    const notes: ClinicalNoteItem[] = ((rows as unknown as Array<Record<string, unknown>>) || []).map((n) => {
      const authorName = (n.staff as { full_name?: string } | null)?.full_name || "Bác sĩ";
      const courseNo = (n.treatment_courses as { course_no?: number } | null)?.course_no || null;
      return {
        id: n.id as string,
        patient_id: n.patient_id as string,
        clinic_id: n.clinic_id as string,
        organization_id: n.organization_id as string,
        treatment_course_id: (n.treatment_course_id as string | null) || null,
        reception_id: (n.reception_id as string | null) || null,
        author_staff_id: n.author_staff_id as string,
        author_name: authorName,
        content: n.content as string,
        created_at: n.created_at as string,
        updated_at: n.updated_at as string,
        course_no: courseNo,
      };
    });

    return {
      success: true,
      notes,
      total: count || 0,
      page,
      pageSize,
    };
  } catch (err: unknown) {
    console.error("getPatientClinicalNotesPageAction error:", err);
    return {
      success: false,
      error: "Đã xảy ra lỗi khi tải ghi chú lâm sàng.",
    };
  }
}

/**
 * Server Action to load clinical notes for a specific treatment course on demand.
 */
export async function getCourseClinicalNotesAction(
  input: GetCourseClinicalNotesInput
): Promise<GetCourseClinicalNotesResult> {
  try {
    const accessContext = await requireApplicationAccessContext();

    const courseId = input.courseId?.trim();
    const patientId = input.patientId?.trim();
    if (!courseId || !patientId) {
      return {
        success: false,
        error: "Thiếu thông tin liệu trình hoặc bệnh nhân.",
      };
    }

    const supabase = await createClient();

    // Verify course belongs to patient & active clinic
    const { data: course, error: courseError } = await supabase
      .from("treatment_courses")
      .select("id, patient_id, clinic_id, course_no")
      .eq("id", courseId)
      .eq("patient_id", patientId)
      .maybeSingle();

    if (courseError || !course) {
      return {
        success: false,
        error: "Không tìm thấy liệu trình điều trị hợp lệ.",
      };
    }

    if (course.clinic_id && course.clinic_id !== accessContext.clinic.clinic_id) {
      return {
        success: false,
        error: "Liệu trình điều trị không thuộc cơ sở y tế hiện tại.",
      };
    }

    const { data: rows, error: queryError } = await supabase
      .from("clinical_notes")
      .select(`
        id,
        patient_id,
        clinic_id,
        organization_id,
        treatment_course_id,
        reception_id,
        author_staff_id,
        content,
        created_at,
        updated_at,
        staff:author_staff_id(full_name)
      `)
      .eq("treatment_course_id", courseId)
      .eq("clinic_id", accessContext.clinic.clinic_id)
      .order("created_at", { ascending: false });

    if (queryError) {
      console.error("getCourseClinicalNotesAction query error:", queryError);
      return {
        success: false,
        error: "Không thể tải ghi chú của liệu trình.",
      };
    }

    const notes: ClinicalNoteItem[] = ((rows as unknown as Array<Record<string, unknown>>) || []).map((n) => {
      const authorName = (n.staff as { full_name?: string } | null)?.full_name || "Bác sĩ";
      return {
        id: n.id as string,
        patient_id: n.patient_id as string,
        clinic_id: n.clinic_id as string,
        organization_id: n.organization_id as string,
        treatment_course_id: (n.treatment_course_id as string | null) || null,
        reception_id: (n.reception_id as string | null) || null,
        author_staff_id: n.author_staff_id as string,
        author_name: authorName,
        content: n.content as string,
        created_at: n.created_at as string,
        updated_at: n.updated_at as string,
        course_no: course.course_no,
      };
    });

    return {
      success: true,
      notes,
    };
  } catch (err: unknown) {
    console.error("getCourseClinicalNotesAction error:", err);
    return {
      success: false,
      error: "Đã xảy ra lỗi khi tải ghi chú liệu trình.",
    };
  }
}
