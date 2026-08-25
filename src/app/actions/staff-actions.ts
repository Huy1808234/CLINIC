"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/supabase-clients/admin";
import {
  createStaffSchema,
  updateStaffSchema,
  assignClinicMembershipSchema,
  provisionStaffAuthSchema,
  adminResetStaffPasswordSchema,
  resetStaffPasswordByAdminSchema,
  provisionStaffDirectCredentialsSchema,
  assignStaffLoginUsernameSchema,
  type CreateStaffInput,
  type UpdateStaffInput,
  type AssignClinicMembershipInput,
  type ProvisionStaffAuthInput,
  type AdminResetStaffPasswordInput,
  type ResetStaffPasswordByAdminInput,
  type ProvisionStaffDirectCredentialsInput,
  type AssignStaffLoginUsernameInput,
} from "@/lib/validation/staff-schemas";
import {
  requireTargetClinicRole,
  requireActionAuthorization,
  ActionForbiddenError,
} from "@/lib/auth/action-authorization";
import { StaffClinicAccessDeniedError } from "@/lib/auth/role-resolver";
import {
  AuthenticationRequiredError,
  requireAuthenticatedUser,
} from "@/lib/auth/auth-resolver";
import {
  requireCurrentStaff,
  StaffNotLinkedError,
  StaffInactiveError,
} from "@/lib/auth/staff-resolver";
import {
  provisionStaffAuthAccount,
  adminResetStaffPassword,
  provisionStaffDirectCredentials,
  assignStaffLoginUsername,
  StaffAlreadyLinkedError,
  AuthEmailAlreadyExistsError,
  TargetStaffNotFoundError,
  TargetStaffInactiveError,
  TargetStaffNotLinkedError,
  TargetStaffClinicAccessDeniedError,
  UnauthorizedAdminError,
  InvalidActorError,
  StaffLinkFailedError,
  ProvisionCompensationFailedError,
  StaffLoginEmailRequiredError,
  StaffLoginEmailInvalidError,
  LoginUsernameAlreadyExistsError,
  InvalidLoginUsernameError,
  TargetUsernameAlreadySetError,
  LoginUsernameAlreadyAssignedError,
  InvalidPasswordError,
  ResetStateFinalizationFailedError,
} from "@/lib/staff/staff-auth-service";
import { ZodError } from "zod";

const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export async function createStaffAction(input: CreateStaffInput) {
  try {
    // 1. Validate input schema (enforces at least 1 clinic assignment)
    const validated = createStaffSchema.parse(input);

    if (!validated.clinic_assignments || validated.clinic_assignments.length === 0) {
      return {
        success: false,
        error: "Nhân viên mới phải được phân công ít nhất một cơ sở.",
      };
    }

    // 2. Authorize caller: Caller MUST hold ADMIN at EVERY target clinic assigned
    const uniqueClinicIds = Array.from(
      new Set(validated.clinic_assignments.map((a) => a.clinic_id))
    );
    for (const clinicId of uniqueClinicIds) {
      await requireTargetClinicRole(clinicId, ["ADMIN"]);
    }

    // 3. Privileged mutation via service-role client (executed ONLY after ALL authorizations pass)
    const supabase = createAdminClient();

    // 3a. Insert into staff
    const { data: staff, error: staffErr } = await supabase
      .from("staff")
      .insert({
        staff_code: validated.staff_code,
        full_name: validated.full_name,
        role_type: validated.role_type,
        phone: validated.phone || null,
        email: validated.email || null,
        is_active: validated.is_active,
      })
      .select()
      .single();

    if (staffErr || !staff) {
      throw new Error(staffErr?.message || "Lỗi tạo hồ sơ nhân viên");
    }

    // 3b. Insert clinic assignments
    for (const assign of validated.clinic_assignments) {
      const { data: mem, error: memErr } = await supabase
        .from("staff_clinic_memberships")
        .insert({
          staff_id: staff.id,
          clinic_id: assign.clinic_id,
          is_primary: assign.is_primary,
          is_active: true,
          joined_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (memErr || !mem) {
        console.error("Error creating membership:", memErr);
        continue;
      }

      // Insert roles
      const roleRows = assign.roles.map((role_code) => ({
        staff_clinic_membership_id: mem.id,
        role_code,
      }));

      const { error: rolesErr } = await supabase
        .from("staff_clinic_roles")
        .insert(roleRows);

      if (rolesErr) {
        console.error("Error creating roles:", rolesErr);
      }
    }

    revalidatePath("/staff");
    return { success: true, data: staff };
  } catch (error: unknown) {
    if (
      error instanceof ActionForbiddenError ||
      error instanceof StaffClinicAccessDeniedError
    ) {
      return {
        success: false,
        error: "Bạn không có quyền tạo nhân viên tại cơ sở này.",
      };
    }
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof StaffNotLinkedError ||
      error instanceof StaffInactiveError
    ) {
      return {
        success: false,
        error: "Yêu cầu tài khoản nhân viên hợp lệ.",
      };
    }
    return {
      success: false,
      error: (error as Error).message || "Lỗi tạo nhân viên",
    };
  }
}

export async function updateStaffAction(input: UpdateStaffInput) {
  try {
    // 1. Parse and validate input schema (does NOT accept is_active)
    const validated = updateStaffSchema.parse(input);

    const supabase = createAdminClient();

    // 2. Verify target staff exists
    const { data: targetStaff, error: targetStaffErr } = await supabase
      .from("staff")
      .select("id")
      .eq("id", validated.id)
      .maybeSingle();

    if (targetStaffErr || !targetStaff) {
      throw new Error("Không tìm thấy hồ sơ nhân viên cần cập nhật.");
    }

    // 3. Resolve target staff's ACTIVE clinic memberships
    const { data: activeMemberships, error: memErr } = await supabase
      .from("staff_clinic_memberships")
      .select("clinic_id")
      .eq("staff_id", validated.id)
      .eq("is_active", true);

    if (memErr) {
      throw new Error("Lỗi xác thực danh sách cơ sở của nhân viên.");
    }

    const activeClinicIds = Array.from(
      new Set((activeMemberships || []).map((m) => m.clinic_id))
    );

    // If target staff has 0 active memberships, deny master update
    if (activeClinicIds.length === 0) {
      return {
        success: false,
        error: "Không thể cập nhật thông tin nhân viên chưa được phân công cơ sở hoạt động.",
      };
    }

    // 4. Authorize caller: Caller MUST hold ADMIN at EVERY active clinic of target staff
    for (const clinicId of activeClinicIds) {
      await requireTargetClinicRole(clinicId, ["ADMIN"]);
    }

    // 5. Privileged mutation (MUTATES ONLY PROFILE FIELDS, NEVER is_active)
    const updatePayload: import("@/types/database").Database["public"]["Tables"]["staff"]["Update"] = {};
    if (validated.full_name !== undefined) updatePayload.full_name = validated.full_name;
    if (validated.role_type !== undefined) updatePayload.role_type = validated.role_type;
    if (validated.phone !== undefined) updatePayload.phone = validated.phone;
    if (validated.email !== undefined) updatePayload.email = validated.email;

    const { data: staff, error: staffErr } = await supabase
      .from("staff")
      .update(updatePayload)
      .eq("id", validated.id)
      .select()
      .single();

    if (staffErr || !staff) {
      throw new Error(staffErr?.message || "Lỗi cập nhật nhân viên");
    }

    revalidatePath("/staff");
    return { success: true, data: staff };
  } catch (error: unknown) {
    if (
      error instanceof ActionForbiddenError ||
      error instanceof StaffClinicAccessDeniedError
    ) {
      return {
        success: false,
        error: "Bạn không có quyền cập nhật thông tin nhân viên này.",
      };
    }
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof StaffNotLinkedError ||
      error instanceof StaffInactiveError
    ) {
      return {
        success: false,
        error: "Yêu cầu tài khoản nhân viên hợp lệ.",
      };
    }
    return {
      success: false,
      error: (error as Error).message || "Lỗi cập nhật nhân viên",
    };
  }
}

export async function assignStaffClinicAction(input: AssignClinicMembershipInput) {
  try {
    // 1. Validate input schema (checks UUIDs and valid role enum array)
    const validated = assignClinicMembershipSchema.parse(input);

    // 2. Resolve current authenticated caller staff
    const callerStaff = await requireCurrentStaff();

    // 3. Enforce target clinic authorization (caller MUST hold ADMIN at target clinic)
    await requireTargetClinicRole(validated.clinic_id, ["ADMIN"]);

    const supabase = createAdminClient();

    // 4. Prevent self-ADMIN role removal: An admin cannot remove their own ADMIN role at target clinic
    if (callerStaff.id === validated.staff_id && !validated.roles.includes("ADMIN")) {
      const { data: callerMem } = await supabase
        .from("staff_clinic_memberships")
        .select("id, is_active")
        .eq("staff_id", callerStaff.id)
        .eq("clinic_id", validated.clinic_id)
        .maybeSingle();

      if (callerMem && callerMem.is_active) {
        const { data: callerRoles } = await supabase
          .from("staff_clinic_roles")
          .select("role_code")
          .eq("staff_clinic_membership_id", callerMem.id);

        const hasAdmin = (callerRoles || []).some((r) => r.role_code === "ADMIN");
        if (hasAdmin) {
          return {
            success: false,
            error: "Bạn không thể tự gỡ vai trò Quản trị viên (ADMIN) của chính mình tại cơ sở này.",
          };
        }
      }
    }

    // 5. Atomic governance mutation via service-role RPC (enforces last-usable-ADMIN invariant, upserts membership & replaces roles)
    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      "assign_staff_clinic_roles_with_admin_guard",
      {
        p_staff_id: validated.staff_id,
        p_clinic_id: validated.clinic_id,
        p_roles: validated.roles,
        p_is_primary: validated.is_primary,
      }
    );

    if (rpcErr) {
      throw new Error(rpcErr.message || "Lỗi phân công cơ sở");
    }

    const rpcResult = rpcData as {
      success: boolean;
      membership_id?: string;
      error_code?: string;
      message?: string;
      data?: {
        staff_id: string;
        clinic_id: string;
        membership_id: string;
        roles: string[];
      };
    } | null;

    if (!rpcResult || !rpcResult.success) {
      if (rpcResult?.error_code === "LAST_USABLE_ADMIN") {
        return {
          success: false,
          error:
            rpcResult.message ||
            "Không thể gỡ vai trò Quản trị viên (ADMIN) vì đây là Quản trị viên đang hoạt động duy nhất của cơ sở này.",
        };
      }
      if (rpcResult?.error_code === "TARGET_STAFF_NOT_FOUND") {
        return {
          success: false,
          error: rpcResult.message || "Không tìm thấy hồ sơ nhân viên cần phân công.",
        };
      }
      if (rpcResult?.error_code === "TARGET_CLINIC_NOT_FOUND") {
        return {
          success: false,
          error: rpcResult.message || "Không tìm thấy cơ sở phòng khám cần phân công.",
        };
      }
      if (rpcResult?.error_code === "INVALID_ROLES") {
        return {
          success: false,
          error: rpcResult.message || "Vui lòng chọn ít nhất một vai trò hợp lệ.",
        };
      }
      return {
        success: false,
        error: rpcResult?.message || "Lỗi phân công cơ sở",
      };
    }

    revalidatePath("/staff");
    return { success: true, membershipId: rpcResult.membership_id };
  } catch (error: unknown) {
    if (
      error instanceof ActionForbiddenError ||
      error instanceof StaffClinicAccessDeniedError
    ) {
      return {
        success: false,
        error: "Bạn không có quyền quản lý nhân sự tại cơ sở này.",
      };
    }
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof StaffNotLinkedError ||
      error instanceof StaffInactiveError
    ) {
      return {
        success: false,
        error: "Yêu cầu tài khoản nhân viên hợp lệ.",
      };
    }
    return {
      success: false,
      error: (error as Error).message || "Lỗi phân công cơ sở",
    };
  }
}

export async function toggleStaffStatusAction(staffId: string, isActive: boolean) {
  try {
    // 1. Validate UUID format
    if (!staffId || !uuidPattern.test(staffId)) {
      return {
        success: false,
        error: "Mã nhân viên không hợp lệ.",
      };
    }

    // 2. Resolve current caller staff
    const callerStaff = await requireCurrentStaff();

    // 3. Prevent self-deactivation
    if (isActive === false && callerStaff.id === staffId) {
      return {
        success: false,
        error: "Bạn không thể tự khóa tài khoản nhân viên của chính mình.",
      };
    }

    const supabase = createAdminClient();

    // 4. Verify target staff exists
    const { data: targetStaff, error: targetStaffErr } = await supabase
      .from("staff")
      .select("id")
      .eq("id", staffId)
      .maybeSingle();

    if (targetStaffErr || !targetStaff) {
      return {
        success: false,
        error: "Không tìm thấy hồ sơ nhân viên cần cập nhật trạng thái.",
      };
    }

    // 5. Resolve target staff's ACTIVE clinic memberships
    const { data: activeMemberships, error: memErr } = await supabase
      .from("staff_clinic_memberships")
      .select("clinic_id")
      .eq("staff_id", staffId)
      .eq("is_active", true);

    if (memErr) {
      throw new Error("Lỗi xác thực danh sách cơ sở của nhân viên.");
    }

    const activeClinicIds = Array.from(
      new Set((activeMemberships || []).map((m) => m.clinic_id))
    );

    // If target staff has 0 active memberships, deny status toggle
    if (activeClinicIds.length === 0) {
      return {
        success: false,
        error: "Không thể cập nhật trạng thái nhân viên chưa được phân công cơ sở hoạt động.",
      };
    }

    // 6. Authorize caller: Caller MUST hold ADMIN at EVERY active clinic of target staff
    for (const clinicId of activeClinicIds) {
      await requireTargetClinicRole(clinicId, ["ADMIN"]);
    }

    // 7. Atomic governance mutation via service-role RPC (enforces last-usable-ADMIN invariant & updates is_active)
    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      "set_staff_active_with_admin_guard",
      {
        p_staff_id: staffId,
        p_is_active: isActive,
      }
    );

    if (rpcErr) {
      throw new Error(rpcErr.message || "Lỗi cập nhật trạng thái nhân viên");
    }

    const rpcResult = rpcData as {
      success: boolean;
      error_code?: string;
      message?: string;
      data?: { id: string; is_active: boolean };
    } | null;

    if (!rpcResult || !rpcResult.success) {
      if (rpcResult?.error_code === "LAST_USABLE_ADMIN") {
        return {
          success: false,
          error:
            rpcResult.message ||
            "Không thể khóa nhân viên vì đây là Quản trị viên (ADMIN) đang hoạt động duy nhất của một hoặc nhiều cơ sở.",
        };
      }
      if (rpcResult?.error_code === "TARGET_STAFF_NOT_FOUND") {
        return {
          success: false,
          error: rpcResult.message || "Không tìm thấy hồ sơ nhân viên.",
        };
      }
      return {
        success: false,
        error: rpcResult?.message || "Lỗi cập nhật trạng thái nhân viên",
      };
    }

    revalidatePath("/staff");
    return { success: true };
  } catch (error: unknown) {
    if (
      error instanceof ActionForbiddenError ||
      error instanceof StaffClinicAccessDeniedError
    ) {
      return {
        success: false,
        error: "Bạn không có quyền cập nhật trạng thái nhân viên này.",
      };
    }
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof StaffNotLinkedError ||
      error instanceof StaffInactiveError
    ) {
      return {
        success: false,
        error: "Yêu cầu tài khoản nhân viên hợp lệ.",
      };
    }
    return {
      success: false,
      error: (error as Error).message || "Lỗi cập nhật trạng thái",
    };
  }
}

export async function deactivateMembershipAction(membershipId: string) {
  try {
    // 1. Validate UUID format
    if (!membershipId || !uuidPattern.test(membershipId)) {
      return {
        success: false,
        error: "Mã phân công cơ sở không hợp lệ.",
      };
    }

    // 2. Resolve current authenticated caller staff
    const callerStaff = await requireCurrentStaff();

    const supabase = createAdminClient();

    // 3. Resolve target membership record to get REAL staff_id and clinic_id
    const { data: targetMem, error: targetMemErr } = await supabase
      .from("staff_clinic_memberships")
      .select("id, staff_id, clinic_id")
      .eq("id", membershipId)
      .maybeSingle();

    if (targetMemErr || !targetMem) {
      return {
        success: false,
        error: "Không tìm thấy thông tin phân công cơ sở cần hủy.",
      };
    }

    // 4. Prevent self-membership deactivation
    if (callerStaff.id === targetMem.staff_id) {
      return {
        success: false,
        error: "Bạn không thể tự hủy phân công cơ sở của chính mình.",
      };
    }

    // 5. Authorize caller: Caller MUST hold ADMIN at the target membership's REAL clinic
    await requireTargetClinicRole(targetMem.clinic_id, ["ADMIN"]);

    // 6. Atomic governance mutation via service-role RPC (enforces last-usable-ADMIN invariant & deactivates membership)
    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      "deactivate_staff_membership_with_admin_guard",
      {
        p_membership_id: membershipId,
      }
    );

    if (rpcErr) {
      throw new Error(rpcErr.message || "Lỗi hủy phân công cơ sở");
    }

    const rpcResult = rpcData as {
      success: boolean;
      error_code?: string;
      message?: string;
      data?: { id: string; is_active: boolean };
    } | null;

    if (!rpcResult || !rpcResult.success) {
      if (rpcResult?.error_code === "LAST_USABLE_ADMIN") {
        return {
          success: false,
          error:
            rpcResult.message ||
            "Không thể hủy phân công vì đây là Quản trị viên (ADMIN) đang hoạt động duy nhất của cơ sở này.",
        };
      }
      if (rpcResult?.error_code === "TARGET_MEMBERSHIP_NOT_FOUND") {
        return {
          success: false,
          error: rpcResult.message || "Không tìm thấy thông tin phân công cơ sở cần hủy.",
        };
      }
      return {
        success: false,
        error: rpcResult?.message || "Lỗi hủy phân công cơ sở",
      };
    }

    revalidatePath("/staff");
    return { success: true };
  } catch (error: unknown) {
    if (
      error instanceof ActionForbiddenError ||
      error instanceof StaffClinicAccessDeniedError
    ) {
      return {
        success: false,
        error: "Bạn không có quyền quản lý nhân sự tại cơ sở này.",
      };
    }
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof StaffNotLinkedError ||
      error instanceof StaffInactiveError
    ) {
      return {
        success: false,
        error: "Yêu cầu tài khoản nhân viên hợp lệ.",
      };
    }
    return {
      success: false,
      error: (error as Error).message || "Lỗi hủy phân công cơ sở",
    };
  }
}

/**
 * Server Action: Provisions a Supabase Auth login account for an existing Staff member.
 *
 * Security & Governance:
 * 1. Caller MUST hold ADMIN role at verified active clinic (`requireActionAuthorization({ requiredRoles: ["ADMIN"] })`).
 * 2. Target Staff MUST belong to the SAME active clinic and currently have `user_id IS NULL`.
 * 3. Supabase Auth user is created server-side via Supabase Admin API.
 * 4. Linking to `staff.user_id` is atomic compare-and-set.
 * 5. If linking fails, the newly created Auth user is compensating-deleted to prevent orphan accounts.
 * 6. Audit log `PROVISION_STAFF_AUTH_ACCOUNT` is recorded.
 */
export async function provisionStaffAuthAccountAction(input: ProvisionStaffAuthInput) {
  try {
    // 1. Validate input schema
    const validated = provisionStaffAuthSchema.parse(input);

    // 2. Authorize caller: Caller MUST hold ADMIN role at active clinic
    const authContext = await requireActionAuthorization({
      requiredRoles: ["ADMIN"],
    });
    const activeClinicId = authContext.access.clinic.clinic_id;
    const actorStaffId = authContext.access.staff.id;
    const actorUser = await requireAuthenticatedUser();

    // 3. Delegate to privileged staff auth service
    const supabase = createAdminClient();
    const result = await provisionStaffAuthAccount(
      supabase,
      validated,
      activeClinicId,
      actorStaffId,
      actorUser.id
    );

    revalidatePath("/staff");
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof StaffAlreadyLinkedError) {
      return {
        success: false,
        error: error.message,
      };
    }
    if (error instanceof AuthEmailAlreadyExistsError) {
      return {
        success: false,
        error: error.message,
      };
    }
    if (error instanceof TargetStaffNotFoundError) {
      return {
        success: false,
        error: error.message,
      };
    }
    if (error instanceof TargetStaffInactiveError) {
      return {
        success: false,
        error: error.message,
      };
    }
    if (error instanceof TargetStaffClinicAccessDeniedError) {
      return {
        success: false,
        error: error.message,
      };
    }
    if (error instanceof UnauthorizedAdminError) {
      return {
        success: false,
        error: error.message,
      };
    }
    if (error instanceof InvalidActorError) {
      return {
        success: false,
        error: error.message,
      };
    }
    if (error instanceof ProvisionCompensationFailedError) {
      return {
        success: false,
        error: error.message,
      };
    }
    if (error instanceof StaffLinkFailedError) {
      return {
        success: false,
        error: error.message,
      };
    }
    if (
      error instanceof ActionForbiddenError ||
      error instanceof StaffClinicAccessDeniedError
    ) {
      return {
        success: false,
        error: "Bạn không có quyền quản trị (ADMIN) tại cơ sở này để cấp tài khoản.",
      };
    }
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof StaffNotLinkedError ||
      error instanceof StaffInactiveError
    ) {
      return {
        success: false,
        error: "Yêu cầu đăng nhập tài khoản quản trị hợp lệ.",
      };
    }
    if (error instanceof ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Dữ liệu cấp tài khoản không hợp lệ.",
      };
    }
    return {
      success: false,
      error: (error as Error).message || "Lỗi cấp tài khoản đăng nhập.",
    };
  }
}

/**
 * Server Action: Authoritatively resets a Staff member's Supabase Auth login password.
 *
 * Security & Governance:
 * 1. Admin is the sole operator for Staff password reset.
 * 2. Caller MUST hold ADMIN role at verified active clinic.
 * 3. Target Staff MUST belong to the SAME active clinic and have `user_id IS NOT NULL`.
 * 4. Password updated server-side via Supabase Admin API without ever storing or logging passwords.
 * 5. Invariants preserved: `staff.user_id`, `login_username`, `staff.email`, memberships, and roles.
 * 6. Audit log `RESET_STAFF_AUTH_PASSWORD` is recorded.
 */
export async function resetStaffPasswordByAdminAction(
  rawInput: ResetStaffPasswordByAdminInput | AdminResetStaffPasswordInput
) {
  try {
    // 1. Authorize caller: Caller MUST hold ADMIN role at active clinic
    const authContext = await requireActionAuthorization({
      requiredRoles: ["ADMIN"],
    });
    const activeClinicId = authContext.access.clinic.clinic_id;
    const actorStaffId = authContext.access.staff.id;
    const actorUser = await requireAuthenticatedUser();

    // 2. Validate input schema
    const parsed =
      "new_password" in rawInput
        ? resetStaffPasswordByAdminSchema.parse(rawInput)
        : adminResetStaffPasswordSchema.parse(rawInput);

    // 3. Delegate to privileged staff auth service
    const supabase = createAdminClient();
    const result = await adminResetStaffPassword(
      supabase,
      parsed,
      activeClinicId,
      actorStaffId,
      actorUser.id
    );

    revalidatePath("/staff");
    return {
      success: true,
      data: {
        staff_id: result.staff_id,
        staff_code: result.staff_code,
        full_name: result.full_name,
        message: result.message,
      },
      message: result.message,
    };
  } catch (error: unknown) {
    if (
      error instanceof TargetStaffNotFoundError ||
      error instanceof TargetStaffInactiveError ||
      error instanceof TargetStaffNotLinkedError ||
      error instanceof TargetStaffClinicAccessDeniedError ||
      error instanceof InvalidPasswordError ||
      error instanceof ResetStateFinalizationFailedError ||
      error instanceof UnauthorizedAdminError
    ) {
      return {
        success: false,
        error: error.message,
        code: (error as { code?: string }).code,
      };
    }
    if (
      error instanceof ActionForbiddenError ||
      error instanceof StaffClinicAccessDeniedError
    ) {
      return {
        success: false,
        error: "Bạn không có quyền quản trị (ADMIN) tại cơ sở này để đặt lại mật khẩu.",
        code: "UNAUTHORIZED_ADMIN",
      };
    }
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof StaffNotLinkedError ||
      error instanceof StaffInactiveError
    ) {
      return {
        success: false,
        error: "Yêu cầu đăng nhập tài khoản quản trị hợp lệ.",
        code: "INVALID_ACTOR",
      };
    }
    if (error instanceof ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Dữ liệu mật khẩu không hợp lệ.",
        code: "INVALID_INPUT",
      };
    }
    return {
      success: false,
      error: (error as Error).message || "Không thể thực hiện thao tác lúc này. Vui lòng thử lại.",
    };
  }
}

export const adminResetStaffPasswordAction = resetStaffPasswordByAdminAction;

/**
 * Server action to authoritatively provision direct login credentials for a Staff member.
 *
 * Security & Governance:
 * - Requires active ADMIN role at the active clinic context.
 * - All authority tokens (actor IDs, clinic ID) and target email are server-derived.
 * - Password and credentials are NEVER persisted to PostgreSQL or logged.
 */
export async function provisionStaffDirectCredentialsAction(
  rawInput: ProvisionStaffDirectCredentialsInput
) {
  try {
    const authContext = await requireActionAuthorization({
      requiredRoles: ["ADMIN"],
    });
    const activeClinicId = authContext.access.clinic.clinic_id;
    const actorStaffId = authContext.access.staff.id;
    const actorUser = await requireAuthenticatedUser();

    const parsed = provisionStaffDirectCredentialsSchema.parse(rawInput);
    const supabase = createAdminClient();

    const result = await provisionStaffDirectCredentials(
      supabase,
      parsed,
      activeClinicId,
      actorStaffId,
      actorUser.id
    );

    revalidatePath("/staff");

    return {
      success: true,
      data: {
        staff_id: result.staff_id,
        login_username: result.login_username,
      },
      message: result.message,
    };
  } catch (error: unknown) {
    if (
      error instanceof StaffAlreadyLinkedError ||
      error instanceof AuthEmailAlreadyExistsError ||
      error instanceof TargetStaffNotFoundError ||
      error instanceof TargetStaffInactiveError ||
      error instanceof TargetStaffClinicAccessDeniedError ||
      error instanceof StaffLoginEmailRequiredError ||
      error instanceof StaffLoginEmailInvalidError ||
      error instanceof LoginUsernameAlreadyExistsError ||
      error instanceof InvalidLoginUsernameError ||
      error instanceof TargetUsernameAlreadySetError ||
      error instanceof InvalidPasswordError ||
      error instanceof StaffLinkFailedError ||
      error instanceof ProvisionCompensationFailedError ||
      error instanceof UnauthorizedAdminError
    ) {
      return {
        success: false,
        error: error.message,
        code: (error as { code?: string }).code,
      };
    }
    if (
      error instanceof ActionForbiddenError ||
      error instanceof StaffClinicAccessDeniedError
    ) {
      return {
        success: false,
        error: "Bạn không có quyền quản trị (ADMIN) tại cơ sở này để cấp tài khoản đăng nhập.",
        code: "UNAUTHORIZED_ADMIN",
      };
    }
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof StaffNotLinkedError ||
      error instanceof StaffInactiveError
    ) {
      return {
        success: false,
        error: "Yêu cầu đăng nhập tài khoản quản trị hợp lệ.",
        code: "INVALID_ACTOR",
      };
    }
    if (error instanceof ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Dữ liệu cấp tài khoản không hợp lệ.",
        code: "INVALID_INPUT",
      };
    }
    return {
      success: false,
      error: (error as Error).message || "Không thể thực hiện thao tác lúc này. Vui lòng thử lại.",
    };
  }
}

/**
 * Server action for ADMIN to assign a canonical login_username to an existing linked legacy Staff record.
 * 
 * Spec Reference: GOAL STAFF-AUTH1C-LEGACY-USERNAME-APP1
 */
export async function assignStaffLoginUsernameAction(
  rawInput: AssignStaffLoginUsernameInput
) {
  try {
    const authContext = await requireActionAuthorization({
      requiredRoles: ["ADMIN"],
    });
    const activeClinicId = authContext.access.clinic.clinic_id;
    const actorStaffId = authContext.access.staff.id;
    const actorUser = await requireAuthenticatedUser();

    const parsed = assignStaffLoginUsernameSchema.parse(rawInput);
    const supabase = createAdminClient();

    const result = await assignStaffLoginUsername(
      supabase,
      parsed,
      activeClinicId,
      actorStaffId,
      actorUser.id
    );

    revalidatePath("/staff");

    return {
      success: true,
      data: {
        staff_id: result.staff_id,
        login_username: result.login_username,
      },
      message: result.message,
    };
  } catch (error: unknown) {
    if (
      error instanceof TargetStaffNotFoundError ||
      error instanceof TargetStaffInactiveError ||
      error instanceof TargetStaffNotLinkedError ||
      error instanceof TargetStaffClinicAccessDeniedError ||
      error instanceof LoginUsernameAlreadyExistsError ||
      error instanceof InvalidLoginUsernameError ||
      error instanceof TargetUsernameAlreadySetError ||
      error instanceof LoginUsernameAlreadyAssignedError ||
      error instanceof UnauthorizedAdminError
    ) {
      return {
        success: false,
        error: error.message,
        code: (error as { code?: string }).code,
      };
    }
    if (
      error instanceof ActionForbiddenError ||
      error instanceof StaffClinicAccessDeniedError
    ) {
      return {
        success: false,
        error: "Bạn không có quyền quản trị (ADMIN) tại cơ sở này để gán tên đăng nhập.",
        code: "UNAUTHORIZED_ADMIN",
      };
    }
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof StaffNotLinkedError ||
      error instanceof StaffInactiveError
    ) {
      return {
        success: false,
        error: "Yêu cầu đăng nhập tài khoản quản trị hợp lệ.",
        code: "INVALID_ACTOR",
      };
    }
    if (error instanceof ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Dữ liệu không hợp lệ.",
        code: "INVALID_INPUT",
      };
    }

    console.error("Lỗi gán tên đăng nhập nhân viên:", error);
    return {
      success: false,
      error: "Đã xảy ra lỗi khi gán tên đăng nhập. Vui lòng thử lại sau.",
      code: "UNKNOWN_ERROR",
    };
  }
}

