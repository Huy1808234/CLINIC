import "server-only";
import { createClient } from "@/supabase-clients/server";
import { getCurrentAuthUser, requireAuthenticatedUser } from "./auth-resolver";

/**
 * Standard typed application error when an authenticated user does not have
 * an explicit staff profile linked (staff.user_id = auth.users.id).
 */
export class StaffNotLinkedError extends Error {
  public readonly code = "STAFF_NOT_LINKED";
  public readonly statusCode = 403;

  constructor(message = "Tài khoản người dùng chưa được liên kết với hồ sơ nhân viên.") {
    super(message);
    this.name = "StaffNotLinkedError";
    Object.setPrototypeOf(this, StaffNotLinkedError.prototype);
  }
}

/**
 * Standard typed application error when the linked staff profile is inactive (is_active = false).
 */
export class StaffInactiveError extends Error {
  public readonly code = "STAFF_INACTIVE";
  public readonly statusCode = 403;

  constructor(message = "Hồ sơ nhân viên đã bị khóa hoặc ngừng hoạt động.") {
    super(message);
    this.name = "StaffInactiveError";
    Object.setPrototypeOf(this, StaffInactiveError.prototype);
  }
}

/**
 * Standard typed application error when an authenticated staff member has not completed
 * initial password setup (staff.auth_setup_required = true).
 */
export class AccountSetupRequiredError extends Error {
  public readonly code = "ACCOUNT_SETUP_REQUIRED";
  public readonly statusCode = 403;

  constructor(message = "Tài khoản nhân viên chưa hoàn tất thiết lập mật khẩu ban đầu.") {
    super(message);
    this.name = "AccountSetupRequiredError";
    Object.setPrototypeOf(this, AccountSetupRequiredError.prototype);
  }
}

/**
 * Verified Staff Master identity for server-side authorization.
 */
export interface StaffIdentity {
  id: string;
  user_id: string;
  staff_code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  auth_setup_required: boolean;
  auth_setup_completed_at: string | null;
  created_at: string;
}

/**
 * Resolves the linked Staff Master record for the currently authenticated Supabase user.
 *
 * Security Invariant:
 * Resolves ONLY via exact foreign key match (`staff.user_id = auth.users.id`).
 * NEVER attempts automatic or heuristic matching by email, phone, or name.
 *
 * @returns The linked `StaffIdentity` or `null` if unauthenticated or unlinked.
 */
export async function getCurrentStaff(): Promise<StaffIdentity | null> {
  const authUser = await getCurrentAuthUser();
  if (!authUser) {
    return null;
  }

  try {
    const supabase = await createClient();
    const { data: staff, error } = await supabase
      .from("staff")
      .select("id, user_id, staff_code, full_name, phone, email, is_active, auth_setup_required, auth_setup_completed_at, created_at")
      .eq("user_id", authUser.id)
      .maybeSingle();

    if (error || !staff || !staff.user_id) {
      return null;
    }

    return {
      id: staff.id,
      user_id: staff.user_id,
      staff_code: staff.staff_code,
      full_name: staff.full_name,
      phone: staff.phone,
      email: staff.email,
      is_active: staff.is_active,
      auth_setup_required: staff.auth_setup_required ?? false,
      auth_setup_completed_at: staff.auth_setup_completed_at ?? null,
      created_at: staff.created_at,
    };
  } catch (err: unknown) {
    console.error("Failed to query linked staff by user_id:", err);
    return null;
  }
}

/**
 * Requires a valid authenticated user with an active, linked, setup-completed Staff Master profile.
 *
 * Distinguishes the following failure states explicitly:
 * 1. Unauthenticated session -> throws `AuthenticationRequiredError` (code: "UNAUTHENTICATED", 401)
 * 2. Authenticated but no linked staff -> throws `StaffNotLinkedError` (code: "STAFF_NOT_LINKED", 403)
 * 3. Authenticated and linked but inactive -> throws `StaffInactiveError` (code: "STAFF_INACTIVE", 403)
 * 4. Authenticated and linked but initial password setup pending -> throws `AccountSetupRequiredError` (code: "ACCOUNT_SETUP_REQUIRED", 403)
 *
 * @returns The verified active `StaffIdentity`.
 * @throws `AuthenticationRequiredError` | `StaffNotLinkedError` | `StaffInactiveError` | `AccountSetupRequiredError`
 */
export async function requireCurrentStaff(): Promise<StaffIdentity> {
  const authUser = await requireAuthenticatedUser();

  const supabase = await createClient();
  const { data: staff, error } = await supabase
    .from("staff")
    .select("id, user_id, staff_code, full_name, phone, email, is_active, auth_setup_required, auth_setup_completed_at, created_at")
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (error) {
    console.error("Database error querying staff profile:", error);
    throw new Error("Lỗi truy vấn hồ sơ nhân viên");
  }

  if (!staff || !staff.user_id) {
    throw new StaffNotLinkedError();
  }

  if (!staff.is_active) {
    throw new StaffInactiveError();
  }

  if (staff.auth_setup_required) {
    throw new AccountSetupRequiredError();
  }

  return {
    id: staff.id,
    user_id: staff.user_id,
    staff_code: staff.staff_code,
    full_name: staff.full_name,
    phone: staff.phone,
    email: staff.email,
    is_active: staff.is_active,
    auth_setup_required: staff.auth_setup_required ?? false,
    auth_setup_completed_at: staff.auth_setup_completed_at ?? null,
    created_at: staff.created_at,
  };
}
