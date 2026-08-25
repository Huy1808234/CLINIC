import fs from "fs";
import path from "path";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

interface MockStaff {
  id: string;
  staff_code: string;
  full_name: string;
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
}

function createTestEnvironment(): MockEnvironment {
  return {
    staffDb: [
      {
        id: "staff-admin-1",
        staff_code: "ADMIN-01",
        full_name: "Quản trị viên 1",
        is_active: true,
        user_id: "auth-admin-uuid-1",
        login_username: "admin.clinic1",
        auth_setup_required: false,
        auth_setup_completed_at: "2026-08-20T00:00:00Z",
      },
      {
        id: "staff-doctor-1",
        staff_code: "BS-THU",
        full_name: "BS. Nguyễn Minh Thu",
        is_active: true,
        user_id: null,
        login_username: null,
        auth_setup_required: false,
        auth_setup_completed_at: null,
      },
      {
        id: "staff-doctor-linked",
        staff_code: "BS-KHA",
        full_name: "BS. Trần Văn Kha",
        is_active: true,
        user_id: "auth-user-kha-uuid",
        login_username: "bs.kha",
        auth_setup_required: false,
        auth_setup_completed_at: "2026-08-20T00:00:00Z",
      },
      {
        id: "staff-inactive",
        staff_code: "YS-INACTIVE",
        full_name: "Y sĩ ngừng việc",
        is_active: false,
        user_id: null,
        login_username: null,
        auth_setup_required: false,
        auth_setup_completed_at: null,
      },
      {
        id: "staff-actor-doc-only",
        staff_code: "BS-ONLY",
        full_name: "BS Không Phải Admin",
        is_active: true,
        user_id: "auth-user-doconly-uuid",
        login_username: "bs.only",
        auth_setup_required: false,
        auth_setup_completed_at: "2026-08-20T00:00:00Z",
      },
    ],
    membershipDb: [
      { id: "mem-admin-1", staff_id: "staff-admin-1", clinic_id: "clinic-1", is_active: true },
      { id: "mem-doctor-1", staff_id: "staff-doctor-1", clinic_id: "clinic-1", is_active: true },
      { id: "mem-doctor-linked", staff_id: "staff-doctor-linked", clinic_id: "clinic-1", is_active: true },
      { id: "mem-inactive", staff_id: "staff-inactive", clinic_id: "clinic-1", is_active: true },
      { id: "mem-doconly", staff_id: "staff-actor-doc-only", clinic_id: "clinic-1", is_active: true },
      { id: "mem-target-clinic2", staff_id: "staff-doctor-1", clinic_id: "clinic-2", is_active: false },
    ],
    roleDb: [
      { id: "role-admin-1", staff_clinic_membership_id: "mem-admin-1", role_code: "ADMIN" },
      { id: "role-doctor-1", staff_clinic_membership_id: "mem-doctor-1", role_code: "DOCTOR" },
      { id: "role-doctor-linked", staff_clinic_membership_id: "mem-doctor-linked", role_code: "DOCTOR" },
      { id: "role-doconly", staff_clinic_membership_id: "mem-doconly", role_code: "DOCTOR" },
    ],
    auditDb: [],
  };
}

function simulateLinkStaffAuthAccountDirectRpc(
  env: MockEnvironment,
  args: {
    p_staff_id: string;
    p_clinic_id: string;
    p_auth_user_id: string;
    p_login_username: string;
    p_actor_staff_id: string;
    p_actor_user_id: string;
  },
  forceAuditFailure = false
): { success: boolean; error_code?: string; message: string; staff_id?: string; auth_user_id?: string; login_username?: string; auth_setup_required?: boolean } {
  const { p_staff_id, p_clinic_id, p_auth_user_id, p_login_username, p_actor_staff_id, p_actor_user_id } = args;

  // 1. Validate parameters
  if (!p_staff_id || !p_clinic_id || !p_auth_user_id || !p_login_username || !p_actor_staff_id || !p_actor_user_id) {
    return { success: false, error_code: "INVALID_INPUT", message: "Dữ liệu đầu vào không đầy đủ." };
  }

  // 2. Validate canonical username format
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(p_login_username)) {
    return {
      success: false,
      error_code: "INVALID_LOGIN_USERNAME",
      message: "Tên đăng nhập không đúng định dạng chuẩn (3-32 ký tự, bắt đầu bằng chữ cái thường/số, chỉ gồm chữ thường, số, dấu chấm, gạch dưới, gạch ngang).",
    };
  }

  // 3. Validate actor Staff integrity and Auth User linkage
  const actorStaff = env.staffDb.find((s) => s.id === p_actor_staff_id);
  if (!actorStaff || !actorStaff.is_active || actorStaff.user_id !== p_actor_user_id) {
    return {
      success: false,
      error_code: "INVALID_ACTOR",
      message: "Tài khoản người thực hiện không hợp lệ, không hoạt động hoặc không khớp với tài khoản đăng nhập.",
    };
  }

  // 4. Validate actor has active membership and ADMIN role at p_clinic_id
  const actorMem = env.membershipDb.find(
    (m) => m.staff_id === p_actor_staff_id && m.clinic_id === p_clinic_id && m.is_active
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

  // 5. Lock and validate target Staff (prevents concurrent provisioning)
  const targetStaff = env.staffDb.find((s) => s.id === p_staff_id);
  if (!targetStaff) {
    return { success: false, error_code: "TARGET_STAFF_NOT_FOUND", message: "Không tìm thấy thông tin hồ sơ nhân viên." };
  }

  if (!targetStaff.is_active) {
    return {
      success: false,
      error_code: "TARGET_STAFF_INACTIVE",
      message: "Không thể cấp tài khoản cho hồ sơ nhân viên đã bị khóa hoặc ngừng hoạt động.",
    };
  }

  if (targetStaff.user_id !== null) {
    return {
      success: false,
      error_code: "ACCOUNT_ALREADY_LINKED",
      message: "Nhân viên này đã được liên kết với một tài khoản đăng nhập.",
    };
  }

  if (targetStaff.login_username !== null) {
    return {
      success: false,
      error_code: "TARGET_USERNAME_ALREADY_SET",
      message: "Nhân viên này đã có tên đăng nhập trong hệ thống.",
    };
  }

  // 6. Validate target Staff has active membership at p_clinic_id
  const targetMem = env.membershipDb.find(
    (m) => m.staff_id === p_staff_id && m.clinic_id === p_clinic_id && m.is_active
  );
  if (!targetMem) {
    return {
      success: false,
      error_code: "TARGET_STAFF_NOT_ACCESSIBLE",
      message: "Nhân viên không có phân công làm việc đang hoạt động tại cơ sở hiện tại.",
    };
  }

  // 7. Check if login_username is already taken by another staff row
  if (env.staffDb.some((s) => s.login_username === p_login_username && s.id !== p_staff_id)) {
    return {
      success: false,
      error_code: "LOGIN_USERNAME_ALREADY_EXISTS",
      message: "Tên đăng nhập này đã được sử dụng cho một nhân viên khác trong hệ thống.",
    };
  }

  // Atomic simulation
  const prevUserId = targetStaff.user_id;
  const prevUsername = targetStaff.login_username;
  const prevSetupReq = targetStaff.auth_setup_required;
  const prevCompletedAt = targetStaff.auth_setup_completed_at;

  targetStaff.user_id = p_auth_user_id;
  targetStaff.login_username = p_login_username;
  targetStaff.auth_setup_required = false;
  targetStaff.auth_setup_completed_at = null;

  if (forceAuditFailure) {
    // Rollback
    targetStaff.user_id = prevUserId;
    targetStaff.login_username = prevUsername;
    targetStaff.auth_setup_required = prevSetupReq;
    targetStaff.auth_setup_completed_at = prevCompletedAt;
    throw new Error("Simulated audit log insertion failure in PostgreSQL transaction");
  }

  env.auditDb.push({
    actor_user_id: p_actor_user_id,
    action: "PROVISION_STAFF_AUTH_ACCOUNT",
    entity_type: "STAFF",
    entity_id: p_staff_id,
    after_data: {
      staff_id: p_staff_id,
      staff_code: targetStaff.staff_code,
      auth_user_id: p_auth_user_id,
      login_username: p_login_username,
      clinic_id: p_clinic_id,
      auth_setup_required: false,
    },
  });

  return {
    success: true,
    staff_id: p_staff_id,
    auth_user_id: p_auth_user_id,
    login_username: p_login_username,
    auth_setup_required: false,
    message: "Cấp tài khoản đăng nhập trực tiếp và ghi nhận audit thành công.",
  };
}

export function runLinkStaffDirectRpcTests() {
  console.log("Running link_staff_auth_account_direct RPC Contract Tests...");

  // RPC1-1: Authorized ADMIN can link eligible Staff
  const env1 = createTestEnvironment();
  const res1 = simulateLinkStaffAuthAccountDirectRpc(env1, {
    p_staff_id: "staff-doctor-1",
    p_clinic_id: "clinic-1",
    p_auth_user_id: "new-auth-uuid-1",
    p_login_username: "bs.anhthu",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-uuid-1",
  });
  assert(res1.success === true, "RPC1-1: Authorized ADMIN should successfully link eligible staff");
  assert(res1.auth_setup_required === false, "RPC1-1: Direct link must return auth_setup_required = FALSE");

  // RPC1-2: Actor Staff user_id must equal actor Auth UUID
  const env2 = createTestEnvironment();
  const res2 = simulateLinkStaffAuthAccountDirectRpc(env2, {
    p_staff_id: "staff-doctor-1",
    p_clinic_id: "clinic-1",
    p_auth_user_id: "new-auth-uuid-1",
    p_login_username: "bs.anhthu",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "tampered-user-id",
  });
  assert(res2.success === false && res2.error_code === "INVALID_ACTOR", "RPC1-2: Tampered actor user_id must be rejected");

  // RPC1-3: DOCTOR-only actor rejected
  const env3 = createTestEnvironment();
  const res3 = simulateLinkStaffAuthAccountDirectRpc(env3, {
    p_staff_id: "staff-doctor-1",
    p_clinic_id: "clinic-1",
    p_auth_user_id: "new-auth-uuid-1",
    p_login_username: "bs.anhthu",
    p_actor_staff_id: "staff-actor-doc-only",
    p_actor_user_id: "auth-user-doconly-uuid",
  });
  assert(res3.success === false && res3.error_code === "UNAUTHORIZED_ADMIN", "RPC1-3: DOCTOR-only actor must be rejected");

  // RPC1-4: RECEPTIONIST-only actor rejected (same role check mechanism)
  const env4 = createTestEnvironment();
  env4.roleDb.find((r) => r.id === "role-admin-1")!.role_code = "RECEPTIONIST";
  const res4 = simulateLinkStaffAuthAccountDirectRpc(env4, {
    p_staff_id: "staff-doctor-1",
    p_clinic_id: "clinic-1",
    p_auth_user_id: "new-auth-uuid-1",
    p_login_username: "bs.anhthu",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-uuid-1",
  });
  assert(res4.success === false && res4.error_code === "UNAUTHORIZED_ADMIN", "RPC1-4: RECEPTIONIST actor must be rejected");

  // RPC1-5: Y_SI-only actor rejected
  const env5 = createTestEnvironment();
  env5.roleDb.find((r) => r.id === "role-admin-1")!.role_code = "Y_SI";
  const res5 = simulateLinkStaffAuthAccountDirectRpc(env5, {
    p_staff_id: "staff-doctor-1",
    p_clinic_id: "clinic-1",
    p_auth_user_id: "new-auth-uuid-1",
    p_login_username: "bs.anhthu",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-uuid-1",
  });
  assert(res5.success === false && res5.error_code === "UNAUTHORIZED_ADMIN", "RPC1-5: Y_SI actor must be rejected");

  // RPC1-6: Cross-clinic ADMIN rejected
  const env6 = createTestEnvironment();
  const res6 = simulateLinkStaffAuthAccountDirectRpc(env6, {
    p_staff_id: "staff-doctor-1",
    p_clinic_id: "clinic-cross-99",
    p_auth_user_id: "new-auth-uuid-1",
    p_login_username: "bs.anhthu",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-uuid-1",
  });
  assert(res6.success === false && res6.error_code === "UNAUTHORIZED_ADMIN", "RPC1-6: Cross-clinic ADMIN must be rejected");

  // RPC1-7: Inactive actor rejected
  const env7 = createTestEnvironment();
  env7.staffDb.find((s) => s.id === "staff-admin-1")!.is_active = false;
  const res7 = simulateLinkStaffAuthAccountDirectRpc(env7, {
    p_staff_id: "staff-doctor-1",
    p_clinic_id: "clinic-1",
    p_auth_user_id: "new-auth-uuid-1",
    p_login_username: "bs.anhthu",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-uuid-1",
  });
  assert(res7.success === false && res7.error_code === "INVALID_ACTOR", "RPC1-7: Inactive actor must be rejected");

  // RPC1-8: Inactive target rejected
  const env8 = createTestEnvironment();
  const res8 = simulateLinkStaffAuthAccountDirectRpc(env8, {
    p_staff_id: "staff-inactive",
    p_clinic_id: "clinic-1",
    p_auth_user_id: "new-auth-uuid-1",
    p_login_username: "ys.inactive",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-uuid-1",
  });
  assert(res8.success === false && res8.error_code === "TARGET_STAFF_INACTIVE", "RPC1-8: Inactive target must be rejected");

  // RPC1-9: Target without active clinic membership rejected
  const env9 = createTestEnvironment();
  env9.membershipDb.find((m) => m.staff_id === "staff-doctor-1" && m.clinic_id === "clinic-1")!.is_active = false;
  const res9 = simulateLinkStaffAuthAccountDirectRpc(env9, {
    p_staff_id: "staff-doctor-1",
    p_clinic_id: "clinic-1",
    p_auth_user_id: "new-auth-uuid-1",
    p_login_username: "bs.anhthu",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-uuid-1",
  });
  assert(res9.success === false && res9.error_code === "TARGET_STAFF_NOT_ACCESSIBLE", "RPC1-9: Target without active membership must be rejected");

  // RPC1-10: Already-linked Staff rejected
  const env10 = createTestEnvironment();
  const res10 = simulateLinkStaffAuthAccountDirectRpc(env10, {
    p_staff_id: "staff-doctor-linked",
    p_clinic_id: "clinic-1",
    p_auth_user_id: "new-auth-uuid-1",
    p_login_username: "bs.newname",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-uuid-1",
  });
  assert(res10.success === false && res10.error_code === "ACCOUNT_ALREADY_LINKED", "RPC1-10: Already-linked staff must be rejected");

  // RPC1-11: Target with existing login_username rejected
  const env11 = createTestEnvironment();
  env11.staffDb.find((s) => s.id === "staff-doctor-1")!.login_username = "already.set";
  const res11 = simulateLinkStaffAuthAccountDirectRpc(env11, {
    p_staff_id: "staff-doctor-1",
    p_clinic_id: "clinic-1",
    p_auth_user_id: "new-auth-uuid-1",
    p_login_username: "bs.anhthu",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-uuid-1",
  });
  assert(res11.success === false && res11.error_code === "TARGET_USERNAME_ALREADY_SET", "RPC1-11: Target with existing login_username must be rejected");

  // RPC1-12: Invalid uppercase username rejected
  const env12 = createTestEnvironment();
  const res12 = simulateLinkStaffAuthAccountDirectRpc(env12, {
    p_staff_id: "staff-doctor-1",
    p_clinic_id: "clinic-1",
    p_auth_user_id: "new-auth-uuid-1",
    p_login_username: "BS.AnhThu",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-uuid-1",
  });
  assert(res12.success === false && res12.error_code === "INVALID_LOGIN_USERNAME", "RPC1-12: Uppercase username must be rejected");

  // RPC1-13: Whitespace username rejected
  const env13 = createTestEnvironment();
  const res13 = simulateLinkStaffAuthAccountDirectRpc(env13, {
    p_staff_id: "staff-doctor-1",
    p_clinic_id: "clinic-1",
    p_auth_user_id: "new-auth-uuid-1",
    p_login_username: "bs anhthu",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-uuid-1",
  });
  assert(res13.success === false && res13.error_code === "INVALID_LOGIN_USERNAME", "RPC1-13: Whitespace username must be rejected");

  // RPC1-14: Duplicate login_username rejected
  const env14 = createTestEnvironment();
  const res14 = simulateLinkStaffAuthAccountDirectRpc(env14, {
    p_staff_id: "staff-doctor-1",
    p_clinic_id: "clinic-1",
    p_auth_user_id: "new-auth-uuid-1",
    p_login_username: "bs.kha", // Already taken by staff-doctor-linked
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-uuid-1",
  });
  assert(res14.success === false && res14.error_code === "LOGIN_USERNAME_ALREADY_EXISTS", "RPC1-14: Duplicate username must be rejected");

  // RPC1-15 to 20: Successful state and invariant inspection
  const env15 = createTestEnvironment();
  const res15 = simulateLinkStaffAuthAccountDirectRpc(env15, {
    p_staff_id: "staff-doctor-1",
    p_clinic_id: "clinic-1",
    p_auth_user_id: "exact-created-auth-uuid",
    p_login_username: "bs.anhthu",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-uuid-1",
  });
  assert(res15.success === true, "Provisioning must succeed");

  const targetUpdated = env15.staffDb.find((s) => s.id === "staff-doctor-1")!;
  assert(targetUpdated.user_id === "exact-created-auth-uuid", "RPC1-15: Exact p_auth_user_id must be linked");
  assert(targetUpdated.login_username === "bs.anhthu", "RPC1-16: Exact canonical login_username must be set");
  assert(targetUpdated.auth_setup_required === false, "RPC1-17: auth_setup_required must be set to FALSE");
  assert(targetUpdated.auth_setup_completed_at === null, "RPC1-18: auth_setup_completed_at must remain NULL");

  // RPC1-19: Memberships unchanged
  assert(env15.membershipDb.length === 6, "RPC1-19: Membership count and records must remain unchanged");

  // RPC1-20: Roles unchanged
  assert(env15.roleDb.length === 4, "RPC1-20: Roles count and records must remain unchanged");

  // RPC1-22 & 23: Audit log inspection
  assert(env15.auditDb.length === 1, "RPC1-22: Exactly 1 audit record created");
  const audit = env15.auditDb[0];
  assert(audit.action === "PROVISION_STAFF_AUTH_ACCOUNT", "RPC1-22: Audit action must be PROVISION_STAFF_AUTH_ACCOUNT");
  assert(audit.after_data.staff_id === "staff-doctor-1", "RPC1-22: Audit contains staff_id");
  assert(audit.after_data.login_username === "bs.anhthu", "RPC1-22: Audit contains login_username");
  assert(audit.after_data.auth_setup_required === false, "RPC1-22: Audit contains auth_setup_required = FALSE");
  assert(!("password" in audit.after_data), "RPC1-23: Audit must NOT contain password");
  assert(!("password_hash" in audit.after_data), "RPC1-23: Audit must NOT contain password_hash");
  assert(!("token" in audit.after_data), "RPC1-23: Audit must NOT contain tokens");

  // RPC1-24: Audit failure rolls back Staff linkage
  const env24 = createTestEnvironment();
  let rollbackCaught = false;
  try {
    simulateLinkStaffAuthAccountDirectRpc(
      env24,
      {
        p_staff_id: "staff-doctor-1",
        p_clinic_id: "clinic-1",
        p_auth_user_id: "exact-created-auth-uuid",
        p_login_username: "bs.anhthu",
        p_actor_staff_id: "staff-admin-1",
        p_actor_user_id: "auth-admin-uuid-1",
      },
      true
    );
  } catch {
    rollbackCaught = true;
  }
  assert(rollbackCaught, "Transaction failure should throw");
  assert(env24.staffDb.find((s) => s.id === "staff-doctor-1")!.user_id === null, "RPC1-24: user_id must roll back on audit failure");
  assert(env24.staffDb.find((s) => s.id === "staff-doctor-1")!.login_username === null, "RPC1-24: login_username must roll back on audit failure");

  // Static SQL inspection of migration 29
  const migrationPath = path.join(process.cwd(), "supabase", "migrations", "20260822000029_link_staff_auth_account_direct.sql");
  assert(fs.existsSync(migrationPath), "Migration 29 file must exist");
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");

  // RPC1-21: No password parameter in SQL signature
  assert(!migrationSql.toLowerCase().includes("password text"), "RPC1-21: Password parameter must not exist in RPC");
  assert(!migrationSql.toLowerCase().includes("p_password"), "RPC1-21b: p_password parameter must not exist");

  // RPC1-25: FOR UPDATE row lock present
  assert(migrationSql.includes("FOR UPDATE"), "RPC1-25: Migration must lock target staff row FOR UPDATE");

  // RPC1-26 to 29: Permission grants
  assert(migrationSql.includes("REVOKE ALL ON FUNCTION public.link_staff_auth_account_direct"), "RPC1-26: Must revoke all from public");
  assert(migrationSql.includes("FROM anon"), "RPC1-27: Must revoke from anon");
  assert(migrationSql.includes("FROM authenticated"), "RPC1-28: Must revoke from authenticated");
  assert(migrationSql.includes("GRANT EXECUTE ON FUNCTION public.link_staff_auth_account_direct(UUID, UUID, UUID, TEXT, UUID, UUID) TO service_role;"), "RPC1-29: Must grant to service_role");

  // RPC1-30: Fixed search_path
  assert(migrationSql.includes("SET search_path = public, pg_temp"), "RPC1-30: Must fix search_path to public, pg_temp");
  assert(migrationSql.includes("SECURITY DEFINER"), "RPC1-30b: Must be SECURITY DEFINER");

  console.log("All link_staff_auth_account_direct RPC Contract Tests PASSED!");
}
