import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type {
  ProvisionStaffAuthParsed,
  ProvisionStaffDirectCredentialsParsed,
} from "@/lib/validation/staff-schemas";

export class StaffAlreadyLinkedError extends Error {
  public readonly code = "ACCOUNT_ALREADY_LINKED";
  constructor(message = "Nhân viên này đã được liên kết với một tài khoản đăng nhập.") {
    super(message);
    this.name = "StaffAlreadyLinkedError";
  }
}

export class StaffLoginEmailRequiredError extends Error {
  public readonly code = "STAFF_LOGIN_EMAIL_REQUIRED";
  constructor(message = "Hồ sơ nhân viên chưa có địa chỉ email liên hệ hợp lệ để cấp tài khoản đăng nhập.") {
    super(message);
    this.name = "StaffLoginEmailRequiredError";
  }
}

export class StaffLoginEmailInvalidError extends Error {
  public readonly code = "STAFF_LOGIN_EMAIL_INVALID";
  constructor(message = "Địa chỉ email của nhân viên không hợp lệ.") {
    super(message);
    this.name = "StaffLoginEmailInvalidError";
  }
}

export class LoginUsernameAlreadyExistsError extends Error {
  public readonly code = "LOGIN_USERNAME_ALREADY_EXISTS";
  constructor(message = "Tên đăng nhập này đã được sử dụng.") {
    super(message);
    this.name = "LoginUsernameAlreadyExistsError";
  }
}

export class InvalidLoginUsernameError extends Error {
  public readonly code = "INVALID_LOGIN_USERNAME";
  constructor(message = "Tên đăng nhập không đúng định dạng chuẩn (3-32 ký tự, bắt đầu bằng chữ cái thường hoặc số).") {
    super(message);
    this.name = "InvalidLoginUsernameError";
  }
}

export class TargetUsernameAlreadySetError extends Error {
  public readonly code = "TARGET_USERNAME_ALREADY_SET";
  constructor(message = "Nhân viên này đã có tên đăng nhập trong hệ thống.") {
    super(message);
    this.name = "TargetUsernameAlreadySetError";
  }
}

export class LoginUsernameAlreadyAssignedError extends Error {
  public readonly code = "LOGIN_USERNAME_ALREADY_ASSIGNED";
  constructor(message = "Nhân viên này đã có tên đăng nhập trong hệ thống.") {
    super(message);
    this.name = "LoginUsernameAlreadyAssignedError";
  }
}

export class InvalidPasswordError extends Error {
  public readonly code = "INVALID_PASSWORD";
  constructor(message = "Mật khẩu chưa đáp ứng yêu cầu an toàn.") {
    super(message);
    this.name = "InvalidPasswordError";
  }
}

export class ResetStateFinalizationFailedError extends Error {
  public readonly code = "RESET_STATE_FINALIZATION_FAILED";
  constructor(
    message = "Mật khẩu đã được cập nhật nhưng hệ thống chưa hoàn tất ghi nhận trạng thái. Vui lòng thử lại thao tác đặt lại mật khẩu hoặc liên hệ quản trị hệ thống."
  ) {
    super(message);
    this.name = "ResetStateFinalizationFailedError";
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

export class TargetStaffNotLinkedError extends Error {
  public readonly code = "AUTH_ACCOUNT_MISSING";
  constructor(message = "Nhân viên này chưa được liên kết tài khoản đăng nhập.") {
    super(message);
    this.name = "TargetStaffNotLinkedError";
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

export interface AdminResetStaffPasswordResult {
  success: boolean;
  staff_id: string;
  staff_code: string;
  full_name: string;
  message: string;
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

/**
 * Authoritatively resets the password for a linked Staff member's Supabase Auth user.
 *
 * Governance & Security Invariants:
 * 1. Admin is the sole operator for Staff password reset.
 * 2. Caller MUST hold ADMIN role at active clinic context.
 * 3. Updates exact linked Supabase Auth User via Supabase Admin API (`updateUserById`).
 * 4. Preserves `staff.user_id` without modification.
 * 5. Preserves all clinic memberships and roles intact.
 * 6. Sets `auth_setup_required = FALSE` so staff can access immediately.
 * 7. Records audit log `RESET_STAFF_AUTH_PASSWORD`.
 * 8. PASSWORDS ARE NEVER LOGGED OR PERSISTED IN APPLICATION TABLES.
 */
export async function adminResetStaffPassword(
  supabase: SupabaseClient<Database>,
  input:
    | import("@/lib/validation/staff-schemas").AdminResetStaffPasswordParsed
    | import("@/lib/validation/staff-schemas").ResetStaffPasswordByAdminParsed,
  activeClinicId: string,
  actorStaffId: string,
  actorUserId: string
): Promise<AdminResetStaffPasswordResult> {
  // 1. Verify actor has active ADMIN role at active clinic
  const { data: actorMembership, error: actorErr } = await supabase
    .from("staff_clinic_memberships")
    .select("id, staff_clinic_roles(role_code)")
    .eq("staff_id", actorStaffId)
    .eq("clinic_id", activeClinicId)
    .eq("is_active", true)
    .maybeSingle();

  if (actorErr || !actorMembership) {
    throw new UnauthorizedAdminError("Bạn không có quyền quản trị (ADMIN) tại cơ sở này.");
  }

  const actorRoles = (actorMembership.staff_clinic_roles || []).map((r) => r.role_code);
  if (!actorRoles.includes("ADMIN")) {
    throw new UnauthorizedAdminError("Bạn không có quyền quản trị (ADMIN) tại cơ sở này.");
  }

  // 2. Fetch and validate target staff profile
  const { data: targetStaff, error: staffErr } = await supabase
    .from("staff")
    .select("id, staff_code, full_name, email, is_active, user_id, login_username, auth_setup_required, auth_setup_completed_at")
    .eq("id", input.staff_id)
    .maybeSingle();

  if (staffErr || !targetStaff) {
    throw new TargetStaffNotFoundError("Không tìm thấy thông tin hồ sơ nhân viên.");
  }

  if (!targetStaff.is_active) {
    throw new TargetStaffInactiveError("Không thể đặt lại mật khẩu cho hồ sơ nhân viên đã bị khóa hoặc ngừng hoạt động.");
  }

  if (!targetStaff.user_id) {
    throw new TargetStaffNotLinkedError("Nhân viên này chưa được liên kết tài khoản đăng nhập.");
  }

  // 3. Verify target staff has active membership at the active clinic
  const { data: targetMembership, error: targetMemErr } = await supabase
    .from("staff_clinic_memberships")
    .select("id")
    .eq("staff_id", input.staff_id)
    .eq("clinic_id", activeClinicId)
    .eq("is_active", true)
    .maybeSingle();

  if (targetMemErr || !targetMembership) {
    throw new TargetStaffClinicAccessDeniedError("Nhân viên không có phân công làm việc đang hoạt động tại cơ sở hiện tại.");
  }

  // 4. Update Supabase Auth User password via Admin API using exact targetStaff.user_id
  const targetPassword = "new_password" in input ? input.new_password : input.password;
  const { error: authErr } = await supabase.auth.admin.updateUserById(
    targetStaff.user_id,
    {
      password: targetPassword,
    }
  );

  if (authErr) {
    const errorMsg = authErr.message?.toLowerCase() || "";
    if (errorMsg.includes("user not found") || errorMsg.includes("not found")) {
      throw new TargetStaffNotLinkedError("Tài khoản xác thực liên kết không tồn tại trong hệ thống.");
    }
    if (errorMsg.includes("password")) {
      throw new InvalidPasswordError("Mật khẩu chưa đáp ứng yêu cầu an toàn.");
    }
    throw new Error(authErr.message || "Lỗi cập nhật mật khẩu trong hệ thống xác thực.");
  }

  // 5. Finalize setup-state transition & record RESET_STAFF_AUTH_PASSWORD audit atomically via RPC30
  const { data: rpcRes, error: rpcErr } = await supabase.rpc(
    "finalize_staff_admin_password_reset",
    {
      p_staff_id: targetStaff.id,
      p_clinic_id: activeClinicId,
      p_actor_staff_id: actorStaffId,
      p_actor_user_id: actorUserId,
    }
  );

  if (rpcErr) {
    console.error("Operational Error: finalize_staff_admin_password_reset RPC failed after auth password update:", {
      staff_id: targetStaff.id,
      clinic_id: activeClinicId,
      actor_staff_id: actorStaffId,
    });
    throw new ResetStateFinalizationFailedError();
  }

  const result = rpcRes as unknown as {
    success: boolean;
    error_code?: string;
    message?: string;
    staff_id?: string;
    auth_user_id?: string;
    legacy_converted?: boolean;
  };

  if (!result || !result.success) {
    console.error("Operational Error: finalize_staff_admin_password_reset returned unsuccessful result after auth password update:", {
      staff_id: targetStaff.id,
      clinic_id: activeClinicId,
      actor_staff_id: actorStaffId,
      error_code: result?.error_code,
    });
    throw new ResetStateFinalizationFailedError(result?.message);
  }

  return {
    success: true,
    staff_id: targetStaff.id,
    staff_code: targetStaff.staff_code,
    full_name: targetStaff.full_name,
    message: result.message || `Đặt lại mật khẩu cho nhân viên ${targetStaff.full_name} (${targetStaff.staff_code}) thành công.`,
  };
}

export interface ProvisionStaffDirectCredentialsResult {
  success: boolean;
  staff_id: string;
  login_username: string;
  message: string;
}

/**
 * Authoritatively provisions an ADMIN-managed direct credential login account for an existing Staff member.
 *
 * Sequence & Invariants:
 * 1. Actor is verified as active ADMIN at the active clinic context.
 * 2. Target Staff is loaded server-side: must be active, assigned to active clinic, user_id IS NULL, login_username IS NULL.
 * 3. Target Staff email is verified: must exist, non-blank, valid email (STAFF_LOGIN_EMAIL_REQUIRED).
 * 4. Supabase Auth User is created via Admin API (`supabase.auth.admin.createUser({ email, password, email_confirm: true })`).
 * 5. Atomically links target Staff (`user_id`, `login_username`, `auth_setup_required = FALSE`, `auth_setup_completed_at = NULL`)
 *    and writes `PROVISION_STAFF_AUTH_ACCOUNT` audit via RPC `public.link_staff_auth_account_direct`.
 * 6. If RPC fails, compensator deletes the newly-created Supabase Auth User (`supabase.auth.admin.deleteUser`).
 * 7. If compensation fails, throws `ProvisionCompensationFailedError` ("PROVISION_COMPENSATION_FAILED").
 * 8. Passwords and credentials are NEVER persisted to database tables, logged, or included in return payloads.
 */
export async function provisionStaffDirectCredentials(
  supabase: SupabaseClient<Database>,
  input: ProvisionStaffDirectCredentialsParsed,
  activeClinicId: string,
  actorStaffId: string,
  actorUserId: string
): Promise<ProvisionStaffDirectCredentialsResult> {
  // 1. Application precheck: Load target staff record
  const { data: targetStaff, error: targetStaffErr } = await supabase
    .from("staff")
    .select("id, staff_code, full_name, email, is_active, user_id, login_username")
    .eq("id", input.staff_id)
    .single();

  if (targetStaffErr || !targetStaff) {
    throw new TargetStaffNotFoundError();
  }

  if (!targetStaff.is_active) {
    throw new TargetStaffInactiveError();
  }

  if (targetStaff.user_id !== null) {
    throw new StaffAlreadyLinkedError();
  }

  if (targetStaff.login_username !== null) {
    throw new TargetUsernameAlreadySetError();
  }

  // 2. Validate email is usable
  const targetEmail = targetStaff.email ? targetStaff.email.trim() : "";
  if (!targetEmail || !targetEmail.includes("@")) {
    throw new StaffLoginEmailRequiredError();
  }

  // 3. Precheck target clinic membership
  const { data: targetMem, error: targetMemErr } = await supabase
    .from("staff_clinic_memberships")
    .select("id")
    .eq("staff_id", input.staff_id)
    .eq("clinic_id", activeClinicId)
    .eq("is_active", true)
    .maybeSingle();

  if (targetMemErr || !targetMem) {
    throw new TargetStaffClinicAccessDeniedError();
  }

  // 4. Create Auth User in Supabase Auth via Admin API
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: targetEmail,
    password: input.password,
    email_confirm: true,
  });

  if (authErr || !authData?.user) {
    const errorMsg = authErr?.message?.toLowerCase() || "";
    if (
      errorMsg.includes("already registered") ||
      errorMsg.includes("already exists") ||
      errorMsg.includes("email address is already in use") ||
      errorMsg.includes("duplicate")
    ) {
      throw new AuthEmailAlreadyExistsError();
    }
    if (errorMsg.includes("invalid email") || errorMsg.includes("email")) {
      throw new StaffLoginEmailInvalidError();
    }
    if (errorMsg.includes("password")) {
      throw new InvalidPasswordError();
    }
    throw new Error(authErr?.message || "Lỗi tạo tài khoản xác thực trong hệ thống.");
  }

  const createdAuthUser = authData.user;

  // 5. Atomically link Staff via RPC 29
  const { data: rpcRes, error: rpcErr } = await supabase.rpc("link_staff_auth_account_direct", {
    p_staff_id: input.staff_id,
    p_clinic_id: activeClinicId,
    p_auth_user_id: createdAuthUser.id,
    p_login_username: input.login_username,
    p_actor_staff_id: actorStaffId,
    p_actor_user_id: actorUserId,
  });

  if (rpcErr) {
    // Attempt compensation: delete the newly created Auth user
    const { error: deleteErr } = await supabase.auth.admin.deleteUser(createdAuthUser.id);
    if (deleteErr) {
      console.error("CRITICAL: Failed to compensate orphaned Supabase Auth User during failed direct provisioning:", {
        auth_user_id: createdAuthUser.id,
        staff_id: input.staff_id,
        clinic_id: activeClinicId,
      });
      throw new ProvisionCompensationFailedError();
    }
    throw new StaffLinkFailedError(rpcErr.message);
  }

  const result = rpcRes as unknown as {
    success: boolean;
    error_code?: string;
    message?: string;
    staff_id?: string;
    auth_user_id?: string;
    login_username?: string;
  };

  if (!result || !result.success) {
    // Attempt compensation
    const { error: deleteErr } = await supabase.auth.admin.deleteUser(createdAuthUser.id);
    if (deleteErr) {
      console.error("CRITICAL: Failed to compensate orphaned Supabase Auth User during failed direct provisioning:", {
        auth_user_id: createdAuthUser.id,
        staff_id: input.staff_id,
        clinic_id: activeClinicId,
      });
      throw new ProvisionCompensationFailedError();
    }

    const code = result?.error_code;
    if (code === "UNAUTHORIZED_ADMIN") throw new UnauthorizedAdminError();
    if (code === "INVALID_ACTOR") throw new InvalidActorError();
    if (code === "TARGET_STAFF_NOT_FOUND") throw new TargetStaffNotFoundError();
    if (code === "TARGET_STAFF_INACTIVE") throw new TargetStaffInactiveError();
    if (code === "ACCOUNT_ALREADY_LINKED") throw new StaffAlreadyLinkedError();
    if (code === "TARGET_USERNAME_ALREADY_SET") throw new TargetUsernameAlreadySetError();
    if (code === "TARGET_STAFF_NOT_ACCESSIBLE") throw new TargetStaffClinicAccessDeniedError();
    if (code === "LOGIN_USERNAME_ALREADY_EXISTS") throw new LoginUsernameAlreadyExistsError();
    if (code === "INVALID_LOGIN_USERNAME") throw new InvalidLoginUsernameError();

    throw new StaffLinkFailedError(result?.message);
  }

  return {
    success: true,
    staff_id: input.staff_id,
    login_username: input.login_username,
    message: result.message || "Cấp tài khoản đăng nhập trực tiếp thành công.",
  };
}

export interface AssignStaffLoginUsernameResult {
  success: boolean;
  staff_id: string;
  login_username: string;
  message: string;
}

export async function assignStaffLoginUsername(
  supabase: SupabaseClient<Database>,
  input: import("@/lib/validation/staff-schemas").AssignStaffLoginUsernameParsed,
  activeClinicId: string,
  actorStaffId: string,
  actorUserId: string
): Promise<AssignStaffLoginUsernameResult> {
  // 1. Verify actor has active ADMIN role at active clinic
  const { data: actorMembership, error: actorErr } = await supabase
    .from("staff_clinic_memberships")
    .select("id, staff_clinic_roles(role_code)")
    .eq("staff_id", actorStaffId)
    .eq("clinic_id", activeClinicId)
    .eq("is_active", true)
    .maybeSingle();

  if (actorErr || !actorMembership) {
    throw new UnauthorizedAdminError("Bạn không có quyền quản trị (ADMIN) tại cơ sở này.");
  }

  const actorRoles = (actorMembership.staff_clinic_roles || []).map((r: { role_code: string }) => r.role_code);
  if (!actorRoles.includes("ADMIN")) {
    throw new UnauthorizedAdminError("Bạn không có quyền quản trị (ADMIN) tại cơ sở này.");
  }

  // 2. Precheck target staff profile
  const { data: targetStaff, error: staffErr } = await supabase
    .from("staff")
    .select("id, staff_code, full_name, is_active, user_id, login_username")
    .eq("id", input.staff_id)
    .maybeSingle();

  if (staffErr || !targetStaff) {
    throw new TargetStaffNotFoundError("Không tìm thấy thông tin hồ sơ nhân viên.");
  }

  if (!targetStaff.is_active) {
    throw new TargetStaffInactiveError("Không thể gán tên đăng nhập cho hồ sơ nhân viên đã bị khóa hoặc ngừng hoạt động.");
  }

  if (!targetStaff.user_id) {
    throw new TargetStaffNotLinkedError("Nhân viên này chưa được liên kết tài khoản đăng nhập.");
  }

  if (targetStaff.login_username) {
    throw new LoginUsernameAlreadyAssignedError("Nhân viên này đã có tên đăng nhập trong hệ thống.");
  }

  // 3. Precheck target staff has active membership at active clinic
  const { data: targetMembership, error: targetMemErr } = await supabase
    .from("staff_clinic_memberships")
    .select("id")
    .eq("staff_id", input.staff_id)
    .eq("clinic_id", activeClinicId)
    .eq("is_active", true)
    .maybeSingle();

  if (targetMemErr || !targetMembership) {
    throw new TargetStaffClinicAccessDeniedError("Nhân viên không có phân công làm việc đang hoạt động tại cơ sở hiện tại.");
  }

  // 4. Precheck username global uniqueness
  const { data: existingUsernameStaff } = await supabase
    .from("staff")
    .select("id")
    .eq("login_username", input.login_username)
    .neq("id", input.staff_id)
    .maybeSingle();

  if (existingUsernameStaff) {
    throw new LoginUsernameAlreadyExistsError("Tên đăng nhập này đã được sử dụng cho một nhân viên khác trong hệ thống.");
  }

  // 5. Invoke atomic RPC 31
  const { data: rpcRes, error: rpcErr } = await supabase.rpc("assign_staff_login_username", {
    p_staff_id: input.staff_id,
    p_clinic_id: activeClinicId,
    p_login_username: input.login_username,
    p_actor_staff_id: actorStaffId,
    p_actor_user_id: actorUserId,
  });

  if (rpcErr) {
    throw new Error(rpcErr.message || "Lỗi khi gọi RPC gán tên đăng nhập.");
  }

  const result = rpcRes as unknown as {
    success: boolean;
    error_code?: string;
    message?: string;
    staff_id?: string;
    login_username?: string;
  };

  if (!result || !result.success) {
    const code = result?.error_code;
    if (code === "INVALID_LOGIN_USERNAME") throw new InvalidLoginUsernameError(result?.message);
    if (code === "LOGIN_USERNAME_ALREADY_EXISTS") throw new LoginUsernameAlreadyExistsError(result?.message);
    if (code === "LOGIN_USERNAME_ALREADY_ASSIGNED") throw new LoginUsernameAlreadyAssignedError(result?.message);
    if (code === "AUTH_ACCOUNT_MISSING") throw new TargetStaffNotLinkedError(result?.message);
    if (code === "TARGET_STAFF_NOT_FOUND") throw new TargetStaffNotFoundError(result?.message);
    if (code === "TARGET_STAFF_INACTIVE") throw new TargetStaffInactiveError(result?.message);
    if (code === "TARGET_STAFF_NOT_ACCESSIBLE") throw new TargetStaffClinicAccessDeniedError(result?.message);
    if (code === "UNAUTHORIZED_ADMIN") throw new UnauthorizedAdminError(result?.message);
    if (code === "INVALID_ACTOR") throw new InvalidActorError(result?.message);

    throw new Error(result?.message || "Gán tên đăng nhập thất bại.");
  }

  return {
    success: true,
    staff_id: result.staff_id || input.staff_id,
    login_username: result.login_username || input.login_username,
    message: result.message || `Gán tên đăng nhập "${input.login_username}" cho nhân viên thành công.`,
  };
}
