import assert from "node:assert/strict";

interface MockStaffRecord {
  id: string;
  user_id: string | null;
  staff_code: string;
  full_name: string;
  is_active: boolean;
}

interface MockClinicRecord {
  id: string;
  clinic_code: string;
  is_active: boolean;
}

interface MockMembershipRecord {
  id: string;
  staff_id: string;
  clinic_id: string;
  is_active: boolean;
  is_primary?: boolean;
}

interface MockRoleRecord {
  staff_clinic_membership_id: string;
  role_code: string;
}

interface MockDbState {
  staff: MockStaffRecord[];
  clinics: MockClinicRecord[];
  memberships: MockMembershipRecord[];
  roles: MockRoleRecord[];
}

/**
 * Pure simulation of the PostgreSQL RPC `public.set_staff_active_with_admin_guard`
 * mirroring the exact SQL logic in migration 20260821000012_guard_last_usable_admin_staff_status.sql.
 */
function simulateSetStaffActiveWithAdminGuard(
  db: MockDbState,
  staffId: string,
  isActive: boolean
) {
  // 1. Resolve target staff row
  const targetStaff = db.staff.find((s) => s.id === staffId);
  if (!targetStaff) {
    return {
      success: false,
      error_code: "TARGET_STAFF_NOT_FOUND",
      message: "Không tìm thấy hồ sơ nhân viên.",
    };
  }

  // 2. Idempotency / No-Op check
  if (targetStaff.is_active === isActive) {
    return {
      success: true,
      data: { id: staffId, is_active: targetStaff.is_active },
    };
  }

  // 3. Activation case (isActive = true)
  if (isActive) {
    targetStaff.is_active = true;
    return {
      success: true,
      data: { id: staffId, is_active: true },
    };
  }

  // 4. Deactivation case (isActive = false)
  // Determine affected active clinics where target staff contributes a usable ADMIN role
  const targetMemberships = db.memberships.filter(
    (m) => m.staff_id === staffId && m.is_active
  );

  const affectedClinicIds: string[] = [];
  for (const mem of targetMemberships) {
    const clinic = db.clinics.find((c) => c.id === mem.clinic_id && c.is_active);
    if (!clinic) continue;

    const hasAdminRole = db.roles.some(
      (r) => r.staff_clinic_membership_id === mem.id && r.role_code === "ADMIN"
    );
    if (hasAdminRole && !affectedClinicIds.includes(clinic.id)) {
      affectedClinicIds.push(clinic.id);
    }
  }

  // Sort deterministically (ORDER BY id)
  affectedClinicIds.sort();

  // 5. If target holds no usable ADMIN role at any active clinic, deactivation is safe
  if (affectedClinicIds.length === 0) {
    targetStaff.is_active = false;
    return {
      success: true,
      data: { id: staffId, is_active: false },
    };
  }

  // 6 & 7. Check remaining usable ADMIN count for each affected clinic
  for (const clinicId of affectedClinicIds) {
    const otherUsableAdmins = db.staff.filter((s) => {
      if (s.id === staffId) return false;
      if (!s.is_active) return false;
      if (!s.user_id) return false;

      const mem = db.memberships.find(
        (m) => m.staff_id === s.id && m.clinic_id === clinicId && m.is_active
      );
      if (!mem) return false;

      return db.roles.some(
        (r) => r.staff_clinic_membership_id === mem.id && r.role_code === "ADMIN"
      );
    });

    if (otherUsableAdmins.length < 1) {
      return {
        success: false,
        error_code: "LAST_USABLE_ADMIN",
        clinic_id: clinicId,
        message: "Không thể khóa nhân viên vì đây là Quản trị viên (ADMIN) đang hoạt động duy nhất của một hoặc nhiều cơ sở.",
      };
    }
  }

  // 8. Atomic update commit
  targetStaff.is_active = false;
  return {
    success: true,
    data: { id: staffId, is_active: false },
  };
}

/**
 * Pure simulation of the PostgreSQL RPC `public.deactivate_staff_membership_with_admin_guard`
 * mirroring the exact SQL logic in migration 20260821000014_guard_last_usable_admin_membership_deactivation.sql.
 */
function simulateDeactivateStaffMembershipWithAdminGuard(
  db: MockDbState,
  membershipId: string
) {
  // 1. Resolve target membership record
  const targetMem = db.memberships.find((m) => m.id === membershipId);
  if (!targetMem) {
    return {
      success: false,
      error_code: "TARGET_MEMBERSHIP_NOT_FOUND",
      message: "Không tìm thấy thông tin phân công cơ sở cần hủy.",
    };
  }

  // 2. Idempotency / No-Op check
  if (!targetMem.is_active) {
    return {
      success: true,
      data: { id: membershipId, is_active: false },
    };
  }

  // 3 & 4. Check clinic active state under lock
  const clinic = db.clinics.find((c) => c.id === targetMem.clinic_id);
  if (!clinic || !clinic.is_active) {
    targetMem.is_active = false;
    return {
      success: true,
      data: { id: membershipId, is_active: false },
    };
  }

  // 5 & 6. Check if target membership holds ADMIN role
  const holdsAdmin = db.roles.some(
    (r) => r.staff_clinic_membership_id === membershipId && r.role_code === "ADMIN"
  );
  if (!holdsAdmin) {
    targetMem.is_active = false;
    return {
      success: true,
      data: { id: membershipId, is_active: false },
    };
  }

  // 7. Post-mutation governance invariant check: verify remaining other usable ADMINs
  const otherUsableAdmins = db.staff.filter((s) => {
    if (!s.is_active || !s.user_id) return false;

    const mem = db.memberships.find(
      (m) =>
        m.staff_id === s.id &&
        m.clinic_id === targetMem.clinic_id &&
        m.is_active &&
        m.id !== membershipId
    );
    if (!mem) return false;

    return db.roles.some(
      (r) => r.staff_clinic_membership_id === mem.id && r.role_code === "ADMIN"
    );
  });

  if (otherUsableAdmins.length < 1) {
    return {
      success: false,
      error_code: "LAST_USABLE_ADMIN",
      clinic_id: targetMem.clinic_id,
      message: "Không thể hủy phân công vì đây là Quản trị viên (ADMIN) đang hoạt động duy nhất của cơ sở này.",
    };
  }

  // 8. Atomic mutation
  targetMem.is_active = false;
  return {
    success: true,
    data: { id: membershipId, is_active: false },
  };
}

/**
 * Pure simulation of the PostgreSQL RPC `public.assign_staff_clinic_roles_with_admin_guard`
 * mirroring the exact SQL logic in migration 20260821000016_fix_role_assignment_usable_admin_transition.sql.
 */
function simulateAssignStaffClinicRolesWithAdminGuard(
  db: MockDbState,
  staffId: string,
  clinicId: string,
  roles: string[],
  isPrimary = false
) {
  // 1. Roles validation
  if (!roles || roles.length === 0) {
    return {
      success: false,
      error_code: "INVALID_ROLES",
      message: "Vui lòng chọn ít nhất một vai trò hợp lệ.",
    };
  }

  const validRoles = ["DOCTOR", "RECEPTIONIST", "TECHNICIAN", "Y_SI", "CSKH", "MANAGER", "ADMIN"];
  for (const r of roles) {
    if (!validRoles.includes(r)) {
      return {
        success: false,
        error_code: "INVALID_ROLES",
        message: `Vai trò không hợp lệ: ${r}`,
      };
    }
  }

  const cleanRoles = Array.from(new Set(roles));

  // 2. Lock & check staff
  const staff = db.staff.find((s) => s.id === staffId);
  if (!staff) {
    return {
      success: false,
      error_code: "TARGET_STAFF_NOT_FOUND",
      message: "Không tìm thấy hồ sơ nhân viên cần phân công.",
    };
  }

  // 2b. Lock & check clinic
  const clinic = db.clinics.find((c) => c.id === clinicId);
  if (!clinic) {
    return {
      success: false,
      error_code: "TARGET_CLINIC_NOT_FOUND",
      message: "Không tìm thấy cơ sở phòng khám cần phân công.",
    };
  }

  // 3 & 4. Determine if target staff currently contributes a USABLE ADMIN at this clinic
  // Exact invariant: clinic active AND staff active AND usable auth (user_id != null) AND membership active AND ADMIN role
  const membership = db.memberships.find(
    (m) => m.staff_id === staffId && m.clinic_id === clinicId
  );

  let currentlyUsableAdmin = false;
  if (
    membership &&
    membership.is_active &&
    clinic.is_active &&
    staff.is_active &&
    staff.user_id !== null
  ) {
    currentlyUsableAdmin = db.roles.some(
      (r) => r.staff_clinic_membership_id === membership.id && r.role_code === "ADMIN"
    );
  }

  const newHasAdmin = cleanRoles.includes("ADMIN");

  // 5. Governance check ONLY if removing a currently USABLE ADMIN contribution from an active clinic
  if (currentlyUsableAdmin && !newHasAdmin) {
    const otherUsableAdmins = db.staff.filter((s) => {
      if (!s.is_active || !s.user_id) return false;
      const mem = db.memberships.find(
        (m) =>
          m.staff_id === s.id &&
          m.clinic_id === clinicId &&
          m.is_active &&
          m.id !== membership?.id
      );
      if (!mem) return false;
      return db.roles.some(
        (r) => r.staff_clinic_membership_id === mem.id && r.role_code === "ADMIN"
      );
    });

    if (otherUsableAdmins.length < 1) {
      return {
        success: false,
        error_code: "LAST_USABLE_ADMIN",
        clinic_id: clinicId,
        message: "Không thể gỡ vai trò Quản trị viên (ADMIN) vì đây là Quản trị viên đang hoạt động duy nhất của cơ sở này.",
      };
    }
  }

  // 6. Upsert membership
  let targetMem = membership;
  if (targetMem) {
    targetMem.is_active = true;
    targetMem.is_primary = isPrimary;
  } else {
    targetMem = {
      id: `mem-${staffId}-${clinicId}`,
      staff_id: staffId,
      clinic_id: clinicId,
      is_active: true,
      is_primary: isPrimary,
    };
    db.memberships.push(targetMem);
  }

  // 7. Atomically replace roles
  db.roles = db.roles.filter((r) => r.staff_clinic_membership_id !== targetMem!.id);
  for (const r of cleanRoles) {
    db.roles.push({
      staff_clinic_membership_id: targetMem.id,
      role_code: r,
    });
  }

  return {
    success: true,
    membership_id: targetMem.id,
    data: {
      staff_id: staffId,
      clinic_id: clinicId,
      membership_id: targetMem.id,
      roles: cleanRoles,
    },
  };
}

export function runStaffGovernanceTests() {
  console.log("Running Staff Governance & Last-Usable-ADMIN Invariant Tests...");

  const clinicTT01: MockClinicRecord = { id: "11111111-1111-1111-1111-111111111111", clinic_code: "TT01", is_active: true };
  const clinicMD01: MockClinicRecord = { id: "22222222-2222-2222-2222-222222222222", clinic_code: "MD01", is_active: true };
  const clinicInactive: MockClinicRecord = { id: "99999999-9999-9999-9999-999999999999", clinic_code: "OLD01", is_active: false };

  // ==========================================
  // STAFF STATUS GOVERNANCE TESTS (STAFF-GOV1B)
  // ==========================================

  // CASE 1: Sole usable ADMIN at TT01 -> Deactivation DENIED, remains active
  {
    const db: MockDbState = {
      clinics: [clinicTT01],
      staff: [{ id: "staff-A", user_id: "user-A", staff_code: "ADM-A", full_name: "Admin A", is_active: true }],
      memberships: [{ id: "mem-A-TT01", staff_id: "staff-A", clinic_id: clinicTT01.id, is_active: true }],
      roles: [{ staff_clinic_membership_id: "mem-A-TT01", role_code: "ADMIN" }],
    };

    const res = simulateSetStaffActiveWithAdminGuard(db, "staff-A", false);
    assert.equal(res.success, false, "CASE 1: Must reject deactivating sole ADMIN");
    assert.equal(res.error_code, "LAST_USABLE_ADMIN");
    assert.equal(db.staff[0].is_active, true, "CASE 1: Staff status must remain active");
  }

  // CASE 2: TT01 has two usable ADMINs A & B -> Deactivating A succeeds, B remains
  {
    const db: MockDbState = {
      clinics: [clinicTT01],
      staff: [
        { id: "staff-A", user_id: "user-A", staff_code: "ADM-A", full_name: "Admin A", is_active: true },
        { id: "staff-B", user_id: "user-B", staff_code: "ADM-B", full_name: "Admin B", is_active: true },
      ],
      memberships: [
        { id: "mem-A-TT01", staff_id: "staff-A", clinic_id: clinicTT01.id, is_active: true },
        { id: "mem-B-TT01", staff_id: "staff-B", clinic_id: clinicTT01.id, is_active: true },
      ],
      roles: [
        { staff_clinic_membership_id: "mem-A-TT01", role_code: "ADMIN" },
        { staff_clinic_membership_id: "mem-B-TT01", role_code: "ADMIN" },
      ],
    };

    const res = simulateSetStaffActiveWithAdminGuard(db, "staff-A", false);
    assert.equal(res.success, true, "CASE 2: Allowed when another usable ADMIN exists");
    assert.equal(db.staff.find((s) => s.id === "staff-A")?.is_active, false, "Staff A deactivated");
    assert.equal(db.staff.find((s) => s.id === "staff-B")?.is_active, true, "Staff B remains active");
  }

  // CASE 3: Staff A is ADMIN at TT01 & MD01. TT01 has B, but MD01 has NO other ADMIN -> ENTIRE mutation denied
  {
    const db: MockDbState = {
      clinics: [clinicTT01, clinicMD01],
      staff: [
        { id: "staff-A", user_id: "user-A", staff_code: "ADM-A", full_name: "Admin A", is_active: true },
        { id: "staff-B", user_id: "user-B", staff_code: "ADM-B", full_name: "Admin B", is_active: true },
      ],
      memberships: [
        { id: "mem-A-TT01", staff_id: "staff-A", clinic_id: clinicTT01.id, is_active: true },
        { id: "mem-A-MD01", staff_id: "staff-A", clinic_id: clinicMD01.id, is_active: true },
        { id: "mem-B-TT01", staff_id: "staff-B", clinic_id: clinicTT01.id, is_active: true },
      ],
      roles: [
        { staff_clinic_membership_id: "mem-A-TT01", role_code: "ADMIN" },
        { staff_clinic_membership_id: "mem-A-MD01", role_code: "ADMIN" },
        { staff_clinic_membership_id: "mem-B-TT01", role_code: "ADMIN" },
      ],
    };

    const res = simulateSetStaffActiveWithAdminGuard(db, "staff-A", false);
    assert.equal(res.success, false, "CASE 3: Must deny multi-clinic staff if ANY active clinic loses last admin");
    assert.equal(res.error_code, "LAST_USABLE_ADMIN");
    assert.equal(res.clinic_id, clinicMD01.id);
    assert.equal(db.staff.find((s) => s.id === "staff-A")?.is_active, true, "A remains active globally");
  }

  // CASE 4: A is not ADMIN anywhere (DOCTOR only) -> Deactivation allowed
  {
    const db: MockDbState = {
      clinics: [clinicTT01],
      staff: [
        { id: "staff-DOC", user_id: "user-DOC", staff_code: "DOC-1", full_name: "Dr One", is_active: true },
      ],
      memberships: [{ id: "mem-DOC-TT01", staff_id: "staff-DOC", clinic_id: clinicTT01.id, is_active: true }],
      roles: [{ staff_clinic_membership_id: "mem-DOC-TT01", role_code: "DOCTOR" }],
    };

    const res = simulateSetStaffActiveWithAdminGuard(db, "staff-DOC", false);
    assert.equal(res.success, true, "CASE 4: Non-admin staff can be deactivated without invariant check");
    assert.equal(db.staff[0].is_active, false);
  }

  // CASE 5: Other ADMIN exists but staff.is_active = false -> Does NOT count as usable
  {
    const db: MockDbState = {
      clinics: [clinicTT01],
      staff: [
        { id: "staff-A", user_id: "user-A", staff_code: "ADM-A", full_name: "Admin A", is_active: true },
        { id: "staff-B", user_id: "user-B", staff_code: "ADM-B", full_name: "Admin B", is_active: false }, // Inactive staff!
      ],
      memberships: [
        { id: "mem-A-TT01", staff_id: "staff-A", clinic_id: clinicTT01.id, is_active: true },
        { id: "mem-B-TT01", staff_id: "staff-B", clinic_id: clinicTT01.id, is_active: true },
      ],
      roles: [
        { staff_clinic_membership_id: "mem-A-TT01", role_code: "ADMIN" },
        { staff_clinic_membership_id: "mem-B-TT01", role_code: "ADMIN" },
      ],
    };

    const res = simulateSetStaffActiveWithAdminGuard(db, "staff-A", false);
    assert.equal(res.success, false, "CASE 5: Inactive other ADMIN does not count");
    assert.equal(res.error_code, "LAST_USABLE_ADMIN");
  }

  // CASE 6: Other ADMIN membership is inactive -> Does NOT count as usable
  {
    const db: MockDbState = {
      clinics: [clinicTT01],
      staff: [
        { id: "staff-A", user_id: "user-A", staff_code: "ADM-A", full_name: "Admin A", is_active: true },
        { id: "staff-B", user_id: "user-B", staff_code: "ADM-B", full_name: "Admin B", is_active: true },
      ],
      memberships: [
        { id: "mem-A-TT01", staff_id: "staff-A", clinic_id: clinicTT01.id, is_active: true },
        { id: "mem-B-TT01", staff_id: "staff-B", clinic_id: clinicTT01.id, is_active: false }, // Inactive membership!
      ],
      roles: [
        { staff_clinic_membership_id: "mem-A-TT01", role_code: "ADMIN" },
        { staff_clinic_membership_id: "mem-B-TT01", role_code: "ADMIN" },
      ],
    };

    const res = simulateSetStaffActiveWithAdminGuard(db, "staff-A", false);
    assert.equal(res.success, false, "CASE 6: Inactive membership does not count");
    assert.equal(res.error_code, "LAST_USABLE_ADMIN");
  }

  // CASE 7: Other staff has DOCTOR role only -> Does NOT count
  {
    const db: MockDbState = {
      clinics: [clinicTT01],
      staff: [
        { id: "staff-A", user_id: "user-A", staff_code: "ADM-A", full_name: "Admin A", is_active: true },
        { id: "staff-B", user_id: "user-B", staff_code: "DOC-B", full_name: "Doc B", is_active: true },
      ],
      memberships: [
        { id: "mem-A-TT01", staff_id: "staff-A", clinic_id: clinicTT01.id, is_active: true },
        { id: "mem-B-TT01", staff_id: "staff-B", clinic_id: clinicTT01.id, is_active: true },
      ],
      roles: [
        { staff_clinic_membership_id: "mem-A-TT01", role_code: "ADMIN" },
        { staff_clinic_membership_id: "mem-B-TT01", role_code: "DOCTOR" }, // Not ADMIN!
      ],
    };

    const res = simulateSetStaffActiveWithAdminGuard(db, "staff-A", false);
    assert.equal(res.success, false, "CASE 7: Non-ADMIN role does not count");
    assert.equal(res.error_code, "LAST_USABLE_ADMIN");
  }

  // CASE 8: Other staff has ADMIN role but user_id is null (unlinked) -> Does NOT count
  {
    const db: MockDbState = {
      clinics: [clinicTT01],
      staff: [
        { id: "staff-A", user_id: "user-A", staff_code: "ADM-A", full_name: "Admin A", is_active: true },
        { id: "staff-B", user_id: null, staff_code: "ADM-B", full_name: "Admin B Unlinked", is_active: true }, // Unlinked!
      ],
      memberships: [
        { id: "mem-A-TT01", staff_id: "staff-A", clinic_id: clinicTT01.id, is_active: true },
        { id: "mem-B-TT01", staff_id: "staff-B", clinic_id: clinicTT01.id, is_active: true },
      ],
      roles: [
        { staff_clinic_membership_id: "mem-A-TT01", role_code: "ADMIN" },
        { staff_clinic_membership_id: "mem-B-TT01", role_code: "ADMIN" },
      ],
    };

    const res = simulateSetStaffActiveWithAdminGuard(db, "staff-A", false);
    assert.equal(res.success, false, "CASE 8: Unlinked staff does not count as usable ADMIN");
    assert.equal(res.error_code, "LAST_USABLE_ADMIN");
  }

  // CASE 9: Clinic is inactive -> Deactivation does not require active admin retention
  {
    const db: MockDbState = {
      clinics: [clinicInactive],
      staff: [
        { id: "staff-A", user_id: "user-A", staff_code: "ADM-A", full_name: "Admin A", is_active: true },
      ],
      memberships: [{ id: "mem-A-OLD", staff_id: "staff-A", clinic_id: clinicInactive.id, is_active: true }],
      roles: [{ staff_clinic_membership_id: "mem-A-OLD", role_code: "ADMIN" }],
    };

    const res = simulateSetStaffActiveWithAdminGuard(db, "staff-A", false);
    assert.equal(res.success, true, "CASE 9: Inactive clinic does not block deactivation");
    assert.equal(db.staff[0].is_active, false);
  }

  // CASE 10: Activating inactive target staff -> Succeeded
  {
    const db: MockDbState = {
      clinics: [clinicTT01],
      staff: [{ id: "staff-A", user_id: "user-A", staff_code: "ADM-A", full_name: "Admin A", is_active: false }],
      memberships: [{ id: "mem-A-TT01", staff_id: "staff-A", clinic_id: clinicTT01.id, is_active: true }],
      roles: [{ staff_clinic_membership_id: "mem-A-TT01", role_code: "ADMIN" }],
    };

    const res = simulateSetStaffActiveWithAdminGuard(db, "staff-A", true);
    assert.equal(res.success, true, "CASE 10: Activation is always permitted");
    assert.equal(db.staff[0].is_active, true);
  }

  // CASE 11: No-op active -> active -> Succeeded
  {
    const db: MockDbState = {
      clinics: [clinicTT01],
      staff: [{ id: "staff-A", user_id: "user-A", staff_code: "ADM-A", full_name: "Admin A", is_active: true }],
      memberships: [{ id: "mem-A-TT01", staff_id: "staff-A", clinic_id: clinicTT01.id, is_active: true }],
      roles: [{ staff_clinic_membership_id: "mem-A-TT01", role_code: "ADMIN" }],
    };

    const res = simulateSetStaffActiveWithAdminGuard(db, "staff-A", true);
    assert.equal(res.success, true, "CASE 11: No-op returns success");
    assert.equal(db.staff[0].is_active, true);
  }

  // CASE 12: Unknown staff ID -> TARGET_STAFF_NOT_FOUND
  {
    const db: MockDbState = {
      clinics: [clinicTT01],
      staff: [],
      memberships: [],
      roles: [],
    };

    const res = simulateSetStaffActiveWithAdminGuard(db, "unknown-id", false);
    assert.equal(res.success, false, "CASE 12: Unknown staff ID handled safely");
    assert.equal(res.error_code, "TARGET_STAFF_NOT_FOUND");
  }

  // ===============================================
  // MEMBERSHIP DEACTIVATION GOVERNANCE (STAFF-GOV1D1)
  // ===============================================

  // CASE M1: Deactivating sole ADMIN membership at TT01 -> LAST_USABLE_ADMIN, remains active
  {
    const db: MockDbState = {
      clinics: [clinicTT01],
      staff: [{ id: "staff-A", user_id: "user-A", staff_code: "ADM-A", full_name: "Admin A", is_active: true }],
      memberships: [{ id: "mem-A-TT01", staff_id: "staff-A", clinic_id: clinicTT01.id, is_active: true }],
      roles: [{ staff_clinic_membership_id: "mem-A-TT01", role_code: "ADMIN" }],
    };

    const res = simulateDeactivateStaffMembershipWithAdminGuard(db, "mem-A-TT01");
    assert.equal(res.success, false, "CASE M1: Must reject deactivating sole ADMIN membership");
    assert.equal(res.error_code, "LAST_USABLE_ADMIN");
    assert.equal(db.memberships[0].is_active, true, "CASE M1: Membership remains active");
  }

  // CASE M2: TT01 has co-admin B -> Deactivating A's membership succeeds
  {
    const db: MockDbState = {
      clinics: [clinicTT01],
      staff: [
        { id: "staff-A", user_id: "user-A", staff_code: "ADM-A", full_name: "Admin A", is_active: true },
        { id: "staff-B", user_id: "user-B", staff_code: "ADM-B", full_name: "Admin B", is_active: true },
      ],
      memberships: [
        { id: "mem-A-TT01", staff_id: "staff-A", clinic_id: clinicTT01.id, is_active: true },
        { id: "mem-B-TT01", staff_id: "staff-B", clinic_id: clinicTT01.id, is_active: true },
      ],
      roles: [
        { staff_clinic_membership_id: "mem-A-TT01", role_code: "ADMIN" },
        { staff_clinic_membership_id: "mem-B-TT01", role_code: "ADMIN" },
      ],
    };

    const res = simulateDeactivateStaffMembershipWithAdminGuard(db, "mem-A-TT01");
    assert.equal(res.success, true, "CASE M2: Allowed when another usable ADMIN membership exists");
    assert.equal(db.memberships.find((m) => m.id === "mem-A-TT01")?.is_active, false);
    assert.equal(db.memberships.find((m) => m.id === "mem-B-TT01")?.is_active, true);
  }

  // CASE M3: Deactivating a non-ADMIN membership (DOCTOR only) -> Succeeded
  {
    const db: MockDbState = {
      clinics: [clinicTT01],
      staff: [
        { id: "staff-DOC", user_id: "user-DOC", staff_code: "DOC-1", full_name: "Dr One", is_active: true },
      ],
      memberships: [{ id: "mem-DOC-TT01", staff_id: "staff-DOC", clinic_id: clinicTT01.id, is_active: true }],
      roles: [{ staff_clinic_membership_id: "mem-DOC-TT01", role_code: "DOCTOR" }],
    };

    const res = simulateDeactivateStaffMembershipWithAdminGuard(db, "mem-DOC-TT01");
    assert.equal(res.success, true, "CASE M3: Non-admin membership can be deactivated safely");
    assert.equal(db.memberships[0].is_active, false);
  }

  // CASE M4: Inactive clinic -> Deactivating ADMIN membership does not block
  {
    const db: MockDbState = {
      clinics: [clinicInactive],
      staff: [
        { id: "staff-A", user_id: "user-A", staff_code: "ADM-A", full_name: "Admin A", is_active: true },
      ],
      memberships: [{ id: "mem-A-OLD", staff_id: "staff-A", clinic_id: clinicInactive.id, is_active: true }],
      roles: [{ staff_clinic_membership_id: "mem-A-OLD", role_code: "ADMIN" }],
    };

    const res = simulateDeactivateStaffMembershipWithAdminGuard(db, "mem-A-OLD");
    assert.equal(res.success, true, "CASE M4: Inactive clinic membership deactivation allowed");
    assert.equal(db.memberships[0].is_active, false);
  }

  // CASE M5: No-op deactivating an already inactive membership -> Succeeded
  {
    const db: MockDbState = {
      clinics: [clinicTT01],
      staff: [{ id: "staff-A", user_id: "user-A", staff_code: "ADM-A", full_name: "Admin A", is_active: true }],
      memberships: [{ id: "mem-A-TT01", staff_id: "staff-A", clinic_id: clinicTT01.id, is_active: false }],
      roles: [{ staff_clinic_membership_id: "mem-A-TT01", role_code: "ADMIN" }],
    };

    const res = simulateDeactivateStaffMembershipWithAdminGuard(db, "mem-A-TT01");
    assert.equal(res.success, true, "CASE M5: No-op returns success");
    assert.equal(db.memberships[0].is_active, false);
  }

  // CASE M6: Unknown membership ID -> TARGET_MEMBERSHIP_NOT_FOUND
  {
    const db: MockDbState = {
      clinics: [clinicTT01],
      staff: [],
      memberships: [],
      roles: [],
    };

    const res = simulateDeactivateStaffMembershipWithAdminGuard(db, "unknown-mem-id");
    assert.equal(res.success, false, "CASE M6: Unknown membership handled safely");
    assert.equal(res.error_code, "TARGET_MEMBERSHIP_NOT_FOUND");
  }

  // ===============================================
  // ROLE REPLACEMENT GOVERNANCE (STAFF-GOV1E1 & FIX1)
  // ===============================================

  // CASE FIX-R1: Target Staff inactive, membership active, ADMIN role, no other usable ADMIN, requested DOCTOR -> PASS
  {
    const db: MockDbState = {
      clinics: [clinicTT01],
      staff: [{ id: "staff-A", user_id: "user-A", staff_code: "ADM-A", full_name: "Admin A", is_active: false }], // Inactive staff!
      memberships: [{ id: "mem-A-TT01", staff_id: "staff-A", clinic_id: clinicTT01.id, is_active: true }],
      roles: [{ staff_clinic_membership_id: "mem-A-TT01", role_code: "ADMIN" }],
    };

    const res = simulateAssignStaffClinicRolesWithAdminGuard(db, "staff-A", clinicTT01.id, ["DOCTOR"]);
    assert.equal(res.success, true, "CASE FIX-R1: Inactive staff was not a usable admin; role replacement succeeds");
    const aRoles = db.roles.filter((r) => r.staff_clinic_membership_id === "mem-A-TT01");
    assert.equal(aRoles[0].role_code, "DOCTOR");
  }

  // CASE FIX-R2: Target Staff active, membership inactive, ADMIN role, no other usable ADMIN, requested DOCTOR -> PASS
  {
    const db: MockDbState = {
      clinics: [clinicTT01],
      staff: [{ id: "staff-A", user_id: "user-A", staff_code: "ADM-A", full_name: "Admin A", is_active: true }],
      memberships: [{ id: "mem-A-TT01", staff_id: "staff-A", clinic_id: clinicTT01.id, is_active: false }], // Inactive membership!
      roles: [{ staff_clinic_membership_id: "mem-A-TT01", role_code: "ADMIN" }],
    };

    const res = simulateAssignStaffClinicRolesWithAdminGuard(db, "staff-A", clinicTT01.id, ["DOCTOR"]);
    assert.equal(res.success, true, "CASE FIX-R2: Inactive membership was not contributing usable admin; reactivates as DOCTOR");
    assert.equal(db.memberships[0].is_active, true, "Membership reactivated");
    const aRoles = db.roles.filter((r) => r.staff_clinic_membership_id === "mem-A-TT01");
    assert.equal(aRoles[0].role_code, "DOCTOR");
  }

  // CASE FIX-R3: Target lacks usable Auth linkage (user_id = null), ADMIN role, requested DOCTOR -> PASS
  {
    const db: MockDbState = {
      clinics: [clinicTT01],
      staff: [{ id: "staff-A", user_id: null, staff_code: "ADM-A", full_name: "Admin A", is_active: true }], // Unlinked!
      memberships: [{ id: "mem-A-TT01", staff_id: "staff-A", clinic_id: clinicTT01.id, is_active: true }],
      roles: [{ staff_clinic_membership_id: "mem-A-TT01", role_code: "ADMIN" }],
    };

    const res = simulateAssignStaffClinicRolesWithAdminGuard(db, "staff-A", clinicTT01.id, ["DOCTOR"]);
    assert.equal(res.success, true, "CASE FIX-R3: Unlinked staff was not a usable admin; role replacement succeeds");
    const aRoles = db.roles.filter((r) => r.staff_clinic_membership_id === "mem-A-TT01");
    assert.equal(aRoles[0].role_code, "DOCTOR");
  }

  // CASE FIX-R4: Target is a TRUE usable sole ADMIN, requested removes ADMIN -> LAST_USABLE_ADMIN, ZERO mutation
  {
    const db: MockDbState = {
      clinics: [clinicTT01],
      staff: [{ id: "staff-A", user_id: "user-A", staff_code: "ADM-A", full_name: "Admin A", is_active: true }],
      memberships: [{ id: "mem-A-TT01", staff_id: "staff-A", clinic_id: clinicTT01.id, is_active: true }],
      roles: [
        { staff_clinic_membership_id: "mem-A-TT01", role_code: "ADMIN" },
        { staff_clinic_membership_id: "mem-A-TT01", role_code: "DOCTOR" },
      ],
    };

    const res = simulateAssignStaffClinicRolesWithAdminGuard(db, "staff-A", clinicTT01.id, ["DOCTOR"]);
    assert.equal(res.success, false, "CASE FIX-R4: Must reject removing ADMIN from true sole usable ADMIN");
    assert.equal(res.error_code, "LAST_USABLE_ADMIN");
    const aRoles = db.roles.filter((r) => r.staff_clinic_membership_id === "mem-A-TT01");
    assert.equal(aRoles.some((r) => r.role_code === "ADMIN"), true, "ADMIN role preserved");
  }

  // CASE FIX-R5: Target true usable ADMIN, another usable ADMIN remains -> PASS
  {
    const db: MockDbState = {
      clinics: [clinicTT01],
      staff: [
        { id: "staff-A", user_id: "user-A", staff_code: "ADM-A", full_name: "Admin A", is_active: true },
        { id: "staff-B", user_id: "user-B", staff_code: "ADM-B", full_name: "Admin B", is_active: true },
      ],
      memberships: [
        { id: "mem-A-TT01", staff_id: "staff-A", clinic_id: clinicTT01.id, is_active: true },
        { id: "mem-B-TT01", staff_id: "staff-B", clinic_id: clinicTT01.id, is_active: true },
      ],
      roles: [
        { staff_clinic_membership_id: "mem-A-TT01", role_code: "ADMIN" },
        { staff_clinic_membership_id: "mem-B-TT01", role_code: "ADMIN" },
      ],
    };

    const res = simulateAssignStaffClinicRolesWithAdminGuard(db, "staff-A", clinicTT01.id, ["DOCTOR"]);
    assert.equal(res.success, true, "CASE FIX-R5: Allowed when another usable ADMIN remains");
    const aRoles = db.roles.filter((r) => r.staff_clinic_membership_id === "mem-A-TT01");
    assert.equal(aRoles.length, 1);
    assert.equal(aRoles[0].role_code, "DOCTOR");
  }

  // CASE FIX-R6: Requested role set still contains ADMIN -> Succeeded without last-admin block
  {
    const db: MockDbState = {
      clinics: [clinicTT01],
      staff: [{ id: "staff-A", user_id: "user-A", staff_code: "ADM-A", full_name: "Admin A", is_active: true }],
      memberships: [{ id: "mem-A-TT01", staff_id: "staff-A", clinic_id: clinicTT01.id, is_active: true }],
      roles: [{ staff_clinic_membership_id: "mem-A-TT01", role_code: "ADMIN" }],
    };

    const res = simulateAssignStaffClinicRolesWithAdminGuard(db, "staff-A", clinicTT01.id, ["ADMIN", "DOCTOR"]);
    assert.equal(res.success, true, "CASE FIX-R6: Keeping ADMIN does not trigger last-admin block");
    const aRoles = db.roles.filter((r) => r.staff_clinic_membership_id === "mem-A-TT01");
    assert.equal(aRoles.length, 2);
  }

  // CASE FIX-R7: Membership reactivation + role replacement atomic
  {
    const db: MockDbState = {
      clinics: [clinicTT01],
      staff: [{ id: "staff-A", user_id: "user-A", staff_code: "ADM-A", full_name: "Admin A", is_active: true }],
      memberships: [{ id: "mem-A-TT01", staff_id: "staff-A", clinic_id: clinicTT01.id, is_active: false }],
      roles: [{ staff_clinic_membership_id: "mem-A-TT01", role_code: "DOCTOR" }],
    };

    const res = simulateAssignStaffClinicRolesWithAdminGuard(db, "staff-A", clinicTT01.id, ["RECEPTIONIST"]);
    assert.equal(res.success, true, "CASE FIX-R7: Reactivation and replacement successful");
    assert.equal(db.memberships[0].is_active, true);
    assert.equal(db.roles[0].role_code, "RECEPTIONIST");
  }

  // CASE FIX-R8: Invalid role string rejects with ZERO writes
  {
    const db: MockDbState = {
      clinics: [clinicTT01],
      staff: [{ id: "staff-A", user_id: "user-A", staff_code: "ADM-A", full_name: "Admin A", is_active: true }],
      memberships: [{ id: "mem-A-TT01", staff_id: "staff-A", clinic_id: clinicTT01.id, is_active: true }],
      roles: [{ staff_clinic_membership_id: "mem-A-TT01", role_code: "ADMIN" }],
    };

    const res = simulateAssignStaffClinicRolesWithAdminGuard(db, "staff-A", clinicTT01.id, ["INVALID_ROLE"]);
    assert.equal(res.success, false, "CASE FIX-R8: Invalid role rejected");
    assert.equal(res.error_code, "INVALID_ROLES");
    assert.equal(db.roles[0].role_code, "ADMIN", "Zero writes occurred on rejection");
  }

  console.log("All Staff Governance & Last-Usable-ADMIN Invariant Tests PASSED!");
}
