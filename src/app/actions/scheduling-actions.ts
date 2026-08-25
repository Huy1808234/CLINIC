"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { createAdminClient } from "@/supabase-clients/admin";
import type { ClinicRoleCode } from "@/types/clinic";
import {
  requireActionAuthorization,
  ActionForbiddenError,
} from "@/lib/auth/action-authorization";
import { requireApplicationAccessContext } from "@/lib/auth/application-access";
import {
  AuthenticationRequiredError,
  requireAuthenticatedUser,
} from "@/lib/auth/auth-resolver";
import {
  StaffNotLinkedError,
  StaffInactiveError,
} from "@/lib/auth/staff-resolver";
import { StaffNoActiveClinicError } from "@/lib/auth/clinic-resolver";
import {
  requireCurrentStaffRolesForClinic,
  StaffClinicAccessDeniedError,
} from "@/lib/auth/role-resolver";
import { NoActiveClinicSelectedError } from "@/lib/auth/clinic-context";
import {
  validateDoctorForClinic,
  InvalidDoctorTargetError,
} from "@/lib/reception/doctor-validator";
import { executeAutoSchedule } from "@/lib/scheduling/auto-scheduler";
import { rescheduleAppointment, updateAppointmentStatus } from "@/lib/scheduling/appointment-service";
import type { AutoScheduleInput } from "@/types/schedule";
import {
  autoScheduleSchema,
  rescheduleAppointmentSchema,
  updateAppointmentStatusSchema,
  type RescheduleAppointmentInput,
  type UpdateAppointmentStatusInput,
} from "@/lib/validation/scheduling-schemas";

export async function autoScheduleAction(input: AutoScheduleInput) {
  try {
    // 1. Validate input schema
    const validated = autoScheduleSchema.parse(input);

    // 2. Authorize caller at verified active clinic (must hold RECEPTIONIST or ADMIN)
    const authContext = await requireActionAuthorization({
      requiredRoles: ["RECEPTIONIST", "ADMIN"],
    });
    const activeClinicId = authContext.access.clinic.clinic_id;

    const supabase = createAdminClient();

    // 3. Verify target Treatment Course exists and belongs to active clinic
    const { data: course, error: courseErr } = await supabase
      .from("treatment_courses")
      .select("id, clinic_id")
      .eq("id", validated.treatment_course_id)
      .maybeSingle();

    if (courseErr || !course || !course.clinic_id || course.clinic_id !== activeClinicId) {
      return {
        success: false,
        error: "Không tìm thấy liệu trình phù hợp tại cơ sở hiện tại.",
      };
    }

    // 4. Verify target Doctor is an active DOCTOR at active clinic
    await validateDoctorForClinic(supabase, validated.doctor_id, activeClinicId);

    // 5. Privileged auto scheduling execution
    const result = await executeAutoSchedule(supabase, validated);
    revalidatePath("/schedule");
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof InvalidDoctorTargetError) {
      return {
        success: false,
        error: error.message || "Bác sĩ được chọn không hợp lệ hoặc không được phân công tại cơ sở hiện tại.",
      };
    }
    if (
      error instanceof ActionForbiddenError ||
      error instanceof StaffClinicAccessDeniedError
    ) {
      return {
        success: false,
        error: "Bạn không có quyền thực hiện xếp lịch tại cơ sở này.",
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
        error: error.issues[0]?.message || "Dữ liệu xếp lịch không hợp lệ.",
      };
    }
    return {
      success: false,
      error: (error as Error).message || "Lỗi xếp lịch tự động",
    };
  }
}

export async function rescheduleAppointmentAction(input: RescheduleAppointmentInput) {
  try {
    // 1. Validate input schema
    const validated = rescheduleAppointmentSchema.parse(input);

    // 2. Authorize caller at verified active clinic (must hold RECEPTIONIST or ADMIN)
    const authContext = await requireActionAuthorization({
      requiredRoles: ["RECEPTIONIST", "ADMIN"],
    });
    const activeClinicId = authContext.access.clinic.clinic_id;

    const supabase = createAdminClient();

    // 3. Verify target Appointment exists and belongs to active clinic
    const { data: appt, error: apptErr } = await supabase
      .from("appointments")
      .select("id, treatment_course_id")
      .eq("id", validated.appointment_id)
      .maybeSingle();

    if (apptErr || !appt || !appt.treatment_course_id) {
      return {
        success: false,
        error: "Không tìm thấy lịch hẹn phù hợp tại cơ sở hiện tại.",
      };
    }

    const { data: course, error: courseErr } = await supabase
      .from("treatment_courses")
      .select("id, clinic_id")
      .eq("id", appt.treatment_course_id)
      .maybeSingle();

    if (courseErr || !course || !course.clinic_id || course.clinic_id !== activeClinicId) {
      return {
        success: false,
        error: "Không tìm thấy lịch hẹn phù hợp tại cơ sở hiện tại.",
      };
    }

    // 4. If new doctor is specified, verify target Doctor is an active DOCTOR at active clinic
    if (validated.new_doctor_id) {
      await validateDoctorForClinic(supabase, validated.new_doctor_id, activeClinicId);
    }

    // 5. Privileged rescheduling execution
    const user = await requireAuthenticatedUser();
    const result = await rescheduleAppointment(supabase, validated, user.id);
    revalidatePath("/schedule");
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof InvalidDoctorTargetError) {
      return {
        success: false,
        error: error.message || "Bác sĩ được chọn không hợp lệ hoặc không được phân công tại cơ sở hiện tại.",
      };
    }
    if (
      error instanceof ActionForbiddenError ||
      error instanceof StaffClinicAccessDeniedError
    ) {
      return {
        success: false,
        error: "Bạn không có quyền thực hiện đổi lịch hẹn tại cơ sở này.",
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
        error: error.issues[0]?.message || "Dữ liệu đổi lịch hẹn không hợp lệ.",
      };
    }
    return {
      success: false,
      error: (error as Error).message || "Lỗi đổi lịch hẹn",
    };
  }
}

const ALLOWED_STATUS_TRANSITIONS: Record<
  string,
  Array<{ targetStatus: string; allowedRoles: ClinicRoleCode[] }>
> = {
  PLANNED: [
    {
      targetStatus: "CHECKED_IN",
      allowedRoles: ["RECEPTIONIST", "ADMIN"],
    },
    {
      // NO_SHOW only valid from PLANNED (patient never arrived)
      // RECEPTIONIST and ADMIN only — Doctor does not mark no-show
      targetStatus: "NO_SHOW",
      allowedRoles: ["RECEPTIONIST", "ADMIN"],
    },
    {
      targetStatus: "CANCELLED",
      allowedRoles: ["RECEPTIONIST", "ADMIN"],
    },
  ],
  CHECKED_IN: [
    {
      targetStatus: "IN_TREATMENT",
      allowedRoles: ["DOCTOR", "TECHNICIAN", "Y_SI"],
    },
    // CHECKED_IN -> NO_SHOW is FORBIDDEN: patient has already arrived (checked in)
    // NO_SHOW semantics = patient did not arrive; not an attendance correction mechanism
    {
      targetStatus: "CANCELLED",
      allowedRoles: ["RECEPTIONIST", "ADMIN"],
    },
  ],
  IN_TREATMENT: [
    {
      targetStatus: "COMPLETED",
      allowedRoles: ["DOCTOR", "TECHNICIAN", "Y_SI"],
    },
  ],
};

const RPC_ERROR_MAP: Record<string, string> = {
  APPOINTMENT_NOT_FOUND: "Không tìm thấy lịch hẹn phù hợp.",
  INVALID_APPOINTMENT_STATE: "Trạng thái lịch hẹn không còn phù hợp để hoàn tất điều trị.",
  INCONSISTENT_COMPLETION_STATE: "Dữ liệu buổi điều trị không nhất quán. Vui lòng liên hệ quản trị viên.",
  COURSE_NOT_FOUND: "Không tìm thấy liệu trình điều trị.",
  COURSE_NOT_ACTIVE: "Liệu trình hiện không ở trạng thái có thể hoàn tất buổi điều trị.",
  PLAN_NOT_ESTABLISHED: "Bác sĩ chưa thiết lập kế hoạch điều trị cho liệu trình này.",
  PLAN_ALREADY_COMPLETED: "Liệu trình đã đủ số buổi theo kế hoạch.",
  INVALID_ACTOR: "Thông tin tài khoản thực hiện không hợp lệ.",
};

export async function updateAppointmentStatusAction(input: UpdateAppointmentStatusInput) {
  try {
    // 1. Validate input schema
    const validated = updateAppointmentStatusSchema.parse(input);

    // 2. Resolve verified application access context (Auth user -> active Staff -> active Clinic)
    const accessContext = await requireApplicationAccessContext();
    const activeClinicId = accessContext.clinic.clinic_id;

    const supabase = createAdminClient();

    // 3. Verify target Appointment exists and belongs to active clinic
    const { data: appt, error: apptErr } = await supabase
      .from("appointments")
      .select("id, status, treatment_course_id")
      .eq("id", validated.appointment_id)
      .maybeSingle();

    if (apptErr || !appt || !appt.treatment_course_id) {
      return {
        success: false,
        error: "Không tìm thấy lịch hẹn phù hợp tại cơ sở hiện tại.",
      };
    }

    const { data: course, error: courseErr } = await supabase
      .from("treatment_courses")
      .select("id, clinic_id")
      .eq("id", appt.treatment_course_id)
      .maybeSingle();

    if (courseErr || !course || !course.clinic_id || course.clinic_id !== activeClinicId) {
      return {
        success: false,
        error: "Không tìm thấy lịch hẹn phù hợp tại cơ sở hiện tại.",
      };
    }

    // 4. Validate transition graph from current status to requested status
    const currentStatus = appt.status;
    const requestedStatus = validated.status;
    const availableTransitions = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
    const transitionRule = availableTransitions.find((t) => t.targetStatus === requestedStatus);

    if (!transitionRule) {
      return {
        success: false,
        error: `Chuyển đổi trạng thái không hợp lệ: không thể chuyển từ ${currentStatus} sang ${requestedStatus}.`,
      };
    }

    // 5. Authorize caller clinic roles for this specific transition
    const roleContext = await requireCurrentStaffRolesForClinic(activeClinicId);
    const hasAuthorizedRole = transitionRule.allowedRoles.some((role) =>
      roleContext.roles.includes(role)
    );

    if (!hasAuthorizedRole) {
      return {
        success: false,
        error: "Bạn không có quyền thực hiện chuyển đổi trạng thái này tại cơ sở hiện tại.",
      };
    }

    // 6. Privileged execution
    if (requestedStatus === "COMPLETED") {
      // Clinical completion: must use atomic complete_appointment_treatment_session RPC
      const user = await requireAuthenticatedUser();
      const { data: rpcRes, error: rpcErr } = await supabase.rpc(
        "complete_appointment_treatment_session",
        {
          p_appointment_id: validated.appointment_id,
          p_actor_staff_id: accessContext.staff.id,
          p_actor_user_id: user.id,
          p_clinical_note: validated.notes || null,
        }
      );

      if (rpcErr || !rpcRes) {
        return {
          success: false,
          error: "Lỗi hệ thống khi hoàn tất buổi điều trị. Vui lòng thử lại.",
        };
      }

      const result = rpcRes as {
        success: boolean;
        idempotent?: boolean;
        error_code?: string;
        message?: string;
        appointment_id?: string;
        treatment_course_id?: string;
        treatment_session_id?: string;
        completed_session_count?: number;
        planned_session_count?: number;
        course_status?: string;
      };

      if (!result.success) {
        const errorMsg =
          (result.error_code && RPC_ERROR_MAP[result.error_code]) ||
          result.message ||
          "Lỗi hoàn tất buổi điều trị.";
        return {
          success: false,
          error: errorMsg,
        };
      }

      revalidatePath("/schedule");
      revalidatePath("/reception");
      return { success: true, data: result };
    }

    // Non-completion lightweight transitions (e.g. PLANNED -> CHECKED_IN, CHECKED_IN -> IN_TREATMENT, NO_SHOW, CANCELLED)
    const user = await requireAuthenticatedUser();
    const result = await updateAppointmentStatus(
      supabase,
      validated,
      accessContext.staff.id,
      user.id
    );
    revalidatePath("/schedule");
    revalidatePath("/reception");
    return { success: true, data: result };
  } catch (error: unknown) {
    if (
      error instanceof ActionForbiddenError ||
      error instanceof StaffClinicAccessDeniedError
    ) {
      return {
        success: false,
        error: "Bạn không có quyền thực hiện thao tác này tại cơ sở hiện tại.",
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
        error: error.issues[0]?.message || "Dữ liệu trạng thái không hợp lệ.",
      };
    }
    return {
      success: false,
      error: (error as Error).message || "Lỗi cập nhật trạng thái lịch hẹn",
    };
  }
}
