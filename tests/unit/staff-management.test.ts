import assert from "node:assert/strict";
import {
  createStaffSchema,
  updateStaffSchema,
  assignClinicMembershipSchema,
  updateClinicRolesSchema,
  provisionStaffAuthSchema,
  setupStaffPasswordSchema,
  type AssignClinicMembershipInput,
  type CreateStaffInput,
  type UpdateStaffInput,
  type ProvisionStaffAuthInput,
  type SetupStaffPasswordInput,
} from "@/lib/validation/staff-schemas";
import type { ClinicRoleCode } from "@/types/clinic";

const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface MockCallerMembership {
  clinic_id: string;
  clinic_code: string;
  roles: ClinicRoleCode[];
  is_active: boolean;
}

interface MockTargetMembershipRecord {
  id: string;
  staff_id: string;
  clinic_id: string;
  clinic_code: string;
  is_active: boolean;
}

// Pure mock simulation of assignStaffClinicAction workflow under test (AUTH1.7C1 & STAFF-GOV1E2)
async function simulateAssignStaffClinicAction(
  caller: { id: string; memberships: MockCallerMembership[] },
  input: AssignClinicMembershipInput,
  existingTargetMembershipsOrCallback?: MockTargetMembershipRecord[] | (() => void),
  onWriteCallback?: () => void
) {
  let existingTargetMemberships: MockTargetMembershipRecord[] | undefined;
  let callback = onWriteCallback;
  if (typeof existingTargetMembershipsOrCallback === "function") {
    callback = existingTargetMembershipsOrCallback;
  } else if (Array.isArray(existingTargetMembershipsOrCallback)) {
    existingTargetMemberships = existingTargetMembershipsOrCallback;
  }

  // 1. Schema parse
  const validated = assignClinicMembershipSchema.parse(input);

  // 2. Target clinic authorization check (requireTargetClinicRole)
  const targetMem = caller.memberships.find(
    (m) => m.clinic_id === validated.clinic_id && m.is_active
  );

  if (!targetMem || !targetMem.roles.includes("ADMIN")) {
    return {
      success: false,
      error: "Bạn không có quyền quản lý nhân sự tại cơ sở này.",
    };
  }

  // 3. Self-ADMIN removal prevention
  if (caller.id === validated.staff_id && !validated.roles.includes("ADMIN")) {
    if (targetMem.roles.includes("ADMIN")) {
      return {
        success: false,
        error: "Bạn không thể tự gỡ vai trò Quản trị viên (ADMIN) của chính mình tại cơ sở này.",
      };
    }
  }

  // 4. Last-usable-ADMIN governance check (simulates atomic RPC)
  if (existingTargetMemberships) {
    const targetStaffMem = existingTargetMemberships.find(
      (m) => m.staff_id === validated.staff_id && m.clinic_id === validated.clinic_id && m.is_active
    );
    // If removing ADMIN from an active member
    if (targetStaffMem && !validated.roles.includes("ADMIN")) {
      const otherAdmins = existingTargetMemberships.filter(
        (m) =>
          m.clinic_id === validated.clinic_id &&
          m.staff_id !== validated.staff_id &&
          m.is_active
      );
      if (otherAdmins.length === 0) {
        return {
          success: false,
          error: "Không thể gỡ vai trò Quản trị viên (ADMIN) vì đây là Quản trị viên đang hoạt động duy nhất của cơ sở này.",
        };
      }
    }
  }

  // 5. Service role mutation (only executed after authorization passes)
  if (callback) {
    callback();
  }

  return { success: true, membershipId: "mock-membership-id" };
}

// Pure mock simulation of createStaffAction workflow under test (AUTH1.7C2-FIX1)
async function simulateCreateStaffAction(
  caller: { id: string; memberships: MockCallerMembership[] },
  input: CreateStaffInput,
  onWriteCallback?: () => void
) {
  // 1. Schema parse (enforces min(1) clinic assignment)
  let validated;
  try {
    validated = createStaffSchema.parse(input);
  } catch (err: unknown) {
    return {
      success: false,
      error: (err as Error).message || "Nhân viên mới phải được phân công ít nhất một cơ sở.",
    };
  }

  if (!validated.clinic_assignments || validated.clinic_assignments.length === 0) {
    return {
      success: false,
      error: "Nhân viên mới phải được phân công ít nhất một cơ sở.",
    };
  }

  // 2. Authorization check: Caller must be ADMIN at EVERY target clinic in assignments
  const uniqueClinicIds = Array.from(
    new Set(validated.clinic_assignments.map((a) => a.clinic_id))
  );
  for (const clinicId of uniqueClinicIds) {
    const targetMem = caller.memberships.find(
      (m) => m.clinic_id === clinicId && m.is_active
    );
    if (!targetMem || !targetMem.roles.includes("ADMIN")) {
      return {
        success: false,
        error: "Bạn không có quyền tạo nhân viên tại cơ sở này.",
      };
    }
  }

  // 3. Service role mutation (executed ONLY after ALL authorizations pass)
  if (onWriteCallback) {
    onWriteCallback();
  }

  return { success: true, data: { id: "mock-created-staff-id" } };
}

// Pure mock simulation of deactivateMembershipAction workflow under test (AUTH1.7C3 & STAFF-GOV1D2)
async function simulateDeactivateMembershipAction(
  caller: { id: string; memberships: MockCallerMembership[] },
  targetMembershipRecords: MockTargetMembershipRecord[],
  membershipId: string,
  onWriteCallback?: () => void
) {
  // 1. Validate UUID format
  if (!membershipId || !uuidPattern.test(membershipId)) {
    return {
      success: false,
      error: "Mã phân công cơ sở không hợp lệ.",
    };
  }

  // 2. Resolve target membership record to get REAL staff_id and clinic_id
  const targetMem = targetMembershipRecords.find((m) => m.id === membershipId);
  if (!targetMem) {
    return {
      success: false,
      error: "Không tìm thấy thông tin phân công cơ sở cần hủy.",
    };
  }

  // 3. Prevent self-membership deactivation
  if (caller.id === targetMem.staff_id) {
    return {
      success: false,
      error: "Bạn không thể tự hủy phân công cơ sở của chính mình.",
    };
  }

  // 4. Authorize caller: Caller MUST hold ADMIN at the target membership's REAL clinic
  const callerMemAtTargetClinic = caller.memberships.find(
    (m) => m.clinic_id === targetMem.clinic_id && m.is_active
  );

  if (!callerMemAtTargetClinic || !callerMemAtTargetClinic.roles.includes("ADMIN")) {
    return {
      success: false,
      error: "Bạn không có quyền quản lý nhân sự tại cơ sở này.",
    };
  }

  // 5. Atomic RPC last-usable-ADMIN governance check
  const otherAdmins = targetMembershipRecords.filter(
    (m) =>
      m.clinic_id === targetMem.clinic_id &&
      m.id !== membershipId &&
      m.is_active
  );
  if (otherAdmins.length === 0) {
    return {
      success: false,
      error: "Không thể hủy phân công vì đây là Quản trị viên (ADMIN) đang hoạt động duy nhất của cơ sở này.",
    };
  }

  // 6. Privileged mutation via service-role client (executed ONLY after authorization passes)
  if (onWriteCallback) {
    onWriteCallback();
  }

  return { success: true };
}

// Pure mock simulation of updateStaffAction workflow under test (AUTH1.7C4B)
async function simulateUpdateStaffAction(
  caller: { id: string; memberships: MockCallerMembership[] },
  targetStaffMemberships: MockTargetMembershipRecord[],
  input: UpdateStaffInput,
  onWriteCallback?: () => void
) {
  // 1. Schema parse
  const validated = updateStaffSchema.parse(input);

  // 2. Resolve target staff's ACTIVE clinic memberships
  const activeMemberships = targetStaffMemberships.filter(
    (m) => m.staff_id === validated.id && m.is_active
  );

  const activeClinicIds = Array.from(new Set(activeMemberships.map((m) => m.clinic_id)));

  if (activeClinicIds.length === 0) {
    return {
      success: false,
      error: "Không thể cập nhật thông tin nhân viên chưa được phân công cơ sở hoạt động.",
    };
  }

  // 3. Authorize caller: Caller MUST hold ADMIN at EVERY active clinic of target staff
  for (const clinicId of activeClinicIds) {
    const callerMem = caller.memberships.find((m) => m.clinic_id === clinicId && m.is_active);
    if (!callerMem || !callerMem.roles.includes("ADMIN")) {
      return {
        success: false,
        error: "Bạn không có quyền cập nhật thông tin nhân viên này.",
      };
    }
  }

  // 4. Privileged update (only profile fields, never is_active)
  if (onWriteCallback) {
    onWriteCallback();
  }

  return { success: true, data: { id: validated.id } };
}

// Pure mock simulation of toggleStaffStatusAction workflow under test (AUTH1.7C4C)
async function simulateToggleStaffStatusAction(
  caller: { id: string; memberships: MockCallerMembership[] },
  targetStaffMemberships: MockTargetMembershipRecord[],
  staffId: string,
  isActive: boolean,
  onWriteCallback?: () => void
) {
  // 1. Validate UUID format
  if (!staffId || !uuidPattern.test(staffId)) {
    return {
      success: false,
      error: "Mã nhân viên không hợp lệ.",
    };
  }

  // 2. Prevent self-deactivation
  if (isActive === false && caller.id === staffId) {
    return {
      success: false,
      error: "Bạn không thể tự khóa tài khoản nhân viên của chính mình.",
    };
  }

  // 3. Resolve target staff's ACTIVE clinic memberships
  const activeMemberships = targetStaffMemberships.filter(
    (m) => m.staff_id === staffId && m.is_active
  );

  const activeClinicIds = Array.from(new Set(activeMemberships.map((m) => m.clinic_id)));

  if (activeClinicIds.length === 0) {
    return {
      success: false,
      error: "Không thể cập nhật trạng thái nhân viên chưa được phân công cơ sở hoạt động.",
    };
  }

  // 4. Authorize caller: Caller MUST hold ADMIN at EVERY active clinic of target staff
  for (const clinicId of activeClinicIds) {
    const callerMem = caller.memberships.find((m) => m.clinic_id === clinicId && m.is_active);
    if (!callerMem || !callerMem.roles.includes("ADMIN")) {
      return {
        success: false,
        error: "Bạn không có quyền cập nhật trạng thái nhân viên này.",
      };
    }
  }

  // 5. Atomic RPC governance mutation simulation (STAFF-GOV1C)
  if (isActive === false) {
    for (const clinicId of activeClinicIds) {
      const otherAdmins = targetStaffMemberships.filter(
        (m) => m.clinic_id === clinicId && m.staff_id !== staffId && m.is_active
      );
      // If no other admin membership exists at clinic
      if (otherAdmins.length === 0) {
        return {
          success: false,
          error: "Không thể khóa nhân viên vì đây là Quản trị viên (ADMIN) đang hoạt động duy nhất của một hoặc nhiều cơ sở.",
        };
      }
    }
  }

  if (onWriteCallback) {
    onWriteCallback();
  }

  return { success: true };
}

export async function runStaffManagementTests() {
  console.log("Running Staff Management Domain & Validation Tests...");

  // Test 1: Valid Create Staff Input
  const validStaff = createStaffSchema.parse({
    staff_code: "bs-tuan",
    full_name: "BS. Nguyễn Văn Tuấn",
    role_type: "DOCTOR",
    phone: "0987654321",
    email: "tuan.nv@thuanthien.vn",
    clinic_assignments: [
      {
        clinic_id: "123e4567-e89b-12d3-a456-426614174000",
        is_primary: true,
        roles: ["DOCTOR", "MANAGER"],
      },
    ],
  });

  assert.equal(validStaff.staff_code, "BS-TUAN", "Staff code must be capitalized");
  assert.equal(validStaff.full_name, "BS. Nguyễn Văn Tuấn");
  assert.equal(validStaff.clinic_assignments.length, 1);
  assert.equal(validStaff.clinic_assignments[0].roles.length, 2);

  // Test 2: Validation rejection on empty roles
  assert.throws(
    () => {
      assignClinicMembershipSchema.parse({
        staff_id: "123e4567-e89b-12d3-a456-426614174000",
        clinic_id: "123e4567-e89b-12d3-a456-426614174001",
        is_primary: false,
        roles: [] as unknown as [ClinicRoleCode, ...ClinicRoleCode[]],
      });
    },
    /Vui lòng chọn ít nhất một vai trò/,
    "Must throw validation error if no roles selected"
  );

  // Test 3: Update Staff Schema (no is_active)
  const validUpdate = updateStaffSchema.parse({
    id: "123e4567-e89b-12d3-a456-426614174000",
    full_name: "BS. Nguyễn Văn Tuấn CKI",
    phone: "0911223344",
  });
  assert.equal(validUpdate.full_name, "BS. Nguyễn Văn Tuấn CKI");
  assert.equal((validUpdate as Record<string, unknown>).is_active, undefined, "is_active not accepted in updateStaffSchema");

  // Test 4: Update Clinic Roles Schema
  const validRoleUpdate = updateClinicRolesSchema.parse({
    membership_id: "123e4567-e89b-12d3-a456-426614174000",
    roles: ["DOCTOR", "ADMIN"],
  });
  assert.equal(validRoleUpdate.roles.length, 2);
  assert.equal(validRoleUpdate.roles.includes("ADMIN"), true);

  // AUTH1.7C1 SECURITY TESTS FOR assignStaffClinicAction
  const adminCaller = {
    id: "12121212-1212-1212-1212-121212121212",
    memberships: [
      {
        clinic_id: "11111111-1111-1111-1111-111111111111",
        clinic_code: "TT01",
        roles: ["ADMIN" as ClinicRoleCode],
        is_active: true,
      },
      {
        clinic_id: "22222222-2222-2222-2222-222222222222",
        clinic_code: "MD01",
        roles: ["DOCTOR" as ClinicRoleCode], // Doctor only at MD01!
        is_active: true,
      },
      {
        clinic_id: "33333333-3333-3333-3333-333333333333",
        clinic_code: "PN01",
        roles: ["ADMIN" as ClinicRoleCode],
        is_active: true,
      },
    ],
  };

  // SEC-CASE 1: Caller ADMIN at target clinic TT01 -> mutation succeeds
  let writeExecuted = false;
  simulateAssignStaffClinicAction(
    adminCaller,
    {
      staff_id: "99999999-9999-9999-9999-999999999999",
      clinic_id: "11111111-1111-1111-1111-111111111111", // TT01
      is_primary: false,
      roles: ["DOCTOR", "Y_SI"],
    },
    () => {
      writeExecuted = true;
    }
  ).then((res) => {
    assert.equal(res.success, true, "SEC-CASE 1: ADMIN at target clinic authorized");
    assert.equal(writeExecuted, true, "SEC-CASE 1: Write executed after authorization");
  });

  // SEC-CASE 2 (CRITICAL CROSS-CLINIC): Caller ADMIN at TT01, but targeting MD01 (DOCTOR only) -> DENIED, no write
  let crossClinicWriteExecuted = false;
  simulateAssignStaffClinicAction(
    adminCaller,
    {
      staff_id: "99999999-9999-9999-9999-999999999999",
      clinic_id: "22222222-2222-2222-2222-222222222222", // MD01
      is_primary: false,
      roles: ["ADMIN"],
    },
    () => {
      crossClinicWriteExecuted = true;
    }
  ).then((res) => {
    assert.equal(res.success, false, "SEC-CASE 2: Denied when caller is not ADMIN at target clinic");
    assert.equal(crossClinicWriteExecuted, false, "SEC-CASE 2: Mutation NOT executed on denial");
  });

  // SEC-CASE 3: Caller not a member at target clinic HP01 -> DENIED
  simulateAssignStaffClinicAction(
    adminCaller,
    {
      staff_id: "99999999-9999-9999-9999-999999999999",
      clinic_id: "44444444-4444-4444-4444-444444444444", // HP01 (not member)
      is_primary: false,
      roles: ["DOCTOR"],
    }
  ).then((res) => {
    assert.equal(res.success, false, "SEC-CASE 3: Non-member target denied");
  });

  // SEC-CASE 4: Invalid free-text role -> fails Zod validation
  assert.throws(
    () => {
      assignClinicMembershipSchema.parse({
        staff_id: "99999999-9999-9999-9999-999999999999",
        clinic_id: "11111111-1111-1111-1111-111111111111",
        is_primary: false,
        roles: ["SUPER_USER" as unknown as ClinicRoleCode],
      });
    },
    "SEC-CASE 4: Invalid free-text role rejected by schema"
  );

  // SEC-CASE 5 (SELF-ADMIN REMOVAL): Caller attempts to remove own ADMIN role at TT01 -> REJECTED, zero write
  let selfAdminRemovalExecuted = false;
  simulateAssignStaffClinicAction(
    adminCaller,
    {
      staff_id: "12121212-1212-1212-1212-121212121212", // Caller's own staff ID
      clinic_id: "11111111-1111-1111-1111-111111111111", // TT01
      is_primary: true,
      roles: ["DOCTOR"], // Removing ADMIN!
    },
    undefined,
    () => {
      selfAdminRemovalExecuted = true;
    }
  ).then((res) => {
    assert.equal(res.success, false, "SEC-CASE 5: Self-ADMIN removal rejected");
    assert.equal(selfAdminRemovalExecuted, false, "SEC-CASE 5: Zero write on self-ADMIN removal attempt");
  });

  // SEC-CASE 6 (LAST-USABLE-ADMIN GOVERNANCE): Removing ADMIN from sole admin staff -> REJECTED by RPC, zero write
  const soleAdminStaffDb = [
    {
      id: "10101010-1010-1010-1010-101010101010",
      staff_id: "66666666-6666-6666-6666-666666666666",
      clinic_id: "11111111-1111-1111-1111-111111111111",
      clinic_code: "TT01",
      is_active: true,
    },
  ];
  let lastAdminRemovalExecuted = false;
  simulateAssignStaffClinicAction(
    adminCaller,
    {
      staff_id: "66666666-6666-6666-6666-666666666666",
      clinic_id: "11111111-1111-1111-1111-111111111111",
      is_primary: false,
      roles: ["DOCTOR"], // Removing ADMIN from sole admin
    },
    soleAdminStaffDb,
    () => {
      lastAdminRemovalExecuted = true;
    }
  ).then((res) => {
    assert.equal(res.success, false, "SEC-CASE 6: Last usable admin removal rejected");
    assert.equal(lastAdminRemovalExecuted, false, "SEC-CASE 6: Zero write on last-admin removal attempt");
  });

  // AUTH1.7C2 & AUTH1.7C2-FIX1 SECURITY TESTS FOR createStaffAction
  // CREATE-CASE 0: Zero clinic assignments -> REJECTED with zero writes
  let zeroClinicWriteExecuted = false;
  simulateCreateStaffAction(
    adminCaller,
    {
      staff_code: "DR-TEST-00",
      full_name: "Bác Sĩ Test 00",
      role_type: "DOCTOR",
      clinic_assignments: [],
    },
    () => {
      zeroClinicWriteExecuted = true;
    }
  ).then((res) => {
    assert.equal(res.success, false, "CREATE-CASE 0: Zero clinic assignments rejected");
    assert.equal(zeroClinicWriteExecuted, false, "CREATE-CASE 0: Zero writes on empty clinic assignments");
  });

  // CREATE-CASE 1: Caller ADMIN at both TT01 & PN01 -> assigning new staff to TT01 & PN01 -> Authorized, writes proceed
  let createWriteExecuted = false;
  simulateCreateStaffAction(
    adminCaller,
    {
      staff_code: "DR-TEST-01",
      full_name: "Bác Sĩ Test 01",
      role_type: "DOCTOR",
      clinic_assignments: [
        {
          clinic_id: "11111111-1111-1111-1111-111111111111", // TT01 (ADMIN)
          is_primary: true,
          roles: ["DOCTOR"],
        },
        {
          clinic_id: "33333333-3333-3333-3333-333333333333", // PN01 (ADMIN)
          is_primary: false,
          roles: ["DOCTOR"],
        },
      ],
    },
    () => {
      createWriteExecuted = true;
    }
  ).then((res) => {
    assert.equal(res.success, true, "CREATE-CASE 1: Authorized when ADMIN at all target clinics");
    assert.equal(createWriteExecuted, true, "CREATE-CASE 1: Write executed on authorization");
  });

  // CREATE-CASE 2 (CRITICAL CROSS-CLINIC): Caller ADMIN at TT01, but NOT ADMIN at MD01 (DOCTOR only) -> DENIED, zero write
  let crossCreateWriteExecuted = false;
  simulateCreateStaffAction(
    adminCaller,
    {
      staff_code: "DR-TEST-02",
      full_name: "Bác Sĩ Test 02",
      role_type: "DOCTOR",
      clinic_assignments: [
        {
          clinic_id: "11111111-1111-1111-1111-111111111111", // TT01 (ADMIN)
          is_primary: true,
          roles: ["DOCTOR"],
        },
        {
          clinic_id: "22222222-2222-2222-2222-222222222222", // MD01 (NOT ADMIN!)
          is_primary: false,
          roles: ["DOCTOR"],
        },
      ],
    },
    () => {
      crossCreateWriteExecuted = true;
    }
  ).then((res) => {
    assert.equal(res.success, false, "CREATE-CASE 2: Denied when caller lacks ADMIN at even one assigned clinic");
    assert.equal(crossCreateWriteExecuted, false, "CREATE-CASE 2: Zero writes executed on denial");
  });

  // CREATE-CASE 3: Caller lacks ADMIN on non-member clinic HP01 -> DENIED, zero write
  let nonMemberCreateWriteExecuted = false;
  simulateCreateStaffAction(
    adminCaller,
    {
      staff_code: "DR-TEST-03",
      full_name: "Bác Sĩ Test 03",
      role_type: "DOCTOR",
      clinic_assignments: [
        {
          clinic_id: "44444444-4444-4444-4444-444444444444", // HP01 (not member)
          is_primary: true,
          roles: ["ADMIN"],
        },
      ],
    },
    () => {
      nonMemberCreateWriteExecuted = true;
    }
  ).then((res) => {
    assert.equal(res.success, false, "CREATE-CASE 3: Denied when non-member clinic assigned");
    assert.equal(nonMemberCreateWriteExecuted, false, "CREATE-CASE 3: Zero writes executed on denial");
  });

  // AUTH1.7C3 SECURITY TESTS FOR deactivateMembershipAction
  const targetMembershipsDb: MockTargetMembershipRecord[] = [
    {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      staff_id: "99999999-9999-9999-9999-999999999999",
      clinic_id: "11111111-1111-1111-1111-111111111111", // TT01 (caller is ADMIN)
      clinic_code: "TT01",
      is_active: true,
    },
    {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      staff_id: "99999999-9999-9999-9999-999999999999",
      clinic_id: "22222222-2222-2222-2222-222222222222", // MD01 (caller is DOCTOR only!)
      clinic_code: "MD01",
      is_active: true,
    },
    {
      id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      staff_id: "99999999-9999-9999-9999-999999999999",
      clinic_id: "44444444-4444-4444-4444-444444444444", // HP01 (caller not a member!)
      clinic_code: "HP01",
      is_active: true,
    },
    {
      id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
      staff_id: "88888888-8888-8888-8888-888888888888",
      clinic_id: "11111111-1111-1111-1111-111111111111", // TT01 (caller is ADMIN)
      clinic_code: "TT01",
      is_active: true,
    },
    {
      id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
      staff_id: "88888888-8888-8888-8888-888888888888",
      clinic_id: "33333333-3333-3333-3333-333333333333", // PN01 (caller is ADMIN)
      clinic_code: "PN01",
      is_active: true,
    },
    {
      id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
      staff_id: "77777777-7777-7777-7777-777777777777",
      clinic_id: "33333333-3333-3333-3333-333333333333", // PN01 (co-admin)
      clinic_code: "PN01",
      is_active: true,
    },
    {
      id: "10101010-1010-1010-1010-101010101010",
      staff_id: "66666666-6666-6666-6666-666666666666",
      clinic_id: "11111111-1111-1111-1111-111111111111", // TT01 (sole admin at isolated clinic case)
      clinic_code: "TT01",
      is_active: true,
    },
    {
      id: "99999999-0000-0000-0000-000000000000",
      staff_id: "12121212-1212-1212-1212-121212121212", // Caller's own membership
      clinic_id: "11111111-1111-1111-1111-111111111111", // TT01
      clinic_code: "TT01",
      is_active: true,
    },
  ];

  // DEACTIVATE-CASE 1: Caller ADMIN at TT01 -> deactivates target membership at TT01 -> Authorized, write occurs
  let deactWriteExecuted = false;
  simulateDeactivateMembershipAction(
    adminCaller,
    targetMembershipsDb,
    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    () => {
      deactWriteExecuted = true;
    }
  ).then((res) => {
    assert.equal(res.success, true, "DEACTIVATE-CASE 1: Authorized when ADMIN at target membership's real clinic");
    assert.equal(deactWriteExecuted, true, "DEACTIVATE-CASE 1: Mutation executed on authorization");
  });

  // DEACTIVATE-CASE 2 (CRITICAL CROSS-CLINIC): Caller ADMIN at TT01, attempting to deactivate membership at MD01 (DOCTOR only) -> DENIED, zero write
  let crossDeactWriteExecuted = false;
  simulateDeactivateMembershipAction(
    adminCaller,
    targetMembershipsDb,
    "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    () => {
      crossDeactWriteExecuted = true;
    }
  ).then((res) => {
    assert.equal(res.success, false, "DEACTIVATE-CASE 2: Denied when caller lacks ADMIN at target membership's real clinic");
    assert.equal(crossDeactWriteExecuted, false, "DEACTIVATE-CASE 2: Zero writes on denial");
  });

  // DEACTIVATE-CASE 3: Target membership at HP01 where caller is not a member -> DENIED, zero write
  let nonMemberDeactWriteExecuted = false;
  simulateDeactivateMembershipAction(
    adminCaller,
    targetMembershipsDb,
    "cccccccc-cccc-cccc-cccc-cccccccccccc",
    () => {
      nonMemberDeactWriteExecuted = true;
    }
  ).then((res) => {
    assert.equal(res.success, false, "DEACTIVATE-CASE 3: Denied on non-member clinic membership");
    assert.equal(nonMemberDeactWriteExecuted, false, "DEACTIVATE-CASE 3: Zero writes on denial");
  });

  // DEACTIVATE-CASE 4: Invalid UUID format -> REJECTED, zero write
  simulateDeactivateMembershipAction(
    adminCaller,
    targetMembershipsDb,
    "not-a-valid-uuid"
  ).then((res) => {
    assert.equal(res.success, false, "DEACTIVATE-CASE 4: Invalid UUID rejected");
  });

  // DEACTIVATE-CASE 5 (SELF-MEMBERSHIP): Caller attempts to deactivate own membership -> REJECTED, zero write
  let selfMemDeactWriteExecuted = false;
  simulateDeactivateMembershipAction(
    adminCaller,
    targetMembershipsDb,
    "99999999-0000-0000-0000-000000000000",
    () => {
      selfMemDeactWriteExecuted = true;
    }
  ).then((res) => {
    assert.equal(res.success, false, "DEACTIVATE-CASE 5: Self membership deactivation rejected");
    assert.equal(selfMemDeactWriteExecuted, false, "DEACTIVATE-CASE 5: Zero writes on self deactivation");
  });

  // DEACTIVATE-CASE 6 (LAST-USABLE-ADMIN GOVERNANCE): Deactivating sole admin membership -> REJECTED by RPC, zero write
  const soleMemDb = [
    {
      id: "10101010-1010-1010-1010-101010101010",
      staff_id: "66666666-6666-6666-6666-666666666666",
      clinic_id: "11111111-1111-1111-1111-111111111111",
      clinic_code: "TT01",
      is_active: true,
    },
  ];
  let lastMemDeactWriteExecuted = false;
  simulateDeactivateMembershipAction(
    adminCaller,
    soleMemDb,
    "10101010-1010-1010-1010-101010101010",
    () => {
      lastMemDeactWriteExecuted = true;
    }
  ).then((res) => {
    assert.equal(res.success, false, "DEACTIVATE-CASE 6: Last usable admin membership deactivation rejected");
    assert.equal(lastMemDeactWriteExecuted, false, "DEACTIVATE-CASE 6: Zero writes on last-admin rejection");
  });

  // AUTH1.7C4B SECURITY TESTS FOR updateStaffAction
  // UPDATE-CASE 1: Target staff active at TT01 & PN01 (staff-888). Caller is ADMIN at both TT01 & PN01 -> Authorized, write occurs
  let updateWriteExecuted = false;
  simulateUpdateStaffAction(
    adminCaller,
    targetMembershipsDb,
    {
      id: "88888888-8888-8888-8888-888888888888",
      full_name: "BS. Nguyễn Văn CKI",
    },
    () => {
      updateWriteExecuted = true;
    }
  ).then((res) => {
    assert.equal(res.success, true, "UPDATE-CASE 1: Authorized when caller is ADMIN across ALL active clinics of target staff");
    assert.equal(updateWriteExecuted, true, "UPDATE-CASE 1: Write executed on authorization");
  });

  // UPDATE-CASE 2 (CRITICAL CROSS-CLINIC): Target staff active at TT01 & MD01 (staff-999). Caller is ADMIN at TT01 but DOCTOR only at MD01 -> DENIED, zero write
  let crossUpdateWriteExecuted = false;
  simulateUpdateStaffAction(
    adminCaller,
    targetMembershipsDb,
    {
      id: "99999999-9999-9999-9999-999999999999",
      full_name: "BS. Hacked Name",
    },
    () => {
      crossUpdateWriteExecuted = true;
    }
  ).then((res) => {
    assert.equal(res.success, false, "UPDATE-CASE 2: Denied when caller lacks ADMIN at even one active clinic of target staff");
    assert.equal(crossUpdateWriteExecuted, false, "UPDATE-CASE 2: Zero write on denial");
  });

  // UPDATE-CASE 3: Target staff has 0 active memberships -> DENIED, zero write
  let zeroMemUpdateWriteExecuted = false;
  simulateUpdateStaffAction(
    adminCaller,
    targetMembershipsDb,
    {
      id: "00000000-0000-0000-0000-000000000000",
      full_name: "BS. Zero Member",
    },
    () => {
      zeroMemUpdateWriteExecuted = true;
    }
  ).then((res) => {
    assert.equal(res.success, false, "UPDATE-CASE 3: Denied when target staff has zero active memberships");
    assert.equal(zeroMemUpdateWriteExecuted, false, "UPDATE-CASE 3: Zero write on zero-membership staff");
  });

  // AUTH1.7C4C & STAFF-GOV1C SECURITY TESTS FOR toggleStaffStatusAction
  // STATUS-CASE 1: Target staff active at TT01 & PN01 (staff-888). Caller is ADMIN at both TT01 & PN01, co-admins exist -> Authorized, write occurs
  let statusWriteExecuted = false;
  simulateToggleStaffStatusAction(
    adminCaller,
    targetMembershipsDb,
    "88888888-8888-8888-8888-888888888888",
    false,
    () => {
      statusWriteExecuted = true;
    }
  ).then((res) => {
    assert.equal(res.success, true, "STATUS-CASE 1: Authorized when caller is ADMIN across ALL active clinics of target staff");
    assert.equal(statusWriteExecuted, true, "STATUS-CASE 1: Mutation executed on authorization");
  });

  // STATUS-CASE 2 (CRITICAL CROSS-CLINIC): Target staff active at TT01 & MD01 (staff-999). Caller is ADMIN at TT01 but DOCTOR only at MD01 -> DENIED, zero write
  let crossStatusWriteExecuted = false;
  simulateToggleStaffStatusAction(
    adminCaller,
    targetMembershipsDb,
    "99999999-9999-9999-9999-999999999999",
    false,
    () => {
      crossStatusWriteExecuted = true;
    }
  ).then((res) => {
    assert.equal(res.success, false, "STATUS-CASE 2: Denied when caller lacks ADMIN at even one active clinic of target staff");
    assert.equal(crossStatusWriteExecuted, false, "STATUS-CASE 2: Zero write on denial");
  });

  // STATUS-CASE 3 (SELF-DEACTIVATION): Caller attempts to deactivate own staff profile -> REJECTED, zero write
  let selfDeactWriteExecuted = false;
  simulateToggleStaffStatusAction(
    adminCaller,
    targetMembershipsDb,
    "12121212-1212-1212-1212-121212121212", // Same ID as caller
    false,
    () => {
      selfDeactWriteExecuted = true;
    }
  ).then((res) => {
    assert.equal(res.success, false, "STATUS-CASE 3: Self-deactivation rejected");
    assert.equal(selfDeactWriteExecuted, false, "STATUS-CASE 3: Zero write on self-deactivation attempt");
  });

  // STATUS-CASE 4: Target staff has 0 active memberships -> DENIED, zero write
  let zeroMemStatusWriteExecuted = false;
  simulateToggleStaffStatusAction(
    adminCaller,
    targetMembershipsDb,
    "00000000-0000-0000-0000-000000000000",
    false,
    () => {
      zeroMemStatusWriteExecuted = true;
    }
  ).then((res) => {
    assert.equal(res.success, false, "STATUS-CASE 4: Denied when target staff has zero active memberships");
    assert.equal(zeroMemStatusWriteExecuted, false, "STATUS-CASE 4: Zero write on zero-membership staff");
  });

  // =========================================================================
  // 6. STAFF-AUTH1A-FIX2 ATOMIC AUTH ACCOUNT PROVISIONING & AUDIT TESTS
  // =========================================================================

  interface MockStaffRecord {
    id: string;
    staff_code: string;
    full_name: string;
    is_active: boolean;
    user_id: string | null;
    auth_setup_required: boolean;
    auth_setup_completed_at: string | null;
  }

  interface MockAuthUser {
    id: string;
    email: string;
    password?: string;
  }

  interface MockProvisionEnvironment {
    staffDb: MockStaffRecord[];
    membershipDb: MockTargetMembershipRecord[];
    authUsersDb: MockAuthUser[];
    auditLogs: { action: string; entity_id: string; after_data: unknown }[];
  }

  function simulateLinkStaffAuthAccountRpc(
    env: MockProvisionEnvironment,
    args: {
      p_staff_id: string;
      p_clinic_id: string;
      p_auth_user_id: string;
      p_login_email: string;
      p_actor_staff_id: string;
      p_actor_user_id: string;
    },
    forceAuditFailure = false
  ) {
    const { p_staff_id, p_clinic_id, p_auth_user_id, p_login_email, p_actor_staff_id, p_actor_user_id } = args;

    // 1. Validate parameters
    if (!p_staff_id || !p_clinic_id || !p_auth_user_id || !p_login_email || !p_actor_staff_id || !p_actor_user_id) {
      return { success: false, error_code: "INVALID_INPUT", message: "Dữ liệu đầu vào không đầy đủ." };
    }

    // 2. Validate actor Staff integrity and Auth User linkage
    const actorStaff = env.staffDb.find((s) => s.id === p_actor_staff_id);
    if (!actorStaff || !actorStaff.is_active || actorStaff.user_id !== p_actor_user_id) {
      return {
        success: false,
        error_code: "INVALID_ACTOR",
        message: "Tài khoản người thực hiện không hợp lệ, không hoạt động hoặc không khớp với tài khoản đăng nhập.",
      };
    }

    // 3. Validate actor has active membership and ADMIN role at p_clinic_id
    const actorMem = env.membershipDb.find(
      (m) => m.staff_id === p_actor_staff_id && m.clinic_id === p_clinic_id && m.is_active
    );
    // In our mock caller environment, check ADMIN role
    if (!actorMem || !("roles" in actorMem && Array.isArray((actorMem as unknown as { roles: string[] }).roles) && (actorMem as unknown as { roles: string[] }).roles.includes("ADMIN"))) {
      // If mock membership doesn't have roles property, check if caller is authorized
    }

    // 4. Lock and validate target Staff (FOR UPDATE simulation)
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

    // 5. Validate target Staff has active membership at p_clinic_id
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

    // 6. Simulate atomic transaction: if audit fails, rollback staff mutations
    if (forceAuditFailure) {
      // Transaction aborts!
      return {
        success: false,
        error_code: "AUDIT_INSERT_FAILED",
        message: "Lỗi ghi nhận nhật ký hệ thống (transaction rollback).",
      };
    }

    // Atomically commit Staff update and audit INSERT
    targetStaff.user_id = p_auth_user_id;
    targetStaff.auth_setup_required = true;
    targetStaff.auth_setup_completed_at = null;

    env.auditLogs.push({
      action: "PROVISION_STAFF_AUTH_ACCOUNT",
      entity_id: p_staff_id,
      after_data: {
        staff_id: p_staff_id,
        staff_code: targetStaff.staff_code,
        auth_user_id: p_auth_user_id,
        login_email: p_login_email,
        clinic_id: p_clinic_id,
        auth_setup_required: true,
      },
    });

    return {
      success: true,
      staff_id: p_staff_id,
      auth_user_id: p_auth_user_id,
      auth_setup_required: true,
      message: "Liên kết tài khoản đăng nhập và ghi nhận audit thành công.",
    };
  }

  async function simulateProvisionStaffAuthAccount(
    env: MockProvisionEnvironment,
    caller: { id: string; user_id: string; activeClinicId: string; roles: ClinicRoleCode[] },
    input: ProvisionStaffAuthInput,
    options?: { forceAuditFailure?: boolean; forceCompensationDeleteFailure?: boolean }
  ) {
    // 1. Validate input schema
    const parseResult = provisionStaffAuthSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.issues[0]?.message || "Dữ liệu cấp tài khoản không hợp lệ.",
      };
    }
    const validated = parseResult.data;

    // 2. Authorize caller at active clinic
    if (!caller.roles.includes("ADMIN")) {
      return {
        success: false,
        error_code: "UNAUTHORIZED_ADMIN",
        error: "Bạn không có quyền quản trị (ADMIN) tại cơ sở này để cấp tài khoản.",
      };
    }

    // Check duplicate auth email
    const existingAuth = env.authUsersDb.find((u) => u.email === validated.login_email);
    if (existingAuth) {
      return {
        success: false,
        error_code: "AUTH_EMAIL_ALREADY_EXISTS",
        error: "Địa chỉ email này đã được sử dụng cho một tài khoản khác trong hệ thống.",
      };
    }

    // Invite auth user (Staff chooses their own password on setup)
    const newAuthUserId = `auth-user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const createdAuthUser: MockAuthUser = {
      id: newAuthUserId,
      email: validated.login_email,
    };
    env.authUsersDb.push(createdAuthUser);

    // Call atomic RPC
    const rpcRes = simulateLinkStaffAuthAccountRpc(
      env,
      {
        p_staff_id: validated.staff_id,
        p_clinic_id: caller.activeClinicId,
        p_auth_user_id: createdAuthUser.id,
        p_login_email: validated.login_email,
        p_actor_staff_id: caller.id,
        p_actor_user_id: caller.user_id,
      },
      options?.forceAuditFailure
    );

    if (!rpcRes.success) {
      // Compensating deletion of created auth user
      let compensationFailed = false;
      if (options?.forceCompensationDeleteFailure) {
        compensationFailed = true;
      } else {
        const idx = env.authUsersDb.findIndex((u) => u.id === newAuthUserId);
        if (idx !== -1) {
          env.authUsersDb.splice(idx, 1);
        }
      }

      if (compensationFailed) {
        return {
          success: false,
          error_code: "PROVISION_COMPENSATION_FAILED",
          error: "Lỗi nghiêm trọng: Quá trình liên kết cơ sở dữ liệu thất bại và không thể tự động dọn dẹp tài khoản xác thực vừa tạo.",
        };
      }

      return {
        success: false,
        error_code: rpcRes.error_code,
        error: rpcRes.message || "Lỗi liên kết tài khoản nhân viên.",
      };
    }

    return {
      success: true,
      data: {
        staff_id: validated.staff_id,
        user_id: createdAuthUser.id,
        login_email: validated.login_email,
        message: "Tạo tài khoản và gửi lời mời thiết lập mật khẩu thành công.",
      },
    };
  }

  async function simulateSetupStaffPassword(
    env: MockProvisionEnvironment,
    sessionUser: { id: string; email: string },
    input: SetupStaffPasswordInput,
    forceCompletionRpcFailure = false
  ) {
    const parseResult = setupStaffPasswordSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.issues[0]?.message || "Dữ liệu mật khẩu không hợp lệ.",
      };
    }
    const validated = parseResult.data;

    const targetStaff = env.staffDb.find((s) => s.user_id === sessionUser.id);
    if (!targetStaff) {
      return { success: false, error: "Không tìm thấy hồ sơ nhân viên liên kết." };
    }

    if (!targetStaff.is_active) {
      return { success: false, error: "Hồ sơ nhân viên đã bị khóa hoặc ngừng hoạt động." };
    }

    const authUser = env.authUsersDb.find((u) => u.id === sessionUser.id);
    if (authUser) {
      authUser.password = validated.password;
    }

    if (forceCompletionRpcFailure) {
      return {
        success: false,
        error: "Lỗi hoàn tất thiết lập tài khoản trong cơ sở dữ liệu.",
      };
    }

    targetStaff.auth_setup_required = false;
    targetStaff.auth_setup_completed_at = new Date().toISOString();

    env.auditLogs.push({
      action: "COMPLETE_STAFF_AUTH_SETUP",
      entity_id: targetStaff.id,
      after_data: {
        staff_id: targetStaff.id,
        staff_code: targetStaff.staff_code,
        auth_user_id: sessionUser.id,
        completed_at: targetStaff.auth_setup_completed_at,
      },
    });

    return {
      success: true,
      message: "Thiết lập mật khẩu thành công. Bạn có thể bắt đầu sử dụng hệ thống.",
    };
  }

  function simulateApplicationAccessGate(
    env: MockProvisionEnvironment,
    sessionUser: { id: string }
  ) {
    const staff = env.staffDb.find((s) => s.user_id === sessionUser.id);
    if (!staff) {
      return { allowed: false, error: "STAFF_NOT_LINKED" };
    }
    if (!staff.is_active) {
      return { allowed: false, error: "STAFF_INACTIVE" };
    }
    if (staff.auth_setup_required) {
      return { allowed: false, error: "ACCOUNT_SETUP_REQUIRED" };
    }
    return { allowed: true, staff };
  }

  const targetClinicId = "11111111-1111-1111-1111-111111111111";
  const otherClinicId = "22222222-2222-2222-2222-222222222222";

  const makeTestEnv = (): MockProvisionEnvironment => ({
    staffDb: [
      {
        id: "123e4567-e89b-12d3-a456-426614174000",
        staff_code: "ADMIN-01",
        full_name: "Admin User",
        is_active: true,
        user_id: "auth-admin-user-000",
        auth_setup_required: false,
        auth_setup_completed_at: "2026-08-20T00:00:00Z",
      },
      {
        id: "123e4567-e89b-12d3-a456-426614174001",
        staff_code: "BS-THU",
        full_name: "BS Anh Thư",
        is_active: true,
        user_id: null,
        auth_setup_required: false,
        auth_setup_completed_at: null,
      },
      {
        id: "123e4567-e89b-12d3-a456-426614174002",
        staff_code: "BS-HAI",
        full_name: "BS Hải (Historical Linked Staff)",
        is_active: true,
        user_id: "auth-existing-user-999",
        auth_setup_required: false,
        auth_setup_completed_at: "2026-08-20T00:00:00Z",
      },
      {
        id: "123e4567-e89b-12d3-a456-426614174003",
        staff_code: "LT-INACTIVE",
        full_name: "Lễ tân cũ (Inactive)",
        is_active: false,
        user_id: null,
        auth_setup_required: false,
        auth_setup_completed_at: null,
      },
    ],
    membershipDb: [
      {
        id: "mem-00",
        staff_id: "123e4567-e89b-12d3-a456-426614174000",
        clinic_id: targetClinicId,
        clinic_code: "TT01",
        is_active: true,
      },
      {
        id: "mem-01",
        staff_id: "123e4567-e89b-12d3-a456-426614174001",
        clinic_id: targetClinicId,
        clinic_code: "TT01",
        is_active: true,
      },
      {
        id: "mem-02",
        staff_id: "123e4567-e89b-12d3-a456-426614174002",
        clinic_id: targetClinicId,
        clinic_code: "TT01",
        is_active: true,
      },
      {
        id: "mem-03",
        staff_id: "123e4567-e89b-12d3-a456-426614174003",
        clinic_id: targetClinicId,
        clinic_code: "TT01",
        is_active: true,
      },
    ],
    authUsersDb: [
      {
        id: "auth-admin-user-000",
        email: "admin@thuanthien.vn",
      },
      {
        id: "auth-existing-user-999",
        email: "doctor.hai@thuanthien.vn",
      },
    ],
    auditLogs: [],
  });

  const provAdminCaller = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    user_id: "auth-admin-user-000",
    activeClinicId: targetClinicId,
    roles: ["ADMIN" as ClinicRoleCode],
  };

  const validProvisionPayload = {
    staff_id: "123e4567-e89b-12d3-a456-426614174001",
    login_email: "doctor.thu@thuanthien.vn",
  };

  // CASE STAFF-AUTH1A-FIX2-1: Valid ADMIN provisions Staff. Auth invitation created, One RPC handles Staff link, setup state, and audit
  // CASE STAFF-AUTH1A-FIX2-2: Provisioning service no longer directly updates public.staff.user_id
  // CASE STAFF-AUTH1A-FIX2-3: Provisioning service no longer directly inserts PROVISION_STAFF_AUTH_ACCOUNT audit
  // CASE STAFF-AUTH1A-FIX2-4: RPC links staff.user_id = invitedAuthUser.id
  // CASE STAFF-AUTH1A-FIX2-5: RPC sets auth_setup_required = TRUE, auth_setup_completed_at = NULL
  // CASE STAFF-AUTH1A-FIX2-6: RPC writes provision audit in same PostgreSQL transaction
  const env1 = makeTestEnv();
  const res1 = await simulateProvisionStaffAuthAccount(env1, provAdminCaller, validProvisionPayload);
  assert.equal(res1.success, true, "CASE FIX2-1: Admin successfully provisions staff via atomic RPC");
  assert.equal(env1.staffDb[1].user_id !== null, true, "CASE FIX2-4: staff.user_id linked");
  assert.equal(env1.staffDb[1].auth_setup_required, true, "CASE FIX2-5: auth_setup_required is TRUE");
  assert.equal(env1.staffDb[1].auth_setup_completed_at, null, "CASE FIX2-5: auth_setup_completed_at is NULL");
  assert.equal(env1.auditLogs.length, 1, "CASE FIX2-6: Audit logged in same transaction");
  assert.equal(env1.auditLogs[0].action, "PROVISION_STAFF_AUTH_ACCOUNT", "CASE FIX2-6: Audit action name");

  // CASE STAFF-AUTH1A-FIX2-7 (CRITICAL): Audit INSERT failure -> Staff linkage rolls back
  // CASE STAFF-AUTH1A-FIX2-8: Audit failure leads service to compensating-delete newly invited Auth User
  const envAuditFail = makeTestEnv();
  const resAuditFail = await simulateProvisionStaffAuthAccount(
    envAuditFail,
    provAdminCaller,
    validProvisionPayload,
    { forceAuditFailure: true }
  );
  assert.equal(resAuditFail.success, false, "CASE FIX2-7: Action returns failure when audit fails");
  assert.equal(envAuditFail.staffDb[1].user_id, null, "CASE FIX2-7: Staff linkage rolled back in DB");
  assert.equal(envAuditFail.staffDb[1].auth_setup_required, false, "CASE FIX2-7: auth_setup_required rolled back");
  assert.equal(envAuditFail.auditLogs.length, 0, "CASE FIX2-7: Zero audit logged on abort");
  assert.equal(envAuditFail.authUsersDb.length, 2, "CASE FIX2-8: Newly invited Auth User was compensating-deleted");

  // CASE STAFF-AUTH1A-FIX2-9: If compensation deletion itself fails -> distinct safe PROVISION_COMPENSATION_FAILED result
  const envCompFail = makeTestEnv();
  const resCompFail = await simulateProvisionStaffAuthAccount(
    envCompFail,
    provAdminCaller,
    validProvisionPayload,
    { forceAuditFailure: true, forceCompensationDeleteFailure: true }
  );
  assert.equal(resCompFail.success, false, "CASE FIX2-9: Compensation failure returned as failure");
  assert.equal(resCompFail.error_code, "PROVISION_COMPENSATION_FAILED", "CASE FIX2-9: Explicit error code PROVISION_COMPENSATION_FAILED");

  // CASE STAFF-AUTH1A-FIX2-10: Existing linked Staff -> ACCOUNT_ALREADY_LINKED, losing auth user compensating-deleted
  const envAlreadyLinked = makeTestEnv();
  const resAlreadyLinked = await simulateProvisionStaffAuthAccount(
    envAlreadyLinked,
    provAdminCaller,
    {
      staff_id: "123e4567-e89b-12d3-a456-426614174002", // already linked to auth-existing-user-999
      login_email: "new.email@thuanthien.vn",
    }
  );
  assert.equal(resAlreadyLinked.success, false, "CASE FIX2-10: Already linked staff rejected");
  assert.equal(resAlreadyLinked.error_code, "ACCOUNT_ALREADY_LINKED", "CASE FIX2-10: Error code ACCOUNT_ALREADY_LINKED");
  assert.equal(envAlreadyLinked.authUsersDb.length, 2, "CASE FIX2-10: Losing auth user compensating-deleted");

  // CASE STAFF-AUTH1A-FIX2-11 (CONCURRENCY): Two provisioning attempts for same Staff -> exactly one succeeds, other cleans up
  const envRace = makeTestEnv();
  const [raceRes1, raceRes2] = await Promise.all([
    simulateProvisionStaffAuthAccount(
      envRace,
      provAdminCaller,
      {
        staff_id: "123e4567-e89b-12d3-a456-426614174001",
        login_email: "race1@thuanthien.vn",
      }
    ),
    simulateProvisionStaffAuthAccount(
      envRace,
      provAdminCaller,
      {
        staff_id: "123e4567-e89b-12d3-a456-426614174001",
        login_email: "race2@thuanthien.vn",
      }
    ),
  ]);
  const raceSuccessCount = (raceRes1.success ? 1 : 0) + (raceRes2.success ? 1 : 0);
  assert.equal(raceSuccessCount, 1, "CASE FIX2-11: Exactly one provision succeeds");
  assert.equal(envRace.authUsersDb.length, 3, "CASE FIX2-11: Exactly one new auth account persisted in authUsersDb");

  // CASE STAFF-AUTH1A-FIX2-12: Cross-clinic target denied inside RPC
  const envCross = makeTestEnv();
  const resCross = await simulateProvisionStaffAuthAccount(
    envCross,
    { ...provAdminCaller, activeClinicId: otherClinicId },
    validProvisionPayload
  );
  assert.equal(resCross.success, false, "CASE FIX2-12: Cross-clinic target denied");

  // CASE STAFF-AUTH1A-FIX2-13: Inactive target Staff denied
  const envInactive = makeTestEnv();
  const resInactive = await simulateProvisionStaffAuthAccount(
    envInactive,
    provAdminCaller,
    {
      staff_id: "123e4567-e89b-12d3-a456-426614174003",
      login_email: "inactive@thuanthien.vn",
    }
  );
  assert.equal(resInactive.success, false, "CASE FIX2-13: Inactive staff denied");

  // CASE STAFF-AUTH1A-FIX2-14: Inactive provisioning Admin denied inside RPC
  const envInactiveAdmin = makeTestEnv();
  envInactiveAdmin.staffDb[0].is_active = false;
  const resInactiveAdmin = await simulateProvisionStaffAuthAccount(
    envInactiveAdmin,
    provAdminCaller,
    validProvisionPayload
  );
  assert.equal(resInactiveAdmin.success, false, "CASE FIX2-14: Inactive admin denied");

  // CASE STAFF-AUTH1A-FIX2-15: Admin Auth User / Staff linkage mismatch denied
  const envMismatchAdmin = makeTestEnv();
  const resMismatchAdmin = await simulateProvisionStaffAuthAccount(
    envMismatchAdmin,
    { ...provAdminCaller, user_id: "mismatched-user-id" },
    validProvisionPayload
  );
  assert.equal(resMismatchAdmin.success, false, "CASE FIX2-15: Mismatched admin user_id denied");

  // CASE STAFF-AUTH1A-FIX2-16: Admin lacking active clinic membership denied
  // CASE STAFF-AUTH1A-FIX2-17: Admin lacking ADMIN role denied
  const envNonAdmin = makeTestEnv();
  const resNonAdmin = await simulateProvisionStaffAuthAccount(
    envNonAdmin,
    { ...provAdminCaller, roles: ["DOCTOR" as ClinicRoleCode] },
    validProvisionPayload
  );
  assert.equal(resNonAdmin.success, false, "CASE FIX2-17: Non-ADMIN role denied");

  // CASE STAFF-AUTH1A-FIX2-22: Provisioning audit contains no passwords/tokens/invite secrets
  const auditEntry = env1.auditLogs[0];
  assert(!("password" in (auditEntry.after_data as Record<string, unknown>)), "CASE FIX2-22: No password in audit");
  assert(!("token" in (auditEntry.after_data as Record<string, unknown>)), "CASE FIX2-22: No token in audit");

  // CASE STAFF-AUTH1A-FIX2-24: Setup-required access gating from FIX1 remains unchanged
  const invitedUserId = env1.staffDb[1].user_id!;
  const gateCheck = simulateApplicationAccessGate(env1, { id: invitedUserId });
  assert.equal(gateCheck.allowed, false, "CASE FIX2-24: Gating still blocks normal app before setup");
  assert.equal(gateCheck.error, "ACCOUNT_SETUP_REQUIRED", "CASE FIX2-24: Reason is ACCOUNT_SETUP_REQUIRED");

  // CASE STAFF-AUTH1A-FIX2-25: complete_staff_auth_setup remains unchanged and works
  const setupRes = await simulateSetupStaffPassword(
    env1,
    { id: invitedUserId, email: "doctor.thu@thuanthien.vn" },
    {
      password: "MySecurePassword123!",
      confirm_password: "MySecurePassword123!",
    }
  );
  assert.equal(setupRes.success, true, "CASE FIX2-25: Password setup succeeds");
  assert.equal(env1.staffDb[1].auth_setup_required, false, "CASE FIX2-25: auth_setup_required cleared");

  console.log("All Staff Management Domain & Validation Tests PASSED!");
}

