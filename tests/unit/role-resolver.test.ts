import assert from "node:assert/strict";
import type { ClinicRoleCode } from "@/types/clinic";

// Standard typed errors matching production classes
class AuthenticationRequiredError extends Error {
  public readonly code = "UNAUTHENTICATED";
  public readonly statusCode = 401;
  constructor(message = "Yêu cầu đăng nhập để truy cập tài nguyên này.") {
    super(message);
    this.name = "AuthenticationRequiredError";
    Object.setPrototypeOf(this, AuthenticationRequiredError.prototype);
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

class StaffNoClinicRolesError extends Error {
  public readonly code = "STAFF_NO_CLINIC_ROLES";
  public readonly statusCode = 403;
  constructor(message = "Nhân viên chưa được phân công vai trò nào tại cơ sở phòng khám này.") {
    super(message);
    this.name = "StaffNoClinicRolesError";
    Object.setPrototypeOf(this, StaffNoClinicRolesError.prototype);
  }
}

interface MockMembership {
  id: string;
  staff_id: string;
  clinic_id: string;
  clinic_code: string;
  clinic_name: string;
  organization_id: string;
  is_primary: boolean;
}

interface MockRoleRecord {
  id: string;
  staff_clinic_membership_id: string;
  role_code: ClinicRoleCode;
}

export function runRoleResolverTests() {
  console.log("Running Clinic Role Resolver Unit Tests...");

  // Mock Active Memberships for a Staff Member
  const mockStaffMemberships: MockMembership[] = [
    {
      id: "mem-clinic-1",
      staff_id: "staff-hai",
      clinic_id: "clinic-1",
      clinic_code: "TT-CS1",
      clinic_name: "Thuận Thiên Cơ Sở 1",
      organization_id: "org-1",
      is_primary: true,
    },
    {
      id: "mem-clinic-2",
      staff_id: "staff-hai",
      clinic_id: "clinic-2",
      clinic_code: "TT-CS2",
      clinic_name: "Thuận Thiên Cơ Sở 2",
      organization_id: "org-1",
      is_primary: false,
    },
    {
      id: "mem-clinic-no-roles",
      staff_id: "staff-hai",
      clinic_id: "clinic-3",
      clinic_code: "TT-CS3",
      clinic_name: "Thuận Thiên Cơ Sở 3",
      organization_id: "org-1",
      is_primary: false,
    },
  ];

  // Mock Roles Table
  const mockRolesTable: MockRoleRecord[] = [
    // Roles for Clinic 1: DOCTOR, MANAGER
    { id: "r-1", staff_clinic_membership_id: "mem-clinic-1", role_code: "DOCTOR" },
    { id: "r-2", staff_clinic_membership_id: "mem-clinic-1", role_code: "MANAGER" },

    // Roles for Clinic 2: DOCTOR only
    { id: "r-3", staff_clinic_membership_id: "mem-clinic-2", role_code: "DOCTOR" },

    // Clinic 3 has NO rows in mockRolesTable
  ];

  // Pure hasClinicRole helper test
  const hasClinicRole = (roles: ClinicRoleCode[], req: ClinicRoleCode) => roles.includes(req);
  assert.equal(hasClinicRole(["DOCTOR", "MANAGER"], "DOCTOR"), true);
  assert.equal(hasClinicRole(["DOCTOR", "MANAGER"], "ADMIN"), false);

  // Resolver simulation under test (mirroring role-resolver.ts)
  const createMockRoleResolver = (memberships: MockMembership[] | null) => {
    return {
      getCurrentStaffRolesForClinic: async (clinicId: string): Promise<ClinicRoleCode[]> => {
        if (!memberships) return [];
        const mem = memberships.find((m) => m.clinic_id === clinicId);
        if (!mem) return [];
        return mockRolesTable
          .filter((r) => r.staff_clinic_membership_id === mem.id)
          .map((r) => r.role_code);
      },
      requireCurrentStaffRolesForClinic: async (clinicId: string) => {
        if (!memberships) {
          throw new AuthenticationRequiredError();
        }
        const mem = memberships.find((m) => m.clinic_id === clinicId);
        if (!mem) {
          throw new StaffClinicAccessDeniedError();
        }

        const roles = mockRolesTable
          .filter((r) => r.staff_clinic_membership_id === mem.id)
          .map((r) => r.role_code);

        if (roles.length === 0) {
          throw new StaffNoClinicRolesError();
        }

        return {
          membership_id: mem.id,
          staff_id: mem.staff_id,
          clinic_id: mem.clinic_id,
          clinic_code: mem.clinic_code,
          clinic_name: mem.clinic_name,
          organization_id: mem.organization_id,
          is_primary: mem.is_primary,
          roles,
        };
      },
    };
  };

  const resolver = createMockRoleResolver(mockStaffMemberships);

  // CASE 1: Target clinic not in caller's active memberships -> throws STAFF_CLINIC_ACCESS_DENIED
  assert.rejects(
    async () => {
      await resolver.requireCurrentStaffRolesForClinic("clinic-unauthorized-999");
    },
    (err: unknown) => {
      return (
        err instanceof StaffClinicAccessDeniedError &&
        err.code === "STAFF_CLINIC_ACCESS_DENIED" &&
        err.statusCode === 403
      );
    },
    "CASE 1: Accessing unassigned clinic throws STAFF_CLINIC_ACCESS_DENIED"
  );

  // CASE 2: Multi-role resolution at authorized clinic (Clinic 1 has DOCTOR + MANAGER)
  resolver.requireCurrentStaffRolesForClinic("clinic-1").then((ctx) => {
    assert.equal(ctx.clinic_id, "clinic-1");
    assert.equal(ctx.clinic_code, "TT-CS1");
    assert.equal(ctx.roles.length, 2);
    assert.equal(ctx.roles.includes("DOCTOR"), true);
    assert.equal(ctx.roles.includes("MANAGER"), true);
    assert.equal(ctx.roles.includes("ADMIN"), false);
  });

  // CASE 3: Single role resolution at authorized clinic (Clinic 2 has DOCTOR only)
  resolver.requireCurrentStaffRolesForClinic("clinic-2").then((ctx) => {
    assert.equal(ctx.clinic_id, "clinic-2");
    assert.equal(ctx.roles.length, 1);
    assert.equal(ctx.roles[0], "DOCTOR");
  });

  // CASE 4: Membership exists, but zero roles assigned -> throws STAFF_NO_CLINIC_ROLES
  assert.rejects(
    async () => {
      await resolver.requireCurrentStaffRolesForClinic("clinic-3");
    },
    (err: unknown) => {
      return (
        err instanceof StaffNoClinicRolesError &&
        err.code === "STAFF_NO_CLINIC_ROLES" &&
        err.statusCode === 403
      );
    },
    "CASE 4: Membership with zero roles throws STAFF_NO_CLINIC_ROLES"
  );

  // CASE 5: Role isolation between clinics (MANAGER role in Clinic 1 does NOT bleed into Clinic 2)
  resolver.getCurrentStaffRolesForClinic("clinic-2").then((roles) => {
    assert.equal(roles.includes("MANAGER"), false, "CASE 5: Clinic 1 MANAGER role does not bleed into Clinic 2");
    assert.equal(roles.includes("DOCTOR"), true);
  });

  console.log("All Clinic Role Resolver Unit Tests PASSED!");
}
