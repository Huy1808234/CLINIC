"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/supabase-clients/admin";
import {
  processReceptionIntake,
  ReceptionIntakeError,
} from "@/lib/reception/reception-service";
import {
  validateDoctorForClinic,
  InvalidDoctorTargetError,
} from "@/lib/reception/doctor-validator";
import {
  requireActionAuthorization,
  ActionForbiddenError,
} from "@/lib/auth/action-authorization";
import {
  AuthenticationRequiredError,
} from "@/lib/auth/auth-resolver";
import {
  requireCurrentStaff,
  StaffNotLinkedError,
  StaffInactiveError,
} from "@/lib/auth/staff-resolver";
import { StaffNoActiveClinicError } from "@/lib/auth/clinic-resolver";
import { StaffClinicAccessDeniedError } from "@/lib/auth/role-resolver";
import { NoActiveClinicSelectedError } from "@/lib/auth/clinic-context";
import { ZodError } from "zod";
import {
  createReceptionSchema,
  type CreateReceptionInput,
} from "@/lib/validation/reception-schemas";

export async function submitReceptionAction(input: CreateReceptionInput) {
  try {
    // 1. Validate input schema
    const validated = createReceptionSchema.parse(input);

    // 2. Authorize caller at verified active clinic (must hold RECEPTIONIST or ADMIN)
    const authContext = await requireActionAuthorization({
      requiredRoles: ["RECEPTIONIST", "ADMIN"],
    });
    const staff = await requireCurrentStaff();
    const activeClinicId = authContext.access.clinic.clinic_id;
    const actorStaffId = staff.id;
    const actorUserId = staff.user_id;

    const supabase = createAdminClient();

    // 3. Validate target Doctor before ANY intake mutation occurs
    if (validated.doctor_id) {
      await validateDoctorForClinic(supabase, validated.doctor_id, activeClinicId);
    }

    // 4. Privileged atomic intake execution with verified clinic & actor ownership
    const result = await processReceptionIntake(
      supabase,
      validated,
      activeClinicId,
      actorStaffId,
      actorUserId
    );

    revalidatePath("/reception");
    revalidatePath("/schedule");
    revalidatePath("/patients");
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof ReceptionIntakeError) {
      return {
        success: false,
        error: error.message || "Lỗi tiếp nhận bệnh nhân.",
      };
    }
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
        error: "Bạn không có quyền thực hiện tiếp nhận bệnh nhân tại cơ sở này.",
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
        error: error.issues[0]?.message || "Dữ liệu tiếp nhận không hợp lệ.",
      };
    }
    return {
      success: false,
      error: (error as Error).message || "Lỗi tiếp nhận bệnh nhân",
    };
  }
}
