import * as fs from "node:fs";
import * as path from "node:path";

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
  auditDb: MockAuditLog[];
  lockedStaffIds: string[];
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
    auditDb: [],
    lockedStaffIds: [],
  };
}

function simulateAssignStaffLoginUsernameRpc(
  env: MockEnvironment,
  params: {
    p_staff_id: string | null;
    p_clinic_id: string | null;
    p_login_username: string | null;
    p_actor_staff_id: string | null;
    p_actor_user_id: string | null;
  }
) {
  // 1. Parameter validation
  if (!params.p_staff_id || !params.p_clinic_id || !params.p_login_username || !params.p_actor_staff_id || !params.p_actor_user_id) {
    return { success: false, error_code: "INVALID_INPUT", message: "Dữ liệu đầu vào không đầy đủ." };
  }

  // 2. Validate canonical username format
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(params.p_login_username)) {
    return { success: false, error_code: "INVALID_LOGIN_USERNAME", message: "Tên đăng nhập không đúng định dạng chuẩn." };
  }

  // 3. Validate actor Staff integrity and Auth User linkage
  const actor = env.staffDb.find((s) => s.id === params.p_actor_staff_id);
  if (!actor || !actor.is_active || actor.user_id !== params.p_actor_user_id) {
    return { success: false, error_code: "INVALID_ACTOR", message: "Tài khoản người thực hiện không hợp lệ." };
  }

  // 4. Validate actor has active membership and ADMIN role at p_clinic_id
  const actorMem = env.membershipDb.find(
    (m) => m.staff_id === params.p_actor_staff_id && m.clinic_id === params.p_clinic_id && m.is_active
  );
  if (!actorMem) {
    return { success: false, error_code: "UNAUTHORIZED_ADMIN", message: "Bạn không có quyền quản trị (ADMIN) tại cơ sở này." };
  }
  const hasAdminRole = env.roleDb.some(
    (r) => r.staff_clinic_membership_id === actorMem.id && r.role_code === "ADMIN"
  );
  if (!hasAdminRole) {
    return { success: false, error_code: "UNAUTHORIZED_ADMIN", message: "Bạn không có quyền quản trị (ADMIN) tại cơ sở này." };
  }

  // 5. Lock and validate target Staff
  env.lockedStaffIds.push(params.p_staff_id);
  const target = env.staffDb.find((s) => s.id === params.p_staff_id);
  if (!target) {
    return { success: false, error_code: "TARGET_STAFF_NOT_FOUND", message: "Không tìm thấy thông tin hồ sơ nhân viên." };
  }
  if (!target.is_active) {
    return { success: false, error_code: "TARGET_STAFF_INACTIVE", message: "Không thể gán tên đăng nhập cho hồ sơ nhân viên đã bị khóa." };
  }
  if (!target.user_id) {
    return { success: false, error_code: "AUTH_ACCOUNT_MISSING", message: "Nhân viên này chưa được liên kết tài khoản đăng nhập." };
  }
  if (target.login_username !== null) {
    return { success: false, error_code: "LOGIN_USERNAME_ALREADY_ASSIGNED", message: "Nhân viên này đã có tên đăng nhập trong hệ thống." };
  }

  // 6. Validate target Staff has active membership at p_clinic_id
  const targetMem = env.membershipDb.find(
    (m) => m.staff_id === params.p_staff_id && m.clinic_id === params.p_clinic_id && m.is_active
  );
  if (!targetMem) {
    return { success: false, error_code: "TARGET_STAFF_NOT_ACCESSIBLE", message: "Nhân viên không có phân công làm việc tại cơ sở này." };
  }

  // 7. Check if login_username is already taken by another staff row
  if (env.staffDb.some((s) => s.login_username === params.p_login_username && s.id !== params.p_staff_id)) {
    return { success: false, error_code: "LOGIN_USERNAME_ALREADY_EXISTS", message: "Tên đăng nhập này đã được sử dụng." };
  }

  // 8. Assign login_username
  target.login_username = params.p_login_username;

  // 9. Insert audit log inside same transaction
  env.auditDb.push({
    actor_user_id: params.p_actor_user_id,
    action: "ASSIGN_STAFF_LOGIN_USERNAME",
    entity_type: "STAFF",
    entity_id: params.p_staff_id,
    after_data: {
      staff_id: target.id,
      staff_code: target.staff_code,
      full_name: target.full_name,
      auth_user_id: target.user_id,
      login_username: params.p_login_username,
      assigned_by_staff_id: params.p_actor_staff_id,
      clinic_id: params.p_clinic_id,
      assigned_at: new Date().toISOString(),
    },
  });

  return {
    success: true,
    staff_id: target.id,
    staff_code: target.staff_code,
    full_name: target.full_name,
    auth_user_id: target.user_id,
    login_username: params.p_login_username,
    message: "Gán tên đăng nhập cho nhân viên thành công.",
  };
}

export function runAssignUsernameRpcTests() {
  console.log("Running assign_staff_login_username RPC Contract Tests...");

  // Inspect migration 31 SQL file on disk
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260822000031_assign_staff_login_username.sql"
  );
  assert(fs.existsSync(migrationPath), "LEGACY-USERNAME-Migration: Migration 31 file must exist");
  const sql = fs.readFileSync(migrationPath, "utf-8");

  // LEGACY-USERNAME-28: No password parameter
  assert(!sql.includes("p_password"), "LEGACY-USERNAME-28: No password parameter in RPC signature");
  assert(!sql.includes("p_email"), "LEGACY-USERNAME-28: No email parameter in RPC signature");

  // LEGACY-USERNAME-33 & 34: SECURITY DEFINER and fixed search_path
  assert(sql.includes("SECURITY DEFINER"), "LEGACY-USERNAME-33: Must be SECURITY DEFINER");
  assert(sql.includes("SET search_path = public, pg_temp"), "LEGACY-USERNAME-34: Fixed search_path must be public, pg_temp");

  // LEGACY-USERNAME-29 to 32: Permissions
  assert(sql.includes("REVOKE ALL ON FUNCTION public.assign_staff_login_username(UUID, UUID, TEXT, UUID, UUID) FROM PUBLIC;"), "LEGACY-USERNAME-29: Revoke from PUBLIC");
  assert(sql.includes("REVOKE ALL ON FUNCTION public.assign_staff_login_username(UUID, UUID, TEXT, UUID, UUID) FROM anon;"), "LEGACY-USERNAME-30: Revoke from anon");
  assert(sql.includes("REVOKE ALL ON FUNCTION public.assign_staff_login_username(UUID, UUID, TEXT, UUID, UUID) FROM authenticated;"), "LEGACY-USERNAME-31: Revoke from authenticated");
  assert(sql.includes("GRANT EXECUTE ON FUNCTION public.assign_staff_login_username(UUID, UUID, TEXT, UUID, UUID) TO service_role;"), "LEGACY-USERNAME-32: Grant to service_role");

  // LEGACY-USERNAME-13: Target locked FOR UPDATE
  assert(sql.includes("FOR UPDATE"), "LEGACY-USERNAME-13: Target row locked with FOR UPDATE");

  // LEGACY-USERNAME-1: Authorized ADMIN can assign username to linked Staff with NULL username
  const env1 = createEnvironment();
  const res1 = simulateAssignStaffLoginUsernameRpc(env1, {
    p_staff_id: "staff-target-legacy-doctor",
    p_clinic_id: "clinic-1",
    p_login_username: "bs.kha",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-1-uuid",
  });
  assert(res1.success === true, "LEGACY-USERNAME-1: ADMIN can assign username to legacy staff");
  assert(env1.lockedStaffIds.includes("staff-target-legacy-doctor"), "LEGACY-USERNAME-13: Target was locked");
  const targetKha = env1.staffDb.find((s) => s.id === "staff-target-legacy-doctor")!;
  assert(targetKha.login_username === "bs.kha", "LEGACY-USERNAME-1: login_username updated to bs.kha");
  assert(targetKha.user_id === "auth-kha-uuid", "LEGACY-USERNAME-19: staff.user_id preserved");
  assert(targetKha.email === "bs.kha@thuanthien.vn", "LEGACY-USERNAME-20: staff.email preserved");
  assert(targetKha.auth_setup_required === true, "LEGACY-USERNAME-21: auth_setup_required preserved");
  assert(targetKha.auth_setup_completed_at === null, "LEGACY-USERNAME-22: auth_setup_completed_at preserved");

  // LEGACY-USERNAME-2: ADMIN may assign username to own Staff record
  const env2 = createEnvironment();
  const res2 = simulateAssignStaffLoginUsernameRpc(env2, {
    p_staff_id: "staff-admin-legacy",
    p_clinic_id: "clinic-1",
    p_login_username: "admin.legacy",
    p_actor_staff_id: "staff-admin-legacy",
    p_actor_user_id: "auth-admin-legacy-uuid",
  });
  assert(res2.success === true, "LEGACY-USERNAME-2: ADMIN self-assignment permitted");

  // LEGACY-USERNAME-3: DOCTOR denied
  const env3 = createEnvironment();
  const res3 = simulateAssignStaffLoginUsernameRpc(env3, {
    p_staff_id: "staff-target-legacy-doctor",
    p_clinic_id: "clinic-1",
    p_login_username: "bs.kha",
    p_actor_staff_id: "staff-doctor-actor",
    p_actor_user_id: "auth-doc-uuid",
  });
  assert(res3.success === false && res3.error_code === "UNAUTHORIZED_ADMIN", "LEGACY-USERNAME-3: DOCTOR denied");

  // LEGACY-USERNAME-6: MANAGER without ADMIN denied
  const env6 = createEnvironment();
  const res6 = simulateAssignStaffLoginUsernameRpc(env6, {
    p_staff_id: "staff-target-legacy-doctor",
    p_clinic_id: "clinic-1",
    p_login_username: "bs.kha",
    p_actor_staff_id: "staff-manager-actor",
    p_actor_user_id: "auth-mgr-uuid",
  });
  assert(res6.success === false && res6.error_code === "UNAUTHORIZED_ADMIN", "LEGACY-USERNAME-6: MANAGER denied");

  // LEGACY-USERNAME-7: Cross-clinic target denied
  const env7 = createEnvironment();
  const res7 = simulateAssignStaffLoginUsernameRpc(env7, {
    p_staff_id: "staff-target-cross-clinic",
    p_clinic_id: "clinic-1",
    p_login_username: "lt.cs2",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-1-uuid",
  });
  assert(res7.success === false && res7.error_code === "TARGET_STAFF_NOT_ACCESSIBLE", "LEGACY-USERNAME-7: Cross-clinic target denied");

  // LEGACY-USERNAME-9: Inactive target denied
  const env9 = createEnvironment();
  const res9 = simulateAssignStaffLoginUsernameRpc(env9, {
    p_staff_id: "staff-target-inactive",
    p_clinic_id: "clinic-1",
    p_login_username: "ys.inactive",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-1-uuid",
  });
  assert(res9.success === false && res9.error_code === "TARGET_STAFF_INACTIVE", "LEGACY-USERNAME-9: Inactive target denied");

  // LEGACY-USERNAME-11: Target user_id NULL rejected
  const env11 = createEnvironment();
  const res11 = simulateAssignStaffLoginUsernameRpc(env11, {
    p_staff_id: "staff-target-unlinked",
    p_clinic_id: "clinic-1",
    p_login_username: "bs.unlinked",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-1-uuid",
  });
  assert(res11.success === false && res11.error_code === "AUTH_ACCOUNT_MISSING", "LEGACY-USERNAME-11: Target without user_id rejected");

  // LEGACY-USERNAME-12: Target existing login_username rejected
  const env12 = createEnvironment();
  const res12 = simulateAssignStaffLoginUsernameRpc(env12, {
    p_staff_id: "staff-target-already-username",
    p_clinic_id: "clinic-1",
    p_login_username: "bs.newthu",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-1-uuid",
  });
  assert(res12.success === false && res12.error_code === "LOGIN_USERNAME_ALREADY_ASSIGNED", "LEGACY-USERNAME-12: Target already has username rejected");

  // LEGACY-USERNAME-15: Uppercase rejected
  const env15 = createEnvironment();
  const res15 = simulateAssignStaffLoginUsernameRpc(env15, {
    p_staff_id: "staff-target-legacy-doctor",
    p_clinic_id: "clinic-1",
    p_login_username: "BS.Kha",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-1-uuid",
  });
  assert(res15.success === false && res15.error_code === "INVALID_LOGIN_USERNAME", "LEGACY-USERNAME-15: Uppercase rejected");

  // LEGACY-USERNAME-16: Whitespace rejected
  const env16 = createEnvironment();
  const res16 = simulateAssignStaffLoginUsernameRpc(env16, {
    p_staff_id: "staff-target-legacy-doctor",
    p_clinic_id: "clinic-1",
    p_login_username: "bs kha",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-1-uuid",
  });
  assert(res16.success === false && res16.error_code === "INVALID_LOGIN_USERNAME", "LEGACY-USERNAME-16: Whitespace rejected");

  // LEGACY-USERNAME-17: Invalid symbol rejected
  const env17 = createEnvironment();
  const res17 = simulateAssignStaffLoginUsernameRpc(env17, {
    p_staff_id: "staff-target-legacy-doctor",
    p_clinic_id: "clinic-1",
    p_login_username: "bs@kha",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-1-uuid",
  });
  assert(res17.success === false && res17.error_code === "INVALID_LOGIN_USERNAME", "LEGACY-USERNAME-17: Invalid symbol rejected");

  // LEGACY-USERNAME-18: Duplicate globally-used username rejected
  const env18 = createEnvironment();
  const res18 = simulateAssignStaffLoginUsernameRpc(env18, {
    p_staff_id: "staff-target-legacy-doctor",
    p_clinic_id: "clinic-1",
    p_login_username: "bs.minhthu",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-1-uuid",
  });
  assert(res18.success === false && res18.error_code === "LOGIN_USERNAME_ALREADY_EXISTS", "LEGACY-USERNAME-18: Duplicate username rejected");

  // LEGACY-USERNAME-26 & 27: Audit action ASSIGN_STAFF_LOGIN_USERNAME
  assert(env1.auditDb.length === 1, "LEGACY-USERNAME-27: Exactly 1 audit record written");
  assert(env1.auditDb[0].action === "ASSIGN_STAFF_LOGIN_USERNAME", "LEGACY-USERNAME-26: Audit action ASSIGN_STAFF_LOGIN_USERNAME");
  assert(env1.auditDb[0].after_data.login_username === "bs.kha", "LEGACY-USERNAME-26: Audit contains assigned username");

  console.log("All assign_staff_login_username RPC Contract Tests PASSED!");
}
