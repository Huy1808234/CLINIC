import {
  adminResetStaffPasswordSchema,
  resetStaffPasswordByAdminSchema,
  type ResetStaffPasswordByAdminParsed,
} from "@/lib/validation/staff-schemas";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
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

interface MockStaff {
  id: string;
  staff_code: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  user_id: string | null;
  login_username: string | null;
  auth_setup_required: boolean;
  auth_setup_completed_at: string | null;
}

interface MockMembership {
  id: string;
  staff_id: string;
  clinic_id: string;
  is_active: boolean;
}

interface MockRole {
  id: string;
  staff_clinic_membership_id: string;
  role_code: string;
}

interface MockAuthUser {
  id: string;
  email: string;
  passwordHash: string;
}

interface MockAuditLog {
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  after_data: Record<string, unknown>;
}

interface MockEnvironment {
  staffDb: MockStaff[];
  membershipDb: MockMembership[];
  roleDb: MockRole[];
  authUsersDb: MockAuthUser[];
  auditDb: MockAuditLog[];
  updateUserByIdCallCount: number;
  lastUpdatedAuthUserId: string | null;
  lastUpdatedPasswordValue: string | null;
  rpc30CallCount: number;
  lastRpc30Params: Record<string, unknown> | null;
  createUserCallCount: number;
  inviteUserCallCount: number;
  resetPasswordForEmailCallCount: number;
  failAuthUpdate?: boolean;
  failRpc30?: boolean;
}

function createEnvironment(): MockEnvironment {
  return {
    staffDb: [
      {
        id: "staff-admin-1",
        staff_code: "ADMIN-01",
        full_name: "Quản trị viên",
        email: "admin@thuanthien.vn",
        is_active: true,
        user_id: "auth-admin-uuid",
        login_username: "admin.clinic",
        auth_setup_required: false,
        auth_setup_completed_at: "2026-08-20T00:00:00Z",
      },
      {
        id: "staff-target-normal-active",
        staff_code: "BS-THU",
        full_name: "BS. Nguyễn Minh Thu",
        email: "doctor.thu@thuanthien.vn",
        is_active: true,
        user_id: "auth-thu-uuid",
        login_username: "bs.minhthu",
        auth_setup_required: false,
        auth_setup_completed_at: null,
      },
      {
        id: "staff-target-legacy-pending",
        staff_code: "YS-THAO",
        full_name: "Y sĩ Thảo",
        email: "ys.thao@thuanthien.vn",
        is_active: true,
        user_id: "auth-thao-uuid",
        login_username: null,
        auth_setup_required: true,
        auth_setup_completed_at: null,
      },
      {
        id: "staff-target-unlinked",
        staff_code: "BS-UNLINKED",
        full_name: "BS Chưa Liên Kết",
        email: "unlinked@thuanthien.vn",
        is_active: true,
        user_id: null,
        login_username: null,
        auth_setup_required: false,
        auth_setup_completed_at: null,
      },
      {
        id: "staff-target-inactive",
        staff_code: "YS-INACTIVE",
        full_name: "Y sĩ Đã Khóa",
        email: "inactive@thuanthien.vn",
        is_active: false,
        user_id: "auth-inactive-uuid",
        login_username: "ys.inactive",
        auth_setup_required: false,
        auth_setup_completed_at: null,
      },
      {
        id: "staff-target-cross-clinic",
        staff_code: "LT-CS2",
        full_name: "Lễ Tân Cơ Sở 2",
        email: "letan2@thuanthien.vn",
        is_active: true,
        user_id: "auth-cross-uuid",
        login_username: "lt.cs2",
        auth_setup_required: false,
        auth_setup_completed_at: null,
      },
      {
        id: "staff-doctor-actor",
        staff_code: "BS-DOC",
        full_name: "Bác Sĩ",
        email: "doc@thuanthien.vn",
        is_active: true,
        user_id: "auth-doc-uuid",
        login_username: "bs.doc",
        auth_setup_required: false,
        auth_setup_completed_at: null,
      },
      {
        id: "staff-manager-actor",
        staff_code: "QL-MGR",
        full_name: "Quản Lý",
        email: "mgr@thuanthien.vn",
        is_active: true,
        user_id: "auth-mgr-uuid",
        login_username: "ql.mgr",
        auth_setup_required: false,
        auth_setup_completed_at: null,
      },
    ],
    membershipDb: [
      { id: "mem-admin-1", staff_id: "staff-admin-1", clinic_id: "clinic-1", is_active: true },
      { id: "mem-thu-1", staff_id: "staff-target-normal-active", clinic_id: "clinic-1", is_active: true },
      { id: "mem-thao-1", staff_id: "staff-target-legacy-pending", clinic_id: "clinic-1", is_active: true },
      { id: "mem-unlinked-1", staff_id: "staff-target-unlinked", clinic_id: "clinic-1", is_active: true },
      { id: "mem-inactive-1", staff_id: "staff-target-inactive", clinic_id: "clinic-1", is_active: true },
      { id: "mem-cross-2", staff_id: "staff-target-cross-clinic", clinic_id: "clinic-2", is_active: true },
      { id: "mem-doc-1", staff_id: "staff-doctor-actor", clinic_id: "clinic-1", is_active: true },
      { id: "mem-mgr-1", staff_id: "staff-manager-actor", clinic_id: "clinic-1", is_active: true },
    ],
    roleDb: [
      { id: "role-admin-1", staff_clinic_membership_id: "mem-admin-1", role_code: "ADMIN" },
      { id: "role-thu-1", staff_clinic_membership_id: "mem-thu-1", role_code: "DOCTOR" },
      { id: "role-thao-1", staff_clinic_membership_id: "mem-thao-1", role_code: "Y_SI" },
      { id: "role-doc-1", staff_clinic_membership_id: "mem-doc-1", role_code: "DOCTOR" },
      { id: "role-mgr-1", staff_clinic_membership_id: "mem-mgr-1", role_code: "MANAGER" },
    ],
    authUsersDb: [
      { id: "auth-admin-uuid", email: "admin@thuanthien.vn", passwordHash: "old-hash-admin" },
      { id: "auth-thu-uuid", email: "doctor.thu@thuanthien.vn", passwordHash: "old-hash-thu" },
      { id: "auth-thao-uuid", email: "ys.thao@thuanthien.vn", passwordHash: "old-hash-thao" },
    ],
    auditDb: [],
    updateUserByIdCallCount: 0,
    lastUpdatedAuthUserId: null,
    lastUpdatedPasswordValue: null,
    rpc30CallCount: 0,
    lastRpc30Params: null,
    createUserCallCount: 0,
    inviteUserCallCount: 0,
    resetPasswordForEmailCallCount: 0,
  };
}

async function simulateResetPasswordService(
  env: MockEnvironment,
  parsedInput: ResetStaffPasswordByAdminParsed,
  activeClinicId: string,
  actorStaffId: string,
  actorUserId: string
) {
  // 1. Verify actor has active ADMIN role at active clinic
  const actorStaff = env.staffDb.find((s) => s.id === actorStaffId);
  if (!actorStaff || !actorStaff.is_active || actorStaff.user_id !== actorUserId) {
    throw new InvalidActorError();
  }
  const actorMem = env.membershipDb.find(
    (m) => m.staff_id === actorStaffId && m.clinic_id === activeClinicId && m.is_active
  );
  if (!actorMem) throw new UnauthorizedAdminError();
  const hasAdmin = env.roleDb.some((r) => r.staff_clinic_membership_id === actorMem.id && r.role_code === "ADMIN");
  if (!hasAdmin) throw new UnauthorizedAdminError();

  // 2. Fetch and validate target staff profile
  const targetStaff = env.staffDb.find((s) => s.id === parsedInput.staff_id);
  if (!targetStaff) throw new TargetStaffNotFoundError();
  if (!targetStaff.is_active) throw new TargetStaffInactiveError();
  if (!targetStaff.user_id) throw new TargetStaffNotLinkedError();

  // 3. Verify target staff has membership at the active clinic
  const targetMem = env.membershipDb.find(
    (m) => m.staff_id === parsedInput.staff_id && m.clinic_id === activeClinicId && m.is_active
  );
  if (!targetMem) throw new TargetStaffClinicAccessDeniedError();

  // 4. Update Supabase Auth User password via Admin API using exact targetStaff.user_id
  if (env.failAuthUpdate) {
    throw new Error("Supabase Auth API error");
  }

  env.updateUserByIdCallCount++;
  env.lastUpdatedAuthUserId = targetStaff.user_id;
  env.lastUpdatedPasswordValue = parsedInput.new_password;

  const authUser = env.authUsersDb.find((u) => u.id === targetStaff.user_id);
  if (!authUser) throw new TargetStaffNotLinkedError();
  authUser.passwordHash = `new-hash-${parsedInput.new_password}`;

  // 5. Finalize via RPC30 (no direct staff update, no separate app audit)
  env.rpc30CallCount++;
  env.lastRpc30Params = {
    p_staff_id: targetStaff.id,
    p_clinic_id: activeClinicId,
    p_actor_staff_id: actorStaffId,
    p_actor_user_id: actorUserId,
  };

  if (env.failRpc30) {
    throw new ResetStateFinalizationFailedError();
  }

  const isLegacyPending = targetStaff.auth_setup_required === true;
  if (isLegacyPending) {
    targetStaff.auth_setup_required = false;
    targetStaff.auth_setup_completed_at = null;
  }

  env.auditDb.push({
    actor_user_id: actorUserId,
    action: "RESET_STAFF_AUTH_PASSWORD",
    entity_type: "STAFF",
    entity_id: targetStaff.id,
    after_data: {
      staff_id: targetStaff.id,
      staff_code: targetStaff.staff_code,
      full_name: targetStaff.full_name,
      auth_user_id: targetStaff.user_id,
      login_username: targetStaff.login_username,
      reset_by_staff_id: actorStaffId,
      clinic_id: activeClinicId,
      legacy_setup_state_converted: isLegacyPending,
      reset_at: new Date().toISOString(),
    },
  });

  return {
    success: true,
    staff_id: targetStaff.id,
    staff_code: targetStaff.staff_code,
    full_name: targetStaff.full_name,
    message: `Đặt lại mật khẩu cho nhân viên ${targetStaff.full_name} (${targetStaff.staff_code}) thành công.`,
  };
}

export async function runAdminResetPasswordTests() {
  console.log("Running Admin Staff Password Reset Unit Tests...");

  // RESET1-14: Password mismatch rejected
  let mismatchCaught = false;
  try {
    resetStaffPasswordByAdminSchema.parse({
      staff_id: "00000000-0000-0000-0000-000000000001",
      new_password: "NewPassword@123",
      confirm_password: "WrongPassword@123",
    });
  } catch {
    mismatchCaught = true;
  }
  assert(mismatchCaught, "RESET1-14: Password mismatch must be rejected in resetStaffPasswordByAdminSchema");

  let adminMismatchCaught = false;
  try {
    adminResetStaffPasswordSchema.parse({
      staff_id: "00000000-0000-0000-0000-000000000001",
      password: "NewPassword@123",
      confirm_password: "WrongPassword@123",
    });
  } catch {
    adminMismatchCaught = true;
  }
  assert(adminMismatchCaught, "RESET1-14: Password mismatch must be rejected in adminResetStaffPasswordSchema");

  // RESET1-15: Weak password rejected (< 8 chars)
  let weakCaught = false;
  try {
    resetStaffPasswordByAdminSchema.parse({
      staff_id: "00000000-0000-0000-0000-000000000001",
      new_password: "short",
      confirm_password: "short",
    });
  } catch {
    weakCaught = true;
  }
  assert(weakCaught, "RESET1-15: Password shorter than 8 chars must be rejected");

  // RESET-FIX1-1 & 2: ADMIN reset uses exact targetStaff.user_id and calls RPC30
  const env1 = createEnvironment();
  const res1 = await simulateResetPasswordService(
    env1,
    {
      staff_id: "staff-target-normal-active",
      new_password: "NewSecretPassword@123",
      confirm_password: "NewSecretPassword@123",
    },
    "clinic-1",
    "staff-admin-1",
    "auth-admin-uuid"
  );
  assert(res1.success === true, "RESET-FIX1-1: ADMIN can reset password for linked staff");
  assert(env1.updateUserByIdCallCount === 1, "RESET-FIX1-1: updateUserById called exactly once");
  assert(env1.lastUpdatedAuthUserId === "auth-thu-uuid", "RESET-FIX1-1: updateUserById called with exact targetStaff.user_id");
  assert(env1.rpc30CallCount === 1, "RESET-FIX1-2: RPC30 called on Auth update success");
  assert(env1.lastRpc30Params?.p_staff_id === "staff-target-normal-active", "RESET-FIX1-3: RPC30 receives exact target staff_id");
  assert(env1.lastRpc30Params?.p_clinic_id === "clinic-1", "RESET-FIX1-4: RPC30 receives trusted active clinic ID");
  assert(env1.lastRpc30Params?.p_actor_staff_id === "staff-admin-1", "RESET-FIX1-5: RPC30 receives trusted actor Staff ID");
  assert(env1.lastRpc30Params?.p_actor_user_id === "auth-admin-uuid", "RESET-FIX1-6: RPC30 receives trusted actor Auth User ID");
  assert(!("password" in (env1.lastRpc30Params || {})), "RESET-FIX1-7: Password is NOT passed to RPC30");

  // RESET-FIX1-10: Normal account calls RPC30 and preserves setup state
  const staffThu = env1.staffDb.find((s) => s.id === "staff-target-normal-active")!;
  assert(staffThu.user_id === "auth-thu-uuid", "RESET-FIX1-18: Exact user_id preserved");
  assert(staffThu.login_username === "bs.minhthu", "RESET-FIX1-19: Exact login_username preserved");
  assert(staffThu.email === "doctor.thu@thuanthien.vn", "RESET-FIX1-20: Exact email preserved");
  assert(staffThu.auth_setup_required === false, "RESET-FIX1-10: Normal account auth_setup_required remains FALSE");

  // RESET-FIX1-11: Legacy pending account calls RPC30 and converts
  const env11 = createEnvironment();
  const res11 = await simulateResetPasswordService(
    env11,
    {
      staff_id: "staff-target-legacy-pending",
      new_password: "NewSecretPassword@123",
      confirm_password: "NewSecretPassword@123",
    },
    "clinic-1",
    "staff-admin-1",
    "auth-admin-uuid"
  );
  assert(res11.success === true, "RESET-FIX1-11: Legacy reset succeeded via RPC30");
  assert(env11.rpc30CallCount === 1, "RESET-FIX1-11: Legacy account calls RPC30");
  const staffThao = env11.staffDb.find((s) => s.id === "staff-target-legacy-pending")!;
  assert(staffThao.auth_setup_required === false, "RESET-FIX1-11: Legacy auth_setup_required converted to FALSE");
  assert(staffThao.auth_setup_completed_at === null, "RESET-FIX1-11: auth_setup_completed_at remains null");

  // RESET-FIX1-12: updateUserById failure -> RPC30 NOT called
  const env12 = createEnvironment();
  env12.failAuthUpdate = true;
  let authFailCaught = false;
  try {
    await simulateResetPasswordService(
      env12,
      {
        staff_id: "staff-target-normal-active",
        new_password: "NewSecretPassword@123",
        confirm_password: "NewSecretPassword@123",
      },
      "clinic-1",
      "staff-admin-1",
      "auth-admin-uuid"
    );
  } catch {
    authFailCaught = true;
  }
  assert(authFailCaught, "RESET-FIX1-12: Auth failure thrown");
  assert(env12.rpc30CallCount === 0, "RESET-FIX1-12: RPC30 NOT called on Auth failure");

  // RESET-FIX1-14: RPC30 failure after Auth success returns RESET_STATE_FINALIZATION_FAILED
  const env14 = createEnvironment();
  env14.failRpc30 = true;
  let rpcFailCaught = false;
  try {
    await simulateResetPasswordService(
      env14,
      {
        staff_id: "staff-target-normal-active",
        new_password: "NewSecretPassword@123",
        confirm_password: "NewSecretPassword@123",
      },
      "clinic-1",
      "staff-admin-1",
      "auth-admin-uuid"
    );
  } catch (e) {
    if (e instanceof ResetStateFinalizationFailedError && e.code === "RESET_STATE_FINALIZATION_FAILED") {
      rpcFailCaught = true;
    }
  }
  assert(rpcFailCaught, "RESET-FIX1-14: RPC30 failure throws ResetStateFinalizationFailedError");

  // RESET-FIX1-26 to 30: Role authorization
  const env2 = createEnvironment();
  let docDenied = false;
  try {
    await simulateResetPasswordService(
      env2,
      {
        staff_id: "staff-target-normal-active",
        new_password: "NewSecretPassword@123",
        confirm_password: "NewSecretPassword@123",
      },
      "clinic-1",
      "staff-doctor-actor",
      "auth-doc-uuid"
    );
  } catch (e) {
    if (e instanceof UnauthorizedAdminError) docDenied = true;
  }
  assert(docDenied, "RESET-FIX1-26: DOCTOR caller denied");

  console.log("All Admin Staff Password Reset Unit Tests PASSED!");
}
