"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { createAdminClient } from "@/supabase-clients/admin";
import {
  requireActionAuthorization,
  ActionForbiddenError,
} from "@/lib/auth/action-authorization";
import {
  AuthenticationRequiredError,
  requireAuthenticatedUser,
} from "@/lib/auth/auth-resolver";
import {
  StaffNotLinkedError,
  StaffInactiveError,
} from "@/lib/auth/staff-resolver";
import { StaffNoActiveClinicError } from "@/lib/auth/clinic-resolver";
import { StaffClinicAccessDeniedError } from "@/lib/auth/role-resolver";
import { NoActiveClinicSelectedError } from "@/lib/auth/clinic-context";
import {
  recordCourseDiagnosisSchema,
  establishInitialTreatmentPlanSchema,
  type RecordCourseDiagnosisInput,
  type EstablishInitialTreatmentPlanInput,
} from "@/lib/validation/clinical-schemas";
import { recordCourseDiagnosis } from "@/lib/clinical/diagnosis-service";
import { establishInitialTreatmentPlan } from "@/lib/clinical/treatment-plan-service";

/**
 * Server Action: Records a formal doctor-authored diagnosis on a treatment course.
 *
 * Security & Governance:
 * 1. Caller MUST hold DOCTOR role at verified active clinic (`requireActionAuthorization({ requiredRoles: ["DOCTOR"] })`).
 * 2. Target Treatment Course MUST belong to the SAME active clinic.
 * 3. Diagnosis Catalog entry MUST be active if specified.
 * 4. Stamped with `diagnosed_by_doctor_id` = verified caller Staff ID.
 */
export async function recordCourseDiagnosisAction(input: RecordCourseDiagnosisInput) {
  try {
    // 1. Validate input schema
    const validated = recordCourseDiagnosisSchema.parse(input);

    // 2. Authorize caller at verified active clinic (MUST hold DOCTOR role)
    const authContext = await requireActionAuthorization({
      requiredRoles: ["DOCTOR"],
    });
    const activeClinicId = authContext.access.clinic.clinic_id;
    const doctorStaffId = authContext.access.staff.id;

    // 3. Privileged clinical execution
    const supabase = createAdminClient();
    const result = await recordCourseDiagnosis(
      supabase,
      validated,
      activeClinicId,
      doctorStaffId
    );

    revalidatePath("/patients");
    revalidatePath("/schedule");
    return { success: true, data: result };
  } catch (error: unknown) {
    if (
      error instanceof ActionForbiddenError ||
      error instanceof StaffClinicAccessDeniedError
    ) {
      return {
        success: false,
        error: "Bạn không có quyền thực hiện chẩn đoán tại cơ sở này.",
      };
    }
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof StaffNotLinkedError ||
      error instanceof StaffInactiveError ||
      error instanceof StaffNoActiveClinicError ||
      error instanceof NoActiveClinicSelectedError
    ) {
      return {
        success: false,
        error: "Yêu cầu đăng nhập và chọn cơ sở làm việc hợp lệ.",
      };
    }
    if (error instanceof ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Dữ liệu chẩn đoán không hợp lệ.",
      };
    }
    return {
      success: false,
      error: (error as Error).message || "Lỗi ghi nhận chẩn đoán.",
    };
  }
}

/**
 * Server Action: Establishes the INITIAL Doctor treatment plan for a treatment course.
 *
 * Security & Governance:
 * 1. Caller MUST hold DOCTOR role at verified active clinic (`requireActionAuthorization({ requiredRoles: ["DOCTOR"] })`).
 * 2. Target Treatment Course MUST belong to the SAME active clinic.
 * 3. Atomic compare-and-set: Only sets plan if `planned_session_count IS NULL`.
 * 4. Stamped with `planned_by_doctor_id` = verified caller Staff ID and `planned_at` = trusted timestamp.
 */
export async function establishInitialTreatmentPlanAction(input: EstablishInitialTreatmentPlanInput) {
  try {
    // 1. Validate input schema
    const validated = establishInitialTreatmentPlanSchema.parse(input);

    // 2. Authorize caller at verified active clinic (MUST hold DOCTOR role)
    const authContext = await requireActionAuthorization({
      requiredRoles: ["DOCTOR"],
    });
    const authUser = await requireAuthenticatedUser();
    const activeClinicId = authContext.access.clinic.clinic_id;
    const doctorStaffId = authContext.access.staff.id;
    const authUserId = authUser.id;

    // 3. Privileged clinical execution
    const supabase = createAdminClient();
    const result = await establishInitialTreatmentPlan(
      supabase,
      validated,
      activeClinicId,
      doctorStaffId,
      authUserId
    );

    revalidatePath("/patients");
    revalidatePath("/schedule");
    return { success: true, data: result };
  } catch (error: unknown) {
    if (
      error instanceof ActionForbiddenError ||
      error instanceof StaffClinicAccessDeniedError
    ) {
      return {
        success: false,
        error: "Bạn không có quyền thiết lập kế hoạch điều trị tại cơ sở này.",
      };
    }
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof StaffNotLinkedError ||
      error instanceof StaffInactiveError ||
      error instanceof StaffNoActiveClinicError ||
      error instanceof NoActiveClinicSelectedError
    ) {
      return {
        success: false,
        error: "Yêu cầu đăng nhập và chọn cơ sở làm việc hợp lệ.",
      };
    }
    if (error instanceof ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Dữ liệu kế hoạch điều trị không hợp lệ.",
      };
    }
    return {
      success: false,
      error: (error as Error).message || "Lỗi thiết lập kế hoạch điều trị.",
    };
  }
}

