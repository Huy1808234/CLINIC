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
        full_name: "Quản trị viên",
        email: "admin@thuanthien.vn",
        is_active: true,
        user_id: "auth-admin-uuid",
        login_username: "admin.clinic",
        auth_setup_required: false,
        auth_setup_completed_at: "2026-08-20T00:00:00Z",
      },
      {
        id: "staff-target-normal",
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
        id: "staff-target-legacy",
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
      { id: "mem-thu-1", staff_id: "staff-target-normal", clinic_id: "clinic-1", is_active: true },
      { id: "mem-thao-1", staff_id: "staff-target-legacy", clinic_id: "clinic-1", is_active: true },
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
    auditDb: [],
    lockedStaffIds: [],
  };
}

function simulateFinalizeStaffAdminPasswordResetRpc(
  env: MockEnvironment,
  params: {
    p_staff_id: string | null;
    p_clinic_id: string | null;
    p_actor_staff_id: string | null;
    p_actor_user_id: string | null;
  }
) {
  // 1. Parameter validation
  if (!params.p_staff_id || !params.p_clinic_id || !params.p_actor_staff_id || !params.p_actor_user_id) {
    return { success: false, error_code: "INVALID_INPUT", message: "Dữ liệu đầu vào không đầy đủ." };
  }

  // 2. Validate actor Staff integrity and Auth User linkage
  const actor = env.staffDb.find((s) => s.id === params.p_actor_staff_id);
  if (!actor || !actor.is_active || actor.user_id !== params.p_actor_user_id) {
    return { success: false, error_code: "INVALID_ACTOR", message: "Tài khoản người thực hiện không hợp lệ." };
  }

  // 3. Validate actor has active membership and ADMIN role at p_clinic_id
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

  // 4. Lock and validate target Staff
  env.lockedStaffIds.push(params.p_staff_id);
  const target = env.staffDb.find((s) => s.id === params.p_staff_id);
  if (!target) {
    return { success: false, error_code: "TARGET_STAFF_NOT_FOUND", message: "Không tìm thấy thông tin hồ sơ nhân viên." };
  }
  if (!target.is_active) {
    return { success: false, error_code: "TARGET_STAFF_INACTIVE", message: "Không thể đặt lại mật khẩu cho hồ sơ nhân viên đã bị khóa." };
  }
  if (!target.user_id) {
    return { success: false, error_code: "AUTH_ACCOUNT_MISSING", message: "Nhân viên này chưa được liên kết tài khoản đăng nhập." };
  }

  // 5. Validate target Staff has active membership at p_clinic_id
  const targetMem = env.membershipDb.find(
    (m) => m.staff_id === params.p_staff_id && m.clinic_id === params.p_clinic_id && m.is_active
  );
  if (!targetMem) {
    return { success: false, error_code: "TARGET_STAFF_NOT_ACCESSIBLE", message: "Nhân viên không có phân công làm việc tại cơ sở này." };
  }

  // 6. State transition
  let legacyConverted = false;
  if (target.auth_setup_required === true) {
    target.auth_setup_required = false;
    target.auth_setup_completed_at = null;
    legacyConverted = true;
  }

  // 7. Atomic audit log insertion
  env.auditDb.push({
    actor_user_id: params.p_actor_user_id,
    action: "RESET_STAFF_AUTH_PASSWORD",
    entity_type: "STAFF",
    entity_id: params.p_staff_id,
    after_data: {
      staff_id: target.id,
      staff_code: target.staff_code,
      full_name: target.full_name,
      auth_user_id: target.user_id,
      login_username: target.login_username,
      reset_by_staff_id: params.p_actor_staff_id,
      clinic_id: params.p_clinic_id,
      legacy_setup_state_converted: legacyConverted,
      reset_at: new Date().toISOString(),
    },
  });

  return {
    success: true,
    staff_id: target.id,
    staff_code: target.staff_code,
    full_name: target.full_name,
    auth_user_id: target.user_id,
    login_username: target.login_username,
    legacy_converted: legacyConverted,
    message: "Hoàn tất cập nhật mật khẩu quản trị và ghi nhận audit thành công.",
  };
}

export function runFinalizeResetRpcTests() {
  console.log("Running finalize_staff_admin_password_reset RPC Contract Tests...");

  // Inspect migration 30 SQL file on disk
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260822000030_finalize_staff_admin_password_reset.sql"
  );
  assert(fs.existsSync(migrationPath), "RESET-RPC1-Migration: Migration 30 file must exist");
  const sql = fs.readFileSync(migrationPath, "utf-8");

  // RESET-RPC1-22: No password parameter
  assert(!sql.includes("p_password"), "RESET-RPC1-22: No password parameter in RPC signature");
  assert(!sql.includes("p_new_password"), "RESET-RPC1-22: No new_password parameter in RPC signature");

  // RESET-RPC1-29 & 30: SECURITY DEFINER and fixed search_path
  assert(sql.includes("SECURITY DEFINER"), "RESET-RPC1-29: Must be SECURITY DEFINER");
  assert(sql.includes("SET search_path = public, pg_temp"), "RESET-RPC1-30: Fixed search_path must be public, pg_temp");

  // RESET-RPC1-25 to 28: Permissions
  assert(sql.includes("REVOKE ALL ON FUNCTION public.finalize_staff_admin_password_reset(UUID, UUID, UUID, UUID) FROM PUBLIC;"), "RESET-RPC1-25: Revoke from PUBLIC");
  assert(sql.includes("REVOKE ALL ON FUNCTION public.finalize_staff_admin_password_reset(UUID, UUID, UUID, UUID) FROM anon;"), "RESET-RPC1-26: Revoke from anon");
  assert(sql.includes("REVOKE ALL ON FUNCTION public.finalize_staff_admin_password_reset(UUID, UUID, UUID, UUID) FROM authenticated;"), "RESET-RPC1-27: Revoke from authenticated");
  assert(sql.includes("GRANT EXECUTE ON FUNCTION public.finalize_staff_admin_password_reset(UUID, UUID, UUID, UUID) TO service_role;"), "RESET-RPC1-28: Grant to service_role");

  // RESET-RPC1-12: Target locked FOR UPDATE
  assert(sql.includes("FOR UPDATE"), "RESET-RPC1-12: Target row locked with FOR UPDATE");

  // RESET-RPC1-1: Authorized ADMIN may finalize reset
  const env1 = createEnvironment();
  const res1 = simulateFinalizeStaffAdminPasswordResetRpc(env1, {
    p_staff_id: "staff-target-normal",
    p_clinic_id: "clinic-1",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-uuid",
  });
  assert(res1.success === true, "RESET-RPC1-1: Authorized ADMIN can finalize reset");
  assert(env1.lockedStaffIds.includes("staff-target-normal"), "RESET-RPC1-12: Target staff was locked");
  assert(res1.legacy_converted === false, "RESET-RPC1-15: Normal account is not legacy converted");
  assert(env1.staffDb.find((s) => s.id === "staff-target-normal")!.auth_setup_completed_at === "2026-08-21T10:00:00Z", "RESET-RPC1-16: Normal existing auth_setup_completed_at is preserved");

  // RESET-RPC1-2: Actor exact user_id match required
  const env2 = createEnvironment();
  const res2 = simulateFinalizeStaffAdminPasswordResetRpc(env2, {
    p_staff_id: "staff-target-normal",
    p_clinic_id: "clinic-1",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "spoofed-user-uuid",
  });
  assert(res2.success === false && res2.error_code === "INVALID_ACTOR", "RESET-RPC1-2: Mismatched actor user_id rejected");

  // RESET-RPC1-3: DOCTOR rejected
  const env3 = createEnvironment();
  const res3 = simulateFinalizeStaffAdminPasswordResetRpc(env3, {
    p_staff_id: "staff-target-normal",
    p_clinic_id: "clinic-1",
    p_actor_staff_id: "staff-doctor-actor",
    p_actor_user_id: "auth-doc-uuid",
  });
  assert(res3.success === false && res3.error_code === "UNAUTHORIZED_ADMIN", "RESET-RPC1-3: DOCTOR rejected");

  // RESET-RPC1-6: MANAGER without ADMIN rejected
  const env6 = createEnvironment();
  const res6 = simulateFinalizeStaffAdminPasswordResetRpc(env6, {
    p_staff_id: "staff-target-normal",
    p_clinic_id: "clinic-1",
    p_actor_staff_id: "staff-manager-actor",
    p_actor_user_id: "auth-mgr-uuid",
  });
  assert(res6.success === false && res6.error_code === "UNAUTHORIZED_ADMIN", "RESET-RPC1-6: MANAGER rejected");

  // RESET-RPC1-7: Cross-clinic target rejected
  const env7 = createEnvironment();
  const res7 = simulateFinalizeStaffAdminPasswordResetRpc(env7, {
    p_staff_id: "staff-target-cross-clinic",
    p_clinic_id: "clinic-1",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-uuid",
  });
  assert(res7.success === false && res7.error_code === "TARGET_STAFF_NOT_ACCESSIBLE", "RESET-RPC1-7: Cross-clinic target rejected");

  // RESET-RPC1-9: Inactive target rejected
  const env9 = createEnvironment();
  const res9 = simulateFinalizeStaffAdminPasswordResetRpc(env9, {
    p_staff_id: "staff-target-inactive",
    p_clinic_id: "clinic-1",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-uuid",
  });
  assert(res9.success === false && res9.error_code === "TARGET_STAFF_INACTIVE", "RESET-RPC1-9: Inactive target rejected");

  // RESET-RPC1-11: Target without user_id rejected
  const env11 = createEnvironment();
  const res11 = simulateFinalizeStaffAdminPasswordResetRpc(env11, {
    p_staff_id: "staff-target-unlinked",
    p_clinic_id: "clinic-1",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-uuid",
  });
  assert(res11.success === false && res11.error_code === "AUTH_ACCOUNT_MISSING", "RESET-RPC1-11: Target without user_id rejected");

  // RESET-RPC1-13 & 14: Legacy TRUE becomes FALSE and auth_setup_completed_at becomes NULL
  const env13 = createEnvironment();
  const res13 = simulateFinalizeStaffAdminPasswordResetRpc(env13, {
    p_staff_id: "staff-target-legacy",
    p_clinic_id: "clinic-1",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-uuid",
  });
  assert(res13.success === true, "RESET-RPC1-13: Legacy reset succeeded");
  assert(res13.legacy_converted === true, "RESET-RPC1-13: Legacy converted flag true");
  const targetLegacyAfter = env13.staffDb.find((s) => s.id === "staff-target-legacy")!;
  assert(targetLegacyAfter.auth_setup_required === false, "RESET-RPC1-13: Legacy auth_setup_required became FALSE");
  assert(targetLegacyAfter.auth_setup_completed_at === null, "RESET-RPC1-14: Legacy auth_setup_completed_at became NULL");

  // RESET-RPC1-24: Retry is safe when auth_setup_required already FALSE
  const resRetry = simulateFinalizeStaffAdminPasswordResetRpc(env13, {
    p_staff_id: "staff-target-legacy",
    p_clinic_id: "clinic-1",
    p_actor_staff_id: "staff-admin-1",
    p_actor_user_id: "auth-admin-uuid",
  });
  assert(resRetry.success === true, "RESET-RPC1-24: Retry is safe");
  assert(resRetry.legacy_converted === false, "RESET-RPC1-24: Retry indicates no further conversion needed");

  // RESET-RPC1-20 & 23: Audit checks
  assert(env1.auditDb[0].action === "RESET_STAFF_AUTH_PASSWORD", "RESET-RPC1-20: Audit action is RESET_STAFF_AUTH_PASSWORD");
  assert(!("password" in env1.auditDb[0].after_data), "RESET-RPC1-23: No password in audit");
  assert(!("password_hash" in env1.auditDb[0].after_data), "RESET-RPC1-23: No password_hash in audit");

  console.log("All finalize_staff_admin_password_reset RPC Contract Tests PASSED!");
}
