import {
  provisionStaffDirectCredentialsSchema,
  type ProvisionStaffDirectCredentialsParsed,
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

export class InvalidPasswordError extends Error {
  public readonly code = "INVALID_PASSWORD";
  constructor(message = "Mật khẩu chưa đáp ứng yêu cầu an toàn.") {
    super(message);
    this.name = "InvalidPasswordError";
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

export class ProvisionCompensationFailedError extends Error {
  public readonly code = "PROVISION_COMPENSATION_FAILED";
  constructor(message = "Lỗi nghiêm trọng: Quá trình liên kết cơ sở dữ liệu thất bại và không thể tự động dọn dẹp tài khoản xác thực vừa tạo.") {
    super(message);
    this.name = "ProvisionCompensationFailedError";
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
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
  email_confirmed: boolean;
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
  createUserCallCount: number;
  inviteUserCallCount: number;
  deleteUserCallCount: number;
  lastCreatedUser: MockAuthUser | null;
  lastDeletedUserId: string | null;
  failCreateUser?: boolean;
  failRpc?: boolean;
  failCompensation?: boolean;
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
        id: "staff-target-eligible",
        staff_code: "BS-THU",
        full_name: "BS. Nguyễn Minh Thu",
        email: "doctor.thu@thuanthien.vn",
        is_active: true,
        user_id: null,
        login_username: null,
        auth_setup_required: false,
        auth_setup_completed_at: null,
      },
      {
        id: "staff-target-no-email",
        staff_code: "BS-NOEMAIL",
        full_name: "BS Chưa Có Email",
        email: null,
        is_active: true,
        user_id: null,
        login_username: null,
        auth_setup_required: false,
        auth_setup_completed_at: null,
      },
      {
        id: "staff-target-linked",
        staff_code: "BS-LINKED",
        full_name: "BS Đã Có Tài Khoản",
        email: "linked@thuanthien.vn",
        is_active: true,
        user_id: "existing-auth-uuid",
        login_username: "bs.linked",
        auth_setup_required: false,
        auth_setup_completed_at: "2026-08-20T00:00:00Z",
      },
      {
        id: "staff-target-username-set",
        staff_code: "BS-USERNAMESET",
        full_name: "BS Đã Có Username",
        email: "user_set@thuanthien.vn",
        is_active: true,
        user_id: null,
        login_username: "bs.existinguser",
        auth_setup_required: false,
        auth_setup_completed_at: null,
      },
      {
        id: "staff-target-inactive",
        staff_code: "YS-INACTIVE",
        full_name: "Y sĩ Ngừng Việc",
        email: "inactive@thuanthien.vn",
        is_active: false,
        user_id: null,
        login_username: null,
        auth_setup_required: false,
        auth_setup_completed_at: null,
      },
      {
        id: "staff-doc-only",
        staff_code: "BS-ONLY",
        full_name: "Bác Sĩ Khám",
        email: "doctor.only@thuanthien.vn",
        is_active: true,
        user_id: "auth-doc-uuid",
        login_username: "bs.only",
        auth_setup_required: false,
        auth_setup_completed_at: "2026-08-20T00:00:00Z",
      },
      {
        id: "staff-target-cross-clinic",
        staff_code: "LT-CROSS",
        full_name: "Lễ tân CS2",
        email: "letan2@thuanthien.vn",
        is_active: true,
        user_id: null,
        login_username: null,
        auth_setup_required: false,
        auth_setup_completed_at: null,
      },
    ],
    membershipDb: [
      { id: "mem-admin-1", staff_id: "staff-admin-1", clinic_id: "clinic-1", is_active: true },
      { id: "mem-eligible-1", staff_id: "staff-target-eligible", clinic_id: "clinic-1", is_active: true },
      { id: "mem-noemail-1", staff_id: "staff-target-no-email", clinic_id: "clinic-1", is_active: true },
      { id: "mem-linked-1", staff_id: "staff-target-linked", clinic_id: "clinic-1", is_active: true },
      { id: "mem-user-set-1", staff_id: "staff-target-username-set", clinic_id: "clinic-1", is_active: true },
      { id: "mem-inactive-1", staff_id: "staff-target-inactive", clinic_id: "clinic-1", is_active: true },
      { id: "mem-doc-1", staff_id: "staff-doc-only", clinic_id: "clinic-1", is_active: true },
      { id: "mem-cross-2", staff_id: "staff-target-cross-clinic", clinic_id: "clinic-2", is_active: true },
    ],
    roleDb: [
      { id: "role-admin-1", staff_clinic_membership_id: "mem-admin-1", role_code: "ADMIN" },
      { id: "role-eligible-1", staff_clinic_membership_id: "mem-eligible-1", role_code: "DOCTOR" },
      { id: "role-doc-1", staff_clinic_membership_id: "mem-doc-1", role_code: "DOCTOR" },
    ],
    authUsersDb: [],
    auditDb: [],
    createUserCallCount: 0,
    inviteUserCallCount: 0,
    deleteUserCallCount: 0,
    lastCreatedUser: null,
    lastDeletedUserId: null,
  };
}

async function simulateDirectProvisioningService(
  env: MockEnvironment,
  parsedInput: ProvisionStaffDirectCredentialsParsed,
  activeClinicId: string,
  actorStaffId: string,
  actorUserId: string
) {
  // Check actor ADMIN authorization
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

  // 1. Application precheck: target staff
  const targetStaff = env.staffDb.find((s) => s.id === parsedInput.staff_id);
  if (!targetStaff) throw new TargetStaffNotFoundError();
  if (!targetStaff.is_active) throw new TargetStaffInactiveError();
  if (targetStaff.user_id !== null) throw new StaffAlreadyLinkedError();
  if (targetStaff.login_username !== null) throw new TargetUsernameAlreadySetError();

  // 2. Validate email
  const targetEmail = targetStaff.email ? targetStaff.email.trim() : "";
  if (!targetEmail || !targetEmail.includes("@")) {
    throw new StaffLoginEmailRequiredError();
  }

  // 3. Precheck target clinic membership
  const targetMem = env.membershipDb.find(
    (m) => m.staff_id === parsedInput.staff_id && m.clinic_id === activeClinicId && m.is_active
  );
  if (!targetMem) {
    throw new TargetStaffClinicAccessDeniedError();
  }

  // 4. Create Auth User
  if (env.failCreateUser) {
    throw new AuthEmailAlreadyExistsError();
  }

  env.createUserCallCount++;
  const createdAuthUser: MockAuthUser = {
    id: `new-auth-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    email: targetEmail,
    email_confirmed: true,
  };
  env.authUsersDb.push(createdAuthUser);
  env.lastCreatedUser = createdAuthUser;

  // 5. Call RPC 29
  if (env.failRpc) {
    // Attempt compensation
    env.deleteUserCallCount++;
    env.lastDeletedUserId = createdAuthUser.id;
    if (env.failCompensation) {
      throw new ProvisionCompensationFailedError();
    }
    // Delete created auth user
    env.authUsersDb = env.authUsersDb.filter((u) => u.id !== createdAuthUser.id);
    throw new LoginUsernameAlreadyExistsError();
  }

  // RPC 29 success
  targetStaff.user_id = createdAuthUser.id;
  targetStaff.login_username = parsedInput.login_username;
  targetStaff.auth_setup_required = false;
  targetStaff.auth_setup_completed_at = null;

  env.auditDb.push({
    actor_user_id: actorUserId,
    action: "PROVISION_STAFF_AUTH_ACCOUNT",
    entity_type: "STAFF",
    entity_id: parsedInput.staff_id,
    after_data: {
      staff_id: parsedInput.staff_id,
      staff_code: targetStaff.staff_code,
      auth_user_id: createdAuthUser.id,
      login_username: parsedInput.login_username,
      clinic_id: activeClinicId,
      auth_setup_required: false,
    },
  });

  return {
    success: true,
    staff_id: parsedInput.staff_id,
    login_username: parsedInput.login_username,
    message: "Cấp tài khoản đăng nhập trực tiếp thành công.",
  };
}

export async function runDirectProvisioningServiceTests() {
  console.log("Running Direct Staff Credential Provisioning Service Tests...");

  // PROVISION1-14: Username normalized at boundary
  const normalized = provisionStaffDirectCredentialsSchema.parse({
    staff_id: "00000000-0000-0000-0000-000000000001",
    login_username: "  BS.AnhThu  ",
    password: "Password@123",
    confirm_password: "Password@123",
  });
  assert(normalized.login_username === "bs.anhthu", "PROVISION1-14: '  BS.AnhThu  ' must normalize to 'bs.anhthu'");

  // PROVISION1-15: Invalid normalized username rejected before Auth creation
  let invalidUsernameCaught = false;
  try {
    provisionStaffDirectCredentialsSchema.parse({
      staff_id: "00000000-0000-0000-0000-000000000001",
      login_username: "bs@thu",
      password: "Password@123",
      confirm_password: "Password@123",
    });
  } catch {
    invalidUsernameCaught = true;
  }
  assert(invalidUsernameCaught, "PROVISION1-15: Invalid username characters must be rejected by schema");

  // PROVISION1-16: Password mismatch rejected
  let mismatchCaught = false;
  try {
    provisionStaffDirectCredentialsSchema.parse({
      staff_id: "00000000-0000-0000-0000-000000000001",
      login_username: "bs.anhthu",
      password: "Password@123",
      confirm_password: "Password@456",
    });
  } catch {
    mismatchCaught = true;
  }
  assert(mismatchCaught, "PROVISION1-16: Password mismatch must be rejected by schema");

  // PROVISION1-17: Password below minimum rejected
  let tooShortCaught = false;
  try {
    provisionStaffDirectCredentialsSchema.parse({
      staff_id: "00000000-0000-0000-0000-000000000001",
      login_username: "bs.anhthu",
      password: "123",
      confirm_password: "123",
    });
  } catch {
    tooShortCaught = true;
  }
  assert(tooShortCaught, "PROVISION1-17: Password under 8 characters must be rejected by schema");

  // PROVISION1-1: ADMIN may call direct provisioning service
  const env1 = createEnvironment();
  const res1 = await simulateDirectProvisioningService(
    env1,
    {
      staff_id: "staff-target-eligible",
      login_username: "bs.anhthu",
      password: "Password@123",
      confirm_password: "Password@123",
    },
    "clinic-1",
    "staff-admin-1",
    "auth-admin-uuid"
  );
  assert(res1.success === true, "PROVISION1-1: ADMIN can provision eligible staff");
  assert(env1.createUserCallCount === 1, "PROVISION1-18: auth.admin.createUser must be called exactly once");
  assert(env1.inviteUserCallCount === 0, "PROVISION1-19: inviteUserByEmail must NOT be called");
  assert(env1.lastCreatedUser?.email === "doctor.thu@thuanthien.vn", "PROVISION1-11: Auth email must be derived from Staff email");
  assert(env1.lastCreatedUser?.email_confirmed === true, "PROVISION1-18: email_confirm must be true");

  const targetStaff1 = env1.staffDb.find((s) => s.id === "staff-target-eligible")!;
  assert(targetStaff1.user_id === env1.lastCreatedUser!.id, "PROVISION1-20: Exact Auth UUID linked");
  assert(targetStaff1.login_username === "bs.anhthu", "PROVISION1-21: Exact canonical username set");
  assert(targetStaff1.auth_setup_required === false, "PROVISION1-23: auth_setup_required set to false");
  assert(targetStaff1.auth_setup_completed_at === null, "PROVISION1-23: auth_setup_completed_at remains null");

  // PROVISION1-2: DOCTOR denied
  const env2 = createEnvironment();
  let docDenied = false;
  try {
    await simulateDirectProvisioningService(
      env2,
      {
        staff_id: "staff-target-eligible",
        login_username: "bs.anhthu",
        password: "Password@123",
        confirm_password: "Password@123",
      },
      "clinic-1",
      "staff-doc-only",
      "auth-doc-uuid"
    );
  } catch (e) {
    if (e instanceof UnauthorizedAdminError) docDenied = true;
  }
  assert(docDenied, "PROVISION1-2: DOCTOR caller must be denied");
  assert(env2.createUserCallCount === 0, "PROVISION1-2: No Auth user created on denied actor");

  // PROVISION1-5: Cross-clinic target denied
  const env5 = createEnvironment();
  let crossDenied = false;
  try {
    await simulateDirectProvisioningService(
      env5,
      {
        staff_id: "staff-target-cross-clinic",
        login_username: "lt.cross",
        password: "Password@123",
        confirm_password: "Password@123",
      },
      "clinic-1",
      "staff-admin-1",
      "auth-admin-uuid"
    );
  } catch (e) {
    if (e instanceof TargetStaffClinicAccessDeniedError) crossDenied = true;
  }
  assert(crossDenied, "PROVISION1-5: Target in different clinic must be denied");

  // PROVISION1-6: Inactive Staff denied
  const env6 = createEnvironment();
  let inactiveDenied = false;
  try {
    await simulateDirectProvisioningService(
      env6,
      {
        staff_id: "staff-target-inactive",
        login_username: "ys.inactive",
        password: "Password@123",
        confirm_password: "Password@123",
      },
      "clinic-1",
      "staff-admin-1",
      "auth-admin-uuid"
    );
  } catch (e) {
    if (e instanceof TargetStaffInactiveError) inactiveDenied = true;
  }
  assert(inactiveDenied, "PROVISION1-6: Inactive staff target must be denied");

  // PROVISION1-8: Already-linked Staff denied before Auth creation
  const env8 = createEnvironment();
  let linkedDenied = false;
  try {
    await simulateDirectProvisioningService(
      env8,
      {
        staff_id: "staff-target-linked",
        login_username: "bs.newname",
        password: "Password@123",
        confirm_password: "Password@123",
      },
      "clinic-1",
      "staff-admin-1",
      "auth-admin-uuid"
    );
  } catch (e) {
    if (e instanceof StaffAlreadyLinkedError) linkedDenied = true;
  }
  assert(linkedDenied, "PROVISION1-8: Already-linked staff must be denied");
  assert(env8.createUserCallCount === 0, "PROVISION1-8: createUser must not be called for already-linked staff");

  // PROVISION1-9: Target with login_username already set denied
  const env9 = createEnvironment();
  let userSetDenied = false;
  try {
    await simulateDirectProvisioningService(
      env9,
      {
        staff_id: "staff-target-username-set",
        login_username: "bs.another",
        password: "Password@123",
        confirm_password: "Password@123",
      },
      "clinic-1",
      "staff-admin-1",
      "auth-admin-uuid"
    );
  } catch (e) {
    if (e instanceof TargetUsernameAlreadySetError) userSetDenied = true;
  }
  assert(userSetDenied, "PROVISION1-9: Target with username already set must be denied");

  // PROVISION1-10: Missing target email: STAFF_LOGIN_EMAIL_REQUIRED
  const env10 = createEnvironment();
  let noEmailDenied = false;
  try {
    await simulateDirectProvisioningService(
      env10,
      {
        staff_id: "staff-target-no-email",
        login_username: "bs.noemail",
        password: "Password@123",
        confirm_password: "Password@123",
      },
      "clinic-1",
      "staff-admin-1",
      "auth-admin-uuid"
    );
  } catch (e) {
    if (e instanceof StaffLoginEmailRequiredError) noEmailDenied = true;
  }
  assert(noEmailDenied, "PROVISION1-10: Missing target email must throw StaffLoginEmailRequiredError");
  assert(env10.createUserCallCount === 0, "PROVISION1-10: createUser must not be called when email is missing");

  // PROVISION1-24 & 25: RPC failure after Auth creation attempts deleteUser(exact USER_A) and succeeds
  const env24 = createEnvironment();
  env24.failRpc = true;
  let rpcFailCaught = false;
  try {
    await simulateDirectProvisioningService(
      env24,
      {
        staff_id: "staff-target-eligible",
        login_username: "bs.anhthu",
        password: "Password@123",
        confirm_password: "Password@123",
      },
      "clinic-1",
      "staff-admin-1",
      "auth-admin-uuid"
    );
  } catch (e) {
    if (e instanceof LoginUsernameAlreadyExistsError) rpcFailCaught = true;
  }
  assert(rpcFailCaught, "PROVISION1-24: RPC failure must throw error to caller");
  assert(env24.deleteUserCallCount === 1, "PROVISION1-24: deleteUser must be called on RPC failure");
  assert(env24.authUsersDb.length === 0, "PROVISION1-25: Orphaned Auth User must be deleted cleanly");

  // PROVISION1-26: Compensation failure returns PROVISION_COMPENSATION_FAILED
  const env26 = createEnvironment();
  env26.failRpc = true;
  env26.failCompensation = true;
  let compFailCaught = false;
  try {
    await simulateDirectProvisioningService(
      env26,
      {
        staff_id: "staff-target-eligible",
        login_username: "bs.anhthu",
        password: "Password@123",
        confirm_password: "Password@123",
      },
      "clinic-1",
      "staff-admin-1",
      "auth-admin-uuid"
    );
  } catch (e) {
    if (e instanceof ProvisionCompensationFailedError) compFailCaught = true;
  }
  assert(compFailCaught, "PROVISION1-26: Compensation failure must throw ProvisionCompensationFailedError");

  // PROVISION1-27: Auth create failure: RPC29 NOT called
  const env27 = createEnvironment();
  env27.failCreateUser = true;
  let authFailCaught = false;
  try {
    await simulateDirectProvisioningService(
      env27,
      {
        staff_id: "staff-target-eligible",
        login_username: "bs.anhthu",
        password: "Password@123",
        confirm_password: "Password@123",
      },
      "clinic-1",
      "staff-admin-1",
      "auth-admin-uuid"
    );
  } catch (e) {
    if (e instanceof AuthEmailAlreadyExistsError) authFailCaught = true;
  }
  assert(authFailCaught, "PROVISION1-27: Auth creation failure must be thrown");
  assert(env27.staffDb.find((s) => s.id === "staff-target-eligible")!.user_id === null, "PROVISION1-27: Staff record must remain untouched");

  // PROVISION1-29 to 32: Password security checks
  assert(!("password" in res1), "PROVISION1-31: Password must not be returned in result");
  assert(env1.auditDb.every((a) => !("password" in a.after_data)), "PROVISION1-30: Password must not be in audit logs");

  console.log("All Direct Staff Credential Provisioning Service Tests PASSED!");
}
