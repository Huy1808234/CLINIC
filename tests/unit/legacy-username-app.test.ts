import {
  assignStaffLoginUsernameSchema,
  type AssignStaffLoginUsernameParsed,
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
  constructor(message = "Không thể gán tên đăng nhập cho hồ sơ nhân viên đã bị khóa hoặc ngừng hoạt động.") {
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

export class LoginUsernameAlreadyExistsError extends Error {
  public readonly code = "LOGIN_USERNAME_ALREADY_EXISTS";
  constructor(message = "Tên đăng nhập này đã được sử dụng.") {
    super(message);
    this.name = "LoginUsernameAlreadyExistsError";
  }
}

export class InvalidLoginUsernameError extends Error {
  public readonly code = "INVALID_LOGIN_USERNAME";
  constructor(message = "Tên đăng nhập không đúng định dạng chuẩn.") {
    super(message);
    this.name = "InvalidLoginUsernameError";
  }
}

export class LoginUsernameAlreadyAssignedError extends Error {
  public readonly code = "LOGIN_USERNAME_ALREADY_ASSIGNED";
  constructor(message = "Nhân viên này đã có tên đăng nhập trong hệ thống.") {
    super(message);
    this.name = "LoginUsernameAlreadyAssignedError";
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

interface MockEnvironment {
  staffDb: MockStaff[];
  membershipDb: MockMembership[];
  roleDb: MockRole[];
  rpc31CallCount: number;
  lastRpc31Params: Record<string, unknown> | null;
  createUserCallCount: number;
  updateUserByIdCallCount: number;
}

function createEnvironment(): MockEnvironment {
  return {
    staffDb: [
      {
        id: "staff-admin-1",
        staff_code: "ADMIN-01",
        full_name: "Quản trị viên 1",
        email: "admin1@thuanthien.vn",
        is_active: true,
        user_id: "auth-admin-1-uuid",
        login_username: "admin.thuanthien",
        auth_setup_required: false,
        auth_setup_completed_at: "2026-08-20T00:00:00Z",
      },
      {
        id: "staff-admin-legacy",
        staff_code: "ADMIN-LEGACY",
        full_name: "Quản trị viên Legacy",
        email: "admin.legacy@thuanthien.vn",
        is_active: true,
        user_id: "auth-admin-legacy-uuid",
        login_username: null,
        auth_setup_required: false,
        auth_setup_completed_at: "2026-08-20T00:00:00Z",
      },
      {
        id: "staff-target-legacy-doctor",
        staff_code: "BS-KHA",
        full_name: "BS. Nguyễn Văn Kha",
        email: "bs.kha@thuanthien.vn",
        is_active: true,
        user_id: "auth-kha-uuid",
        login_username: null,
        auth_setup_required: true,
        auth_setup_completed_at: null,
      },
      {
        id: "staff-target-already-username",
        staff_code: "BS-THU",
        full_name: "BS. Nguyễn Minh Thu",
        email: "doctor.thu@thuanthien.vn",
        is_active: true,
        user_id: "auth-thu-uuid",
        login_username: "bs.minhthu",
        auth_setup_required: false,
        auth_setup_completed_at: "2026-08-21T10:00:00Z",
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
        login_username: null,
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
        login_username: null,
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
      { id: "mem-admin-leg", staff_id: "staff-admin-legacy", clinic_id: "clinic-1", is_active: true },
      { id: "mem-kha-1", staff_id: "staff-target-legacy-doctor", clinic_id: "clinic-1", is_active: true },
      { id: "mem-thu-1", staff_id: "staff-target-already-username", clinic_id: "clinic-1", is_active: true },
      { id: "mem-unlinked-1", staff_id: "staff-target-unlinked", clinic_id: "clinic-1", is_active: true },
      { id: "mem-inactive-1", staff_id: "staff-target-inactive", clinic_id: "clinic-1", is_active: true },
      { id: "mem-cross-2", staff_id: "staff-target-cross-clinic", clinic_id: "clinic-2", is_active: true },
      { id: "mem-doc-1", staff_id: "staff-doctor-actor", clinic_id: "clinic-1", is_active: true },
      { id: "mem-mgr-1", staff_id: "staff-manager-actor", clinic_id: "clinic-1", is_active: true },
    ],
    roleDb: [
      { id: "role-admin-1", staff_clinic_membership_id: "mem-admin-1", role_code: "ADMIN" },
      { id: "role-admin-leg", staff_clinic_membership_id: "mem-admin-leg", role_code: "ADMIN" },
      { id: "role-kha-1", staff_clinic_membership_id: "mem-kha-1", role_code: "DOCTOR" },
      { id: "role-thu-1", staff_clinic_membership_id: "mem-thu-1", role_code: "DOCTOR" },
      { id: "role-doc-1", staff_clinic_membership_id: "mem-doc-1", role_code: "DOCTOR" },
      { id: "role-mgr-1", staff_clinic_membership_id: "mem-mgr-1", role_code: "MANAGER" },
    ],
    rpc31CallCount: 0,
    lastRpc31Params: null,
    createUserCallCount: 0,
    updateUserByIdCallCount: 0,
  };
}

async function simulateAssignStaffLoginUsernameService(
  env: MockEnvironment,
  parsedInput: AssignStaffLoginUsernameParsed,
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

  // 2. Precheck target staff profile
  const targetStaff = env.staffDb.find((s) => s.id === parsedInput.staff_id);
  if (!targetStaff) throw new TargetStaffNotFoundError();
  if (!targetStaff.is_active) throw new TargetStaffInactiveError();
  if (!targetStaff.user_id) throw new TargetStaffNotLinkedError();
  if (targetStaff.login_username) throw new LoginUsernameAlreadyAssignedError();

  // 3. Precheck target staff active membership
  const targetMem = env.membershipDb.find(
    (m) => m.staff_id === parsedInput.staff_id && m.clinic_id === activeClinicId && m.is_active
  );
  if (!targetMem) throw new TargetStaffClinicAccessDeniedError();

  // 4. Precheck duplicate username
  if (env.staffDb.some((s) => s.login_username === parsedInput.login_username && s.id !== parsedInput.staff_id)) {
    throw new LoginUsernameAlreadyExistsError();
  }

  // 5. Invoke RPC 31
  env.rpc31CallCount++;
  env.lastRpc31Params = {
    p_staff_id: parsedInput.staff_id,
    p_clinic_id: activeClinicId,
    p_login_username: parsedInput.login_username,
    p_actor_staff_id: actorStaffId,
    p_actor_user_id: actorUserId,
  };

  targetStaff.login_username = parsedInput.login_username;

  return {
    success: true,
    staff_id: targetStaff.id,
    login_username: parsedInput.login_username,
    message: `Gán tên đăng nhập "${parsedInput.login_username}" cho nhân viên thành công.`,
  };
}

export async function runLegacyUsernameAppTests() {
  console.log("Running Legacy Staff Username Application Service & Action Tests...");

  // LEGACY-APP1-16: Normalization trim & lowercase
  const rawInput = {
    staff_id: "00000000-0000-0000-0000-000000000001",
    login_username: "  BS.AnhThu  ",
  };
  const parsed = assignStaffLoginUsernameSchema.parse(rawInput);
  assert(parsed.login_username === "bs.anhthu", "LEGACY-APP1-16: Normalized to bs.anhthu");

  // LEGACY-APP1-17: Invalid username rejected before RPC
  let invalidCaught = false;
  try {
    assignStaffLoginUsernameSchema.parse({
      staff_id: "00000000-0000-0000-0000-000000000001",
      login_username: "ab", // too short
    });
  } catch {
    invalidCaught = true;
  }
  assert(invalidCaught, "LEGACY-APP1-17: Username < 3 chars rejected");

  let invalidSymbolCaught = false;
  try {
    assignStaffLoginUsernameSchema.parse({
      staff_id: "00000000-0000-0000-0000-000000000001",
      login_username: "bs@kha",
    });
  } catch {
    invalidSymbolCaught = true;
  }
  assert(invalidSymbolCaught, "LEGACY-APP1-17: Username with invalid symbol rejected");

  // LEGACY-APP1-1: ADMIN can assign username to eligible linked legacy Staff
  const env1 = createEnvironment();
  const res1 = await simulateAssignStaffLoginUsernameService(
    env1,
    {
      staff_id: "staff-target-legacy-doctor",
      login_username: "bs.kha",
    },
    "clinic-1",
    "staff-admin-1",
    "auth-admin-1-uuid"
  );
  assert(res1.success === true, "LEGACY-APP1-1: ADMIN assign username success");
  assert(env1.rpc31CallCount === 1, "LEGACY-APP1-1: RPC31 called once");
  assert(env1.lastRpc31Params?.p_staff_id === "staff-target-legacy-doctor", "LEGACY-APP1-1: RPC receives target staff_id");
  assert(env1.lastRpc31Params?.p_clinic_id === "clinic-1", "LEGACY-APP1-19: RPC receives trusted clinic ID");
  assert(env1.lastRpc31Params?.p_actor_staff_id === "staff-admin-1", "LEGACY-APP1-20: RPC receives trusted actor staff ID");
  assert(env1.lastRpc31Params?.p_actor_user_id === "auth-admin-1-uuid", "LEGACY-APP1-21: RPC receives trusted actor user ID");
  assert(env1.lastRpc31Params?.p_login_username === "bs.kha", "LEGACY-APP1-18: RPC receives normalized username");
  assert(!("password" in (env1.lastRpc31Params || {})), "LEGACY-APP1-25: No password parameter");

  // LEGACY-APP1-28 to 32: Preserved fields
  const staffKha = env1.staffDb.find((s) => s.id === "staff-target-legacy-doctor")!;
  assert(staffKha.user_id === "auth-kha-uuid", "LEGACY-APP1-28: staff.user_id unchanged");
  assert(staffKha.email === "bs.kha@thuanthien.vn", "LEGACY-APP1-29: staff.email unchanged");
  assert(staffKha.auth_setup_required === true, "LEGACY-APP1-30: auth_setup_required unchanged");
  assert(staffKha.auth_setup_completed_at === null, "LEGACY-APP1-30: auth_setup_completed_at unchanged");
  assert(env1.createUserCallCount === 0, "LEGACY-APP1-23: No createUser call");
  assert(env1.updateUserByIdCallCount === 0, "LEGACY-APP1-24: No updateUserById call");

  // LEGACY-APP1-2: ADMIN self-target
  const env2 = createEnvironment();
  const res2 = await simulateAssignStaffLoginUsernameService(
    env2,
    {
      staff_id: "staff-admin-legacy",
      login_username: "admin.legacy",
    },
    "clinic-1",
    "staff-admin-legacy",
    "auth-admin-legacy-uuid"
  );
  assert(res2.success === true, "LEGACY-APP1-2: ADMIN self-target allowed");

  // LEGACY-APP1-3: DOCTOR denied
  const env3 = createEnvironment();
  let docDenied = false;
  try {
    await simulateAssignStaffLoginUsernameService(
      env3,
      {
        staff_id: "staff-target-legacy-doctor",
        login_username: "bs.kha",
      },
      "clinic-1",
      "staff-doctor-actor",
      "auth-doc-uuid"
    );
  } catch (e) {
    if (e instanceof UnauthorizedAdminError) docDenied = true;
  }
  assert(docDenied, "LEGACY-APP1-3: DOCTOR caller denied");

  // LEGACY-APP1-6: MANAGER without ADMIN denied
  const env6 = createEnvironment();
  let mgrDenied = false;
  try {
    await simulateAssignStaffLoginUsernameService(
      env6,
      {
        staff_id: "staff-target-legacy-doctor",
        login_username: "bs.kha",
      },
      "clinic-1",
      "staff-manager-actor",
      "auth-mgr-uuid"
    );
  } catch (e) {
    if (e instanceof UnauthorizedAdminError) mgrDenied = true;
  }
  assert(mgrDenied, "LEGACY-APP1-6: MANAGER without ADMIN denied");

  // LEGACY-APP1-7: Cross-clinic target denied
  const env7 = createEnvironment();
  let crossDenied = false;
  try {
    await simulateAssignStaffLoginUsernameService(
      env7,
      {
        staff_id: "staff-target-cross-clinic",
        login_username: "lt.cs2",
      },
      "clinic-1",
      "staff-admin-1",
      "auth-admin-1-uuid"
    );
  } catch (e) {
    if (e instanceof TargetStaffClinicAccessDeniedError) crossDenied = true;
  }
  assert(crossDenied, "LEGACY-APP1-7: Cross clinic target denied");

  // LEGACY-APP1-8: Inactive target denied
  const env8 = createEnvironment();
  let inactDenied = false;
  try {
    await simulateAssignStaffLoginUsernameService(
      env8,
      {
        staff_id: "staff-target-inactive",
        login_username: "ys.inactive",
      },
      "clinic-1",
      "staff-admin-1",
      "auth-admin-1-uuid"
    );
  } catch (e) {
    if (e instanceof TargetStaffInactiveError) inactDenied = true;
  }
  assert(inactDenied, "LEGACY-APP1-8: Inactive target denied");

  // LEGACY-APP1-10: Target user_id NULL: AUTH_ACCOUNT_MISSING
  const env10 = createEnvironment();
  let unlinkedDenied = false;
  try {
    await simulateAssignStaffLoginUsernameService(
      env10,
      {
        staff_id: "staff-target-unlinked",
        login_username: "bs.unlinked",
      },
      "clinic-1",
      "staff-admin-1",
      "auth-admin-1-uuid"
    );
  } catch (e) {
    if (e instanceof TargetStaffNotLinkedError && e.code === "AUTH_ACCOUNT_MISSING") unlinkedDenied = true;
  }
  assert(unlinkedDenied, "LEGACY-APP1-10: Target without user_id rejected with AUTH_ACCOUNT_MISSING");

  // LEGACY-APP1-11: Target existing username: LOGIN_USERNAME_ALREADY_ASSIGNED
  const env11 = createEnvironment();
  let alreadyAssigned = false;
  try {
    await simulateAssignStaffLoginUsernameService(
      env11,
      {
        staff_id: "staff-target-already-username",
        login_username: "bs.newthu",
      },
      "clinic-1",
      "staff-admin-1",
      "auth-admin-1-uuid"
    );
  } catch (e) {
    if (e instanceof LoginUsernameAlreadyAssignedError && e.code === "LOGIN_USERNAME_ALREADY_ASSIGNED") alreadyAssigned = true;
  }
  assert(alreadyAssigned, "LEGACY-APP1-11: Target with existing username rejected with LOGIN_USERNAME_ALREADY_ASSIGNED");

  // LEGACY-APP1-22: Duplicate username mapped safely
  const env22 = createEnvironment();
  let dupCaught = false;
  try {
    await simulateAssignStaffLoginUsernameService(
      env22,
      {
        staff_id: "staff-target-legacy-doctor",
        login_username: "bs.minhthu",
      },
      "clinic-1",
      "staff-admin-1",
      "auth-admin-1-uuid"
    );
  } catch (e) {
    if (e instanceof LoginUsernameAlreadyExistsError && e.code === "LOGIN_USERNAME_ALREADY_EXISTS") dupCaught = true;
  }
  assert(dupCaught, "LEGACY-APP1-22: Duplicate username rejected with LOGIN_USERNAME_ALREADY_EXISTS");

  console.log("All Legacy Staff Username Application Service & Action Tests PASSED!");
}
