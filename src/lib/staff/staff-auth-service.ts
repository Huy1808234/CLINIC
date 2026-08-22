import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ProvisionStaffAuthParsed } from "@/lib/validation/staff-schemas";

export class StaffAlreadyLinkedError extends Error {
  public readonly code = "ACCOUNT_ALREADY_LINKED";
  constructor(message = "Nhân viên này đã được liên kết với một tài khoản đăng nhập.") {
    super(message);
    this.name = "StaffAlreadyLinkedError";
  }
}

export class AuthEmailAlreadyExistsError extends Error {
  public readonly code = "AUTH_EMAIL_ALREADY_EXISTS";
  constructor(message = "Địa chỉ email này đã được sử dụng cho một tài khoản khác trong hệ thống.") {
    super(message);
    this.name = "AuthEmailAlreadyExistsError";
  }
}

export class TargetStaffNotFoundError extends Error {
  public readonly code = "TARGET_STAFF_NOT_FOUND";
  constructor(message = "Không tìm thấy thông tin hồ sơ nhân viên.") {
    super(message);
    this.name = "TargetStaffNotFoundError";
  }
}

export class TargetStaffInactiveError extends Error {
  public readonly code = "TARGET_STAFF_INACTIVE";
  constructor(message = "Không thể cấp tài khoản cho hồ sơ nhân viên đã bị khóa hoặc ngừng hoạt động.") {
    super(message);
    this.name = "TargetStaffInactiveError";
  }
}

export class TargetStaffClinicAccessDeniedError extends Error {
  public readonly code = "TARGET_STAFF_NOT_ACCESSIBLE";
  constructor(message = "Nhân viên không có phân công làm việc đang hoạt động tại cơ sở hiện tại.") {
    super(message);
    this.name = "TargetStaffClinicAccessDeniedError";
  }
}

export class UnauthorizedAdminError extends Error {
  public readonly code = "UNAUTHORIZED_ADMIN";
  constructor(message = "Bạn không có quyền quản trị (ADMIN) tại cơ sở này.") {
    super(message);
    this.name = "UnauthorizedAdminError";
  }
}

export class InvalidActorError extends Error {
  public readonly code = "INVALID_ACTOR";
  constructor(message = "Tài khoản người thực hiện không hợp lệ hoặc không khớp với hồ sơ nhân viên.") {
    super(message);
    this.name = "InvalidActorError";
  }
}

export class StaffLinkFailedError extends Error {
  public readonly code = "STAFF_LINK_FAILED";
  constructor(message = "Không thể liên kết tài khoản đăng nhập với nhân viên (có thể do trùng lặp hoặc đã được liên kết đồng thời).") {
    super(message);
    this.name = "StaffLinkFailedError";
  }
}

export class ProvisionCompensationFailedError extends Error {
  public readonly code = "PROVISION_COMPENSATION_FAILED";
  constructor(message = "Lỗi nghiêm trọng: Quá trình liên kết cơ sở dữ liệu thất bại và không thể tự động dọn dẹp tài khoản xác thực vừa tạo. Vui lòng liên hệ quản trị viên hệ thống.") {
    super(message);
    this.name = "ProvisionCompensationFailedError";
  }
}

export interface ProvisionStaffAuthResult {
  success: boolean;
  staff_id: string;
  user_id: string;
  login_email: string;
  message: string;
}

export interface CompleteStaffAuthSetupResult {
  success: boolean;
  staff_id?: string;
  idempotent?: boolean;
  message?: string;
}

/**
 * Authoritatively provisions an invitation-based Supabase Auth login account for an existing Staff member.
 *
 * Security & Governance Invariants:
 * 1. Admin sends invitation via Supabase Auth Admin API (`inviteUserByEmail`). Admin NEVER knows the password.
 * 2. Application DB linkage (staff.user_id, auth_setup_required = TRUE, and PROVISION_STAFF_AUTH_ACCOUNT audit)
 *    is performed ATOMICALLY via one PostgreSQL RPC (`public.link_staff_auth_account`).
 * 3. If DB RPC fails or rejects, the service executes compensating deletion of ONLY the newly invited Auth User.
 * 4. If compensation fails, a distinct `ProvisionCompensationFailedError` is thrown to ensure it is not silent.
 */
export async function provisionStaffAuthAccount(
  supabase: SupabaseClient<Database>,
  input: ProvisionStaffAuthParsed,
  activeClinicId: string,
  actorStaffId: string,
  actorUserId: string
): Promise<ProvisionStaffAuthResult> {
  // 1. Invite Auth User in Supabase Auth via Admin API
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { data: authData, error: authErr } = await supabase.auth.admin.inviteUserByEmail(
    input.login_email,
    {
      redirectTo: `${siteUrl}/auth/setup-password`,
    }
  );

  if (authErr || !authData.user) {
    const errorMsg = authErr?.message?.toLowerCase() || "";
    if (
      errorMsg.includes("already registered") ||
      errorMsg.includes("already exists") ||
      errorMsg.includes("email address is already in use") ||
      errorMsg.includes("duplicate")
    ) {
      throw new AuthEmailAlreadyExistsError();
    }
    throw new Error(authErr?.message || "Lỗi gửi thư mời tạo tài khoản trong hệ thống xác thực.");
  }

  const createdAuthUser = authData.user;

  // 2. Atomically link Staff, set setup state, and record audit in ONE PostgreSQL transaction via RPC
  const { data: rpcRes, error: rpcErr } = await supabase.rpc("link_staff_auth_account", {
    p_staff_id: input.staff_id,
    p_clinic_id: activeClinicId,
    p_auth_user_id: createdAuthUser.id,
    p_login_email: input.login_email,
    p_actor_staff_id: actorStaffId,
    p_actor_user_id: actorUserId,
  });

  const parsedRpc = rpcRes as Record<string, unknown> | null;

  if (rpcErr || !parsedRpc || parsedRpc.success !== true) {
    // CRITICAL COMPENSATION: DB linkage failed -> Rollback the newly created Auth user
    let compensationFailed = false;
    try {
      const { error: deleteErr } = await supabase.auth.admin.deleteUser(createdAuthUser.id);
      if (deleteErr) {
        compensationFailed = true;
        console.error("Critical: Failed to delete orphaned auth user during compensation:", deleteErr);
      }
    } catch (cleanupErr) {
      compensationFailed = true;
      console.error("Critical: Exception during cleanup of orphaned auth user:", cleanupErr);
    }

    if (compensationFailed) {
      throw new ProvisionCompensationFailedError();
    }

    const errorCode = parsedRpc?.error_code as string | undefined;
    const errorMessage = parsedRpc?.message as string | undefined;

    if (errorCode === "ACCOUNT_ALREADY_LINKED") {
      throw new StaffAlreadyLinkedError();
    }
    if (errorCode === "TARGET_STAFF_INACTIVE") {
      throw new TargetStaffInactiveError();
    }
    if (errorCode === "TARGET_STAFF_NOT_FOUND") {
      throw new TargetStaffNotFoundError();
    }
    if (errorCode === "TARGET_STAFF_NOT_ACCESSIBLE") {
      throw new TargetStaffClinicAccessDeniedError();
    }
    if (errorCode === "UNAUTHORIZED_ADMIN") {
      throw new UnauthorizedAdminError();
    }
    if (errorCode === "INVALID_ACTOR") {
      throw new InvalidActorError();
    }

    throw new StaffLinkFailedError(errorMessage || rpcErr?.message || "Lỗi liên kết tài khoản nhân viên.");
  }

  return {
    success: true,
    staff_id: input.staff_id,
    user_id: createdAuthUser.id,
    login_email: input.login_email,
    message: "Tạo tài khoản và gửi lời mời thiết lập mật khẩu thành công.",
  };
}

/**
 * Atomically marks initial staff auth setup as complete via database RPC.
 */
export async function completeStaffAuthSetup(
  supabase: SupabaseClient<Database>,
  actorUserId: string
): Promise<CompleteStaffAuthSetupResult> {
  const { data, error } = await supabase.rpc("complete_staff_auth_setup", {
    p_actor_user_id: actorUserId,
  });

  if (error || !data) {
    throw new Error(error?.message || "Lỗi hoàn tất thiết lập tài khoản.");
  }

  return data as unknown as CompleteStaffAuthSetupResult;
}
