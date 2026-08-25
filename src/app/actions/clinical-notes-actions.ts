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

/**
 * Server Action for Doctors to create a new Doctor Clinical Note on a patient chart.
 *
 * Authorization invariants:
 * 1. Caller must be authenticated with active staff membership at the active clinic.
 * 2. Caller must hold the DOCTOR role at the active clinic.
 * 3. Note is strictly append-only and linked to author_staff_id, clinic_id, organization_id.
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

    // 4. Verify Treatment Course if provided
    let courseNo: number | null = null;
    if (input.treatmentCourseId) {
      const { data: course, error: courseError } = await supabase
        .from("treatment_courses")
        .select("id, course_no, patient_id")
        .eq("id", input.treatmentCourseId)
        .eq("patient_id", patientId)
        .maybeSingle();

      if (courseError || !course) {
        return {
          success: false,
          error: "Liệu trình điều trị không hợp lệ hoặc không thuộc bệnh nhân này.",
        };
      }
      courseNo = course.course_no;
    }

    // 5. Insert Clinical Note row
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

    // 6. Revalidate Patient Chart page
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
