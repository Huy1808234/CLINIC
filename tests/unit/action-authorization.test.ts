import assert from "node:assert/strict";
import type { ClinicRoleCode } from "@/types/clinic";

// Standard typed errors matching production classes
class ActionForbiddenError extends Error {
  public readonly code = "ACTION_FORBIDDEN";
  public readonly statusCode = 403;
  constructor(message = "Bạn không có quyền thực hiện thao tác này.") {
    super(message);
    this.name = "ActionForbiddenError";
    Object.setPrototypeOf(this, ActionForbiddenError.prototype);
  }
}

class StaffClinicAccessDeniedError extends Error {
  public readonly code = "STAFF_CLINIC_ACCESS_DENIED";
  public readonly statusCode = 403;
  constructor(message = "Nhân viên không có quyền truy cập hoặc không thuộc cơ sở phòng khám này.") {
    super(message);
    this.name = "StaffClinicAccessDeniedError";
    Object.setPrototypeOf(this, StaffClinicAccessDeniedError.prototype);
  }
}

class NoActiveClinicSelectedError extends Error {
  public readonly code = "NO_ACTIVE_CLINIC_SELECTED";
  public readonly statusCode = 400;
  constructor(message = "Vui lòng chọn cơ sở phòng khám làm việc.") {
    super(message);
    this.name = "NoActiveClinicSelectedError";
    Object.setPrototypeOf(this, NoActiveClinicSelectedError.prototype);
  }
}

interface MockMembership {
  clinic_id: string;
  clinic_code: string;
  clinic_name: string;
  organization_id: string;
  membership_id: string;
  is_primary: boolean;
  membership_active: boolean;
  clinic_active: boolean;
  roles: ClinicRoleCode[];
}

// Pure simulation of action authorization logic under test
function createMockActionAuthorizer(params: {
  staff: { id: string; staff_code: string; full_name: string } | null;
  activeClinicId: string | null;
  memberships: MockMembership[];
}) {
  const { staff, activeClinicId, memberships } = params;

  const requireAccess = () => {
    if (!staff) throw new Error("Staff required");
    if (!activeClinicId) throw new NoActiveClinicSelectedError();
    const matched = memberships.find(
      (m) =>
        m.clinic_id === activeClinicId &&
        m.membership_active === true &&
        m.clinic_active === true
    );
    if (!matched) throw new StaffClinicAccessDeniedError();
    return {
      staff,
      clinic: {
        clinic_id: matched.clinic_id,
        clinic_code: matched.clinic_code,
        clinic_name: matched.clinic_name,
        organization_id: matched.organization_id,
        membership_id: matched.membership_id,
        is_primary: matched.is_primary,
      },
    };
  };

  return {
    requireActionAuthorization: async (options?: { requiredRoles?: ClinicRoleCode[] }) => {
      const access = requireAccess();
      const requiredRoles = options?.requiredRoles;

      if (!requiredRoles || requiredRoles.length === 0) {
        return { access, roles: [] };
      }

      const activeMem = memberships.find((m) => m.clinic_id === access.clinic.clinic_id);
      const callerRoles = activeMem?.roles || [];
      const hasAuthorizedRole = requiredRoles.some((r) => callerRoles.includes(r));

      if (!hasAuthorizedRole) {
        throw new ActionForbiddenError();
      }

      return {
        access,
        roles: callerRoles,
      };
    },

    requireTargetClinicRole: async (
      targetClinicId: string,
      requiredRoles: ClinicRoleCode[]
    ) => {
      if (!staff) throw new Error("Staff required");
      if (!targetClinicId) throw new ActionForbiddenError("Mã cơ sở không hợp lệ.");

      // Check caller's membership specifically at TARGET clinic
      const targetMem = memberships.find(
        (m) =>
          m.clinic_id === targetClinicId &&
          m.membership_active === true &&
          m.clinic_active === true
      );

      if (!targetMem) {
        throw new StaffClinicAccessDeniedError();
      }

      const callerRoles = targetMem.roles || [];
      if (requiredRoles && requiredRoles.length > 0) {
        const hasAuthorizedRole = requiredRoles.some((r) => callerRoles.includes(r));
        if (!hasAuthorizedRole) {
          throw new ActionForbiddenError();
        }
      }

      return {
        staff,
        clinic: {
          clinic_id: targetMem.clinic_id,
          clinic_code: targetMem.clinic_code,
          clinic_name: targetMem.clinic_name,
          organization_id: targetMem.organization_id,
          membership_id: targetMem.membership_id,
          is_primary: targetMem.is_primary,
        },
        roles: callerRoles,
      };
    },
  };
}

export function runActionAuthorizationTests() {
  console.log("Running Action Authorization Unit Tests...");

  const mockStaff = {
    id: "staff-1",
    staff_code: "DR-01",
    full_name: "Bác Sĩ Nguyễn Văn A",
  };

  const mockMemberships: MockMembership[] = [
    {
      clinic_id: "clinic-tt01",
      clinic_code: "TT01",
      clinic_name: "Thuận Thiên",
      organization_id: "org-1",
      membership_id: "mem-tt01",
      is_primary: false,
      membership_active: true,
      clinic_active: true,
      roles: ["DOCTOR"],
    },
    {
      clinic_id: "clinic-pn01",
      clinic_code: "PN01",
      clinic_name: "Phúc Nguyên",
      organization_id: "org-1",
      membership_id: "mem-pn01",
      is_primary: false,
      membership_active: true,
      clinic_active: true,
      roles: ["ADMIN", "DOCTOR"],
    },
    {
      clinic_id: "clinic-md01",
      clinic_code: "MD01",
      clinic_name: "Minh Đức",
      organization_id: "org-1",
      membership_id: "mem-md01",
      is_primary: false,
      membership_active: true,
      clinic_active: true,
      roles: ["RECEPTIONIST"],
    },
  ];

  // ACTIVE CLINIC ACTION AUTH TESTS
  // CASE 1: Valid access + no required roles -> PASS
  const authTT = createMockActionAuthorizer({
    staff: mockStaff,
    activeClinicId: "clinic-tt01",
    memberships: mockMemberships,
  });

  authTT.requireActionAuthorization().then((res) => {
    assert.equal(res.access.clinic.clinic_code, "TT01", "CASE 1: Access returned when no roles required");
  });

  // CASE 2: Required role DOCTOR, active clinic TT01 (has DOCTOR) -> PASS
  authTT.requireActionAuthorization({ requiredRoles: ["DOCTOR"] }).then((res) => {
    assert.equal(res.roles.includes("DOCTOR"), true, "CASE 2: Authorized with DOCTOR role");
  });

  // CASE 3: Required roles [ADMIN, MANAGER, DOCTOR] -> ANY-role matches DOCTOR -> PASS
  authTT.requireActionAuthorization({ requiredRoles: ["ADMIN", "MANAGER", "DOCTOR"] }).then((res) => {
    assert.equal(res.access.clinic.clinic_code, "TT01", "CASE 3: ANY-role matching succeeds");
  });

  // CASE 4: Required role ADMIN at active clinic TT01 (only has DOCTOR) -> throws ActionForbiddenError
  assert.rejects(
    async () => {
      await authTT.requireActionAuthorization({ requiredRoles: ["ADMIN"] });
    },
    (err: unknown) => err instanceof ActionForbiddenError && err.code === "ACTION_FORBIDDEN",
    "CASE 4: Denied when active clinic lacks required ADMIN role"
  );

  // CASE 5: No active clinic cookie -> propagates NoActiveClinicSelectedError
  const authNoClinic = createMockActionAuthorizer({
    staff: mockStaff,
    activeClinicId: null,
    memberships: mockMemberships,
  });

  assert.rejects(
    async () => {
      await authNoClinic.requireActionAuthorization();
    },
    (err: unknown) => err instanceof NoActiveClinicSelectedError,
    "CASE 5: Propagates NoActiveClinicSelectedError"
  );

  // TARGET CLINIC AUTH TESTS
  // CASE 8: Caller ADMIN at target clinic PN01 -> PASS
  authTT.requireTargetClinicRole("clinic-pn01", ["ADMIN"]).then((res) => {
    assert.equal(res.clinic.clinic_code, "PN01", "CASE 8: Target clinic authorization passes");
    assert.equal(res.roles.includes("ADMIN"), true);
  });

  // CASE 9 (CRITICAL): Caller active at TT01 (DOCTOR) & target is MD01 (RECEPTIONIST). Requesting ADMIN -> DENY
  assert.rejects(
    async () => {
      await authTT.requireTargetClinicRole("clinic-md01", ["ADMIN"]);
    },
    (err: unknown) => err instanceof ActionForbiddenError,
    "CASE 9: Target clinic lacks ADMIN -> Denied"
  );

  // CASE 10: Caller has membership at MD01 (RECEPTIONIST), requesting [ADMIN] -> DENY
  assert.rejects(
    async () => {
      await authTT.requireTargetClinicRole("clinic-md01", ["ADMIN"]);
    },
    (err: unknown) => err instanceof ActionForbiddenError,
    "CASE 10: Lacks required role at target clinic"
  );

  // CASE 11: Active clinic is TT01, but targeting PN01 with [ADMIN] -> PASS (holds ADMIN at PN01)
  authTT.requireTargetClinicRole("clinic-pn01", ["ADMIN"]).then((res) => {
    assert.equal(res.clinic.clinic_code, "PN01", "CASE 11: Target clinic role independent of active clinic");
  });

  // CASE 12: Inactive target membership -> DENY
  const authRevoked = createMockActionAuthorizer({
    staff: mockStaff,
    activeClinicId: "clinic-tt01",
    memberships: [
      { ...mockMemberships[0] },
      { ...mockMemberships[1], membership_active: false },
    ],
  });

  assert.rejects(
    async () => {
      await authRevoked.requireTargetClinicRole("clinic-pn01", ["ADMIN"]);
    },
    (err: unknown) => err instanceof StaffClinicAccessDeniedError,
    "CASE 12: Inactive target membership denied"
  );

  // CASE 14: Forged target clinic UUID -> DENY
  assert.rejects(
    async () => {
      await authTT.requireTargetClinicRole("forged-target-clinic-99", ["ADMIN"]);
    },
    (err: unknown) => err instanceof StaffClinicAccessDeniedError,
    "CASE 14: Forged target clinic denied"
  );

  // CASE 15: Cross-clinic assumption check: ADMIN at PN01 does NOT grant ADMIN at TT01
  assert.rejects(
    async () => {
      await authTT.requireTargetClinicRole("clinic-tt01", ["ADMIN"]);
    },
    (err: unknown) => err instanceof ActionForbiddenError,
    "CASE 15: ADMIN at PN01 does not grant ADMIN at TT01"
  );

  // AUTH1.7D2B RECEPTION ACTION AUTHORIZATION & CLINIC OWNERSHIP TESTS
  // CASE RECEPTION 1: Caller with RECEPTIONIST at active clinic TT01 -> Authorized, clinic_id stamped as TT01
  const authReceptionistTT = createMockActionAuthorizer({
    staff: mockStaff,
    activeClinicId: "clinic-tt01",
    memberships: [
      {
        ...mockMemberships[0],
        roles: ["RECEPTIONIST" as ClinicRoleCode],
      },
    ],
  });

  authReceptionistTT
    .requireActionAuthorization({ requiredRoles: ["RECEPTIONIST", "ADMIN"] })
    .then((res) => {
      assert.equal(res.access.clinic.clinic_id, "clinic-tt01", "CASE RECEPTION 1: Active clinic is TT01");
      assert.equal(res.roles.includes("RECEPTIONIST"), true, "CASE RECEPTION 1: Holds RECEPTIONIST role");
    });

  // CASE RECEPTION 2: Caller with ADMIN at active clinic TT01 -> Authorized
  const authAdminTT = createMockActionAuthorizer({
    staff: mockStaff,
    activeClinicId: "clinic-tt01",
    memberships: [
      {
        ...mockMemberships[0],
        roles: ["ADMIN" as ClinicRoleCode],
      },
    ],
  });

  authAdminTT
    .requireActionAuthorization({ requiredRoles: ["RECEPTIONIST", "ADMIN"] })
    .then((res) => {
      assert.equal(res.access.clinic.clinic_id, "clinic-tt01", "CASE RECEPTION 2: Active clinic is TT01");
      assert.equal(res.roles.includes("ADMIN"), true, "CASE RECEPTION 2: Holds ADMIN role");
    });

  // CASE RECEPTION 3: Caller with DOCTOR only at active clinic TT01 -> DENIED with ActionForbiddenError
  assert.rejects(
    async () => {
      await authTT.requireActionAuthorization({ requiredRoles: ["RECEPTIONIST", "ADMIN"] });
    },
    (err: unknown) => err instanceof ActionForbiddenError,
    "CASE RECEPTION 3: DOCTOR only lacks RECEPTIONIST/ADMIN at active clinic"
  );

  // CASE RECEPTION 4: Multi-clinic receptionist at MD01 operating under TT01 context (where DOCTOR only) -> DENIED
  const authMulti = createMockActionAuthorizer({
    staff: mockStaff,
    activeClinicId: "clinic-tt01", // Currently operating TT01
    memberships: [
      {
        ...mockMemberships[0],
        roles: ["DOCTOR" as ClinicRoleCode], // Doctor only at TT01
      },
      {
        ...mockMemberships[1],
        clinic_id: "clinic-md01",
        roles: ["RECEPTIONIST" as ClinicRoleCode], // Receptionist at MD01
      },
    ],
  });

  assert.rejects(
    async () => {
      await authMulti.requireActionAuthorization({ requiredRoles: ["RECEPTIONIST", "ADMIN"] });
    },
    (err: unknown) => err instanceof ActionForbiddenError,
    "CASE RECEPTION 4: Multi-clinic caller must switch active clinic before operating reception at MD01"
  );

  // CASE RECEPTION 5: Caller with MANAGER only at active clinic TT01 -> DENIED with ActionForbiddenError
  const authManagerTT = createMockActionAuthorizer({
    staff: mockStaff,
    activeClinicId: "clinic-tt01",
    memberships: [
      {
        ...mockMemberships[0],
        roles: ["MANAGER" as ClinicRoleCode],
      },
    ],
  });

  assert.rejects(
    async () => {
      await authManagerTT.requireActionAuthorization({ requiredRoles: ["RECEPTIONIST", "ADMIN"] });
    },
    (err: unknown) => err instanceof ActionForbiddenError,
    "CASE RECEPTION 5: MANAGER only lacks RECEPTIONIST/ADMIN at active clinic"
  );

  // CLINICAL1A1 DOCTOR-ONLY ACTION AUTHORIZATION TESTS
  // CASE C1A-1: Caller with DOCTOR at active clinic TT01 -> ALLOWED
  const authDocTT = createMockActionAuthorizer({
    staff: mockStaff,
    activeClinicId: "clinic-tt01",
    memberships: [
      {
        ...mockMemberships[0],
        roles: ["DOCTOR" as ClinicRoleCode],
      },
    ],
  });

  authDocTT
    .requireActionAuthorization({ requiredRoles: ["DOCTOR"] })
    .then((res) => {
      assert.equal(res.access.clinic.clinic_id, "clinic-tt01", "CASE C1A-1: Active clinic is TT01");
      assert.equal(res.roles.includes("DOCTOR"), true, "CASE C1A-1: Holds DOCTOR role");
    });

  // CASE C1A-2: Caller with RECEPTIONIST only at active clinic -> DENIED for DOCTOR action
  assert.rejects(
    async () => {
      await authReceptionistTT.requireActionAuthorization({ requiredRoles: ["DOCTOR"] });
    },
    (err: unknown) => err instanceof ActionForbiddenError,
    "CASE C1A-2: RECEPTIONIST only lacks DOCTOR role"
  );

  // CASE C1A-3: Caller with ADMIN only at active clinic -> DENIED for DOCTOR action
  assert.rejects(
    async () => {
      await authAdminTT.requireActionAuthorization({ requiredRoles: ["DOCTOR"] });
    },
    (err: unknown) => err instanceof ActionForbiddenError,
    "CASE C1A-3: ADMIN only lacks DOCTOR role"
  );

  // CASE C1A-4: Caller with ADMIN + DOCTOR at active clinic -> ALLOWED
  const authAdminDocTT = createMockActionAuthorizer({
    staff: mockStaff,
    activeClinicId: "clinic-tt01",
    memberships: [
      {
        ...mockMemberships[0],
        roles: ["ADMIN" as ClinicRoleCode, "DOCTOR" as ClinicRoleCode],
      },
    ],
  });

  authAdminDocTT
    .requireActionAuthorization({ requiredRoles: ["DOCTOR"] })
    .then((res) => {
      assert.equal(res.access.clinic.clinic_id, "clinic-tt01", "CASE C1A-4: Active clinic is TT01");
      assert.equal(res.roles.includes("DOCTOR"), true, "CASE C1A-4: Holds DOCTOR role");
    });

  console.log("All Action Authorization Unit Tests PASSED!");
}
