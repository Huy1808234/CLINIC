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
  orderCourseServicesSchema,
  saveTreatmentSessionPlanSchema,
  type RecordCourseDiagnosisInput,
  type EstablishInitialTreatmentPlanInput,
  type OrderCourseServicesInput,
  type SaveTreatmentSessionPlanInput,
} from "@/lib/validation/clinical-schemas";
import { recordCourseDiagnosis } from "@/lib/clinical/diagnosis-service";
import { establishInitialTreatmentPlan } from "@/lib/clinical/treatment-plan-service";
import { orderCourseServices } from "@/lib/clinical/service-order-service";
import { saveTreatmentSessionPlan } from "@/lib/clinical/session-plan-service";

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

/**
 * Server Action: Records doctor-ordered clinical services (DVKT THỰC TẾ) on a treatment course.
 *
 * Security & Governance:
 * 1. Caller MUST hold DOCTOR role at verified active clinic (`requireActionAuthorization({ requiredRoles: ["DOCTOR"] })`).
 * 2. Target Treatment Course MUST belong to the SAME active clinic.
 * 3. Services must come from active `service_catalog` entries.
 * 4. Stamped with `ordered_by_doctor_id` = verified caller Staff ID.
 */
export async function orderCourseServicesAction(input: OrderCourseServicesInput) {
  try {
    // 1. Validate input schema
    const validated = orderCourseServicesSchema.parse(input);

    // 2. Authorize caller at verified active clinic (MUST hold DOCTOR role)
    const authContext = await requireActionAuthorization({
      requiredRoles: ["DOCTOR"],
    });
    const activeClinicId = authContext.access.clinic.clinic_id;
    const doctorStaffId = authContext.access.staff.id;

    // 3. Privileged clinical execution
    const supabase = createAdminClient();
    const result = await orderCourseServices(
      supabase,
      validated,
      activeClinicId,
      doctorStaffId
    );

    revalidatePath("/reception");
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
        error: "Bạn không có quyền chỉ định dịch vụ kỹ thuật tại cơ sở này.",
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
        error: error.issues[0]?.message || "Dữ liệu chỉ định dịch vụ không hợp lệ.",
      };
    }
    return {
      success: false,
      error: (error as Error).message || "Lỗi chỉ định dịch vụ kỹ thuật.",
    };
  }
}

/**
 * Server Action: Saves an explicit treatment-session occurrence plan with ordered services.
 *
 * Security & Governance:
 * 1. Caller MUST hold DOCTOR role at verified active clinic (`requireActionAuthorization({ requiredRoles: ["DOCTOR"] })`).
 * 2. Target Treatment Course MUST belong to the SAME active clinic.
 * 3. Atomic replace under FOR UPDATE lock on treatment_courses.
 * 4. Stamped with `planned_by_doctor_id` = verified caller Doctor Staff ID.
 */
export async function saveTreatmentSessionPlanAction(input: SaveTreatmentSessionPlanInput) {
  try {
    // 1. Validate input schema
    const validated = saveTreatmentSessionPlanSchema.parse(input);

    // 2. Authorize caller at verified active clinic (MUST hold DOCTOR role)
    const authContext = await requireActionAuthorization({
      requiredRoles: ["DOCTOR"],
    });
    const authUser = await requireAuthenticatedUser();
    const activeClinicId = authContext.access.clinic.clinic_id;
    const doctorStaffId = authContext.access.staff.id;
    const authUserId = authUser.id;

    // 3. Privileged clinical execution via atomic DB RPC
    const supabase = createAdminClient();
    const result = await saveTreatmentSessionPlan(
      supabase,
      validated,
      activeClinicId,
      doctorStaffId,
      authUserId
    );

    revalidatePath("/reception");
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
        error: "Bạn không có quyền lập kế hoạch điều trị theo buổi tại cơ sở này.",
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
        error: error.issues[0]?.message || "Dữ liệu kế hoạch buổi điều trị không hợp lệ.",
      };
    }
    return {
      success: false,
      error: (error as Error).message || "Lỗi lưu kế hoạch buổi điều trị.",
    };
  }
}

import type { TreatmentSessionPlanItem } from "@/types/treatment";

/**
 * Server Action: Fetches explicit occurrence plans for a course with active clinic verification.
 */
export async function getCourseSessionPlansAction(treatmentCourseId: string) {
  try {
    const authContext = await requireActionAuthorization({
      requiredRoles: ["DOCTOR", "ADMIN", "RECEPTIONIST", "TECHNICIAN", "Y_SI", "CSKH", "MANAGER"],
    });
    const activeClinicId = authContext.access.clinic.clinic_id;

    const supabase = createAdminClient();

    // Verify course belongs to active clinic
    const { data: course, error: courseErr } = await supabase
      .from("treatment_courses")
      .select("id, clinic_id, planned_session_count")
      .eq("id", treatmentCourseId)
      .single();

    if (courseErr || !course || course.clinic_id !== activeClinicId) {
      return { success: false, error: "Liệu trình không thuộc cơ sở làm việc hiện tại." };
    }

    const { data: plans, error: plansErr } = await supabase
      .from("treatment_session_plans")
      .select(`
        id,
        treatment_course_id,
        session_number,
        planned_by_doctor_id,
        notes,
        created_at,
        updated_at,
        treatment_session_plan_services (
          id,
          service_id,
          sequence_no,
          notes,
          service_catalog (
            id,
            service_code,
            service_name,
            default_duration_minutes
          )
        )
      `)
      .eq("treatment_course_id", treatmentCourseId)
      .order("session_number", { ascending: true });

    if (plansErr) {
      return { success: false, error: "Lỗi tải kế hoạch điều trị theo buổi." };
    }

    const typedPlans = (plans || []) as unknown as Array<{
      id: string;
      treatment_course_id: string;
      session_number: number;
      planned_by_doctor_id: string;
      notes: string | null;
      created_at: string;
      updated_at: string;
      treatment_session_plan_services: Array<{
        id: string;
        service_id: string;
        sequence_no: number;
        notes: string | null;
        service_catalog: {
          id: string;
          service_code: string;
          service_name: string;
          default_duration_minutes: number;
        } | null;
      }>;
    }>;

    const formattedPlans: TreatmentSessionPlanItem[] = typedPlans.map((p) => ({
      id: p.id,
      treatment_course_id: p.treatment_course_id,
      session_number: p.session_number,
      planned_by_doctor_id: p.planned_by_doctor_id,
      notes: p.notes,
      created_at: p.created_at,
      updated_at: p.updated_at,
      services: (p.treatment_session_plan_services || [])
        .sort((a, b) => a.sequence_no - b.sequence_no)
        .map((s) => ({
          id: s.id,
          service_id: s.service_id,
          service_code: s.service_catalog?.service_code || "",
          service_name: s.service_catalog?.service_name || "",
          sequence_no: s.sequence_no,
          notes: s.notes,
        })),
    }));

    return {
      success: true,
      data: {
        planned_session_count: course.planned_session_count,
        plans: formattedPlans,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: (err as Error).message || "Lỗi tải kế hoạch buổi điều trị.",
    };
  }
}

