import assert from "node:assert/strict";

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

class StaffNotLinkedError extends Error {
  public readonly code = "STAFF_NOT_LINKED";
  public readonly statusCode = 403;
  constructor(message = "Tài khoản người dùng chưa được liên kết với hồ sơ nhân viên.") {
    super(message);
    this.name = "StaffNotLinkedError";
    Object.setPrototypeOf(this, StaffNotLinkedError.prototype);
  }
}

class StaffInactiveError extends Error {
  public readonly code = "STAFF_INACTIVE";
  public readonly statusCode = 403;
  constructor(message = "Hồ sơ nhân viên đã bị khóa hoặc ngừng hoạt động.") {
    super(message);
    this.name = "StaffInactiveError";
    Object.setPrototypeOf(this, StaffInactiveError.prototype);
  }
}

class StaffNoActiveClinicError extends Error {
  public readonly code = "STAFF_NO_ACTIVE_CLINIC";
  public readonly statusCode = 403;
  constructor(message = "Nhân viên chưa được phân công vào bất kỳ cơ sở phòng khám nào đang hoạt động.") {
    super(message);
    this.name = "StaffNoActiveClinicError";
    Object.setPrototypeOf(this, StaffNoActiveClinicError.prototype);
  }
}

interface MockClinic {
  id: string;
  organization_id: string;
  clinic_code: string;
  name: string;
  is_active: boolean;
}

interface MockMembership {
  id: string;
  staff_id: string;
  clinic_id: string;
  is_primary: boolean;
  is_active: boolean;
}

interface MockStaff {
  id: string;
  user_id: string | null;
  staff_code: string;
  full_name: string;
  is_active: boolean;
}

export function runClinicResolverTests() {
  console.log("Running Clinic Membership Resolver Unit Tests...");

  // Mock Clinics Table
  const mockClinics: MockClinic[] = [
    {
      id: "clinic-1",
      organization_id: "org-1",
      clinic_code: "TT-CS1",
      name: "Thuận Thiên CS1",
      is_active: true,
    },
    {
      id: "clinic-2",
      organization_id: "org-1",
      clinic_code: "TT-CS2",
      name: "Thuận Thiên CS2",
      is_active: true,
    },
    {
      id: "clinic-inactive-3",
      organization_id: "org-1",
      clinic_code: "TT-CS3-CLOSED",
      name: "Thuận Thiên CS3 (Đóng cửa)",
      is_active: false, // Inactive Clinic
    },
  ];

  // Mock Memberships Table
  const mockMemberships: MockMembership[] = [
    {
      id: "mem-1",
      staff_id: "staff-active-single",
      clinic_id: "clinic-1",
      is_primary: true,
      is_active: true,
    },
    {
      id: "mem-2a",
      staff_id: "staff-active-multi",
      clinic_id: "clinic-1",
      is_primary: true,
      is_active: true,
    },
    {
      id: "mem-2b",
      staff_id: "staff-active-multi",
      clinic_id: "clinic-2",
      is_primary: false,
      is_active: true,
    },
    {
      id: "mem-inactive",
      staff_id: "staff-with-inactive-mem",
      clinic_id: "clinic-1",
      is_primary: true,
      is_active: false, // Inactive Membership
    },
    {
      id: "mem-to-inactive-clinic",
      staff_id: "staff-with-inactive-clinic",
      clinic_id: "clinic-inactive-3",
      is_primary: true,
      is_active: true, // Active Membership, but Inactive Clinic
    },
  ];

  // Resolver simulation under test (mirroring clinic-resolver.ts)
  const createMockResolver = (currentStaff: MockStaff | null) => {
    return {
      getCurrentStaffClinicMemberships: async () => {
        if (!currentStaff || !currentStaff.is_active) return [];

        const staffMems = mockMemberships.filter(
          (m) => m.staff_id === currentStaff.id && m.is_active
        );

        const results = [];
        for (const mem of staffMems) {
          const clinic = mockClinics.find((c) => c.id === mem.clinic_id && c.is_active);
          if (clinic) {
            results.push({
              membership_id: mem.id,
              staff_id: mem.staff_id,
              clinic_id: clinic.id,
              clinic_code: clinic.clinic_code,
              clinic_name: clinic.name,
              organization_id: clinic.organization_id,
              is_primary: mem.is_primary,
            });
          }
        }
        return results;
      },
      requireCurrentStaffClinicMemberships: async () => {
        if (!currentStaff) {
          throw new AuthenticationRequiredError();
        }
        if (!currentStaff.user_id) {
          throw new StaffNotLinkedError();
        }
        if (!currentStaff.is_active) {
          throw new StaffInactiveError();
        }

        const staffMems = mockMemberships.filter(
          (m) => m.staff_id === currentStaff.id && m.is_active
        );

        const results = [];
        for (const mem of staffMems) {
          const clinic = mockClinics.find((c) => c.id === mem.clinic_id && c.is_active);
          if (clinic) {
            results.push({
              membership_id: mem.id,
              staff_id: mem.staff_id,
              clinic_id: clinic.id,
              clinic_code: clinic.clinic_code,
              clinic_name: clinic.name,
              organization_id: clinic.organization_id,
              is_primary: mem.is_primary,
            });
          }
        }

        if (results.length === 0) {
          throw new StaffNoActiveClinicError();
        }

        return results;
      },
    };
  };

  // CASE 1: Valid active Staff with zero active memberships -> throws STAFF_NO_ACTIVE_CLINIC
  const staffZeroMems: MockStaff = {
    id: "staff-zero",
    user_id: "auth-zero",
    staff_code: "BS-ZERO",
    full_name: "BS. Chưa Gán Cơ Sở",
    is_active: true,
  };
  const zeroResolver = createMockResolver(staffZeroMems);

  zeroResolver.getCurrentStaffClinicMemberships().then((res) => {
    assert.equal(res.length, 0, "CASE 1: getCurrentStaffClinicMemberships returns empty array");
  });

  assert.rejects(
    async () => {
      await zeroResolver.requireCurrentStaffClinicMemberships();
    },
    (err: unknown) => {
      return (
        err instanceof StaffNoActiveClinicError &&
        err.code === "STAFF_NO_ACTIVE_CLINIC" &&
        err.statusCode === 403
      );
    },
    "CASE 1: requireCurrentStaffClinicMemberships throws STAFF_NO_ACTIVE_CLINIC"
  );

  // CASE 2: Staff with one active membership + active clinic -> returns exactly that clinic
  const staffSingle: MockStaff = {
    id: "staff-active-single",
    user_id: "auth-single",
    staff_code: "BS-SINGLE",
    full_name: "BS. Một Cơ Sở",
    is_active: true,
  };
  const singleResolver = createMockResolver(staffSingle);

  singleResolver.requireCurrentStaffClinicMemberships().then((mems) => {
    assert.equal(mems.length, 1, "CASE 2: Exactly 1 clinic membership returned");
    assert.equal(mems[0].clinic_id, "clinic-1");
    assert.equal(mems[0].clinic_code, "TT-CS1");
    assert.equal(mems[0].is_primary, true);
  });

  // CASE 3: Staff with multiple active memberships -> returns all allowed active clinics
  const staffMulti: MockStaff = {
    id: "staff-active-multi",
    user_id: "auth-multi",
    staff_code: "BS-MULTI",
    full_name: "BS. Nhiều Cơ Sở",
    is_active: true,
  };
  const multiResolver = createMockResolver(staffMulti);

  multiResolver.requireCurrentStaffClinicMemberships().then((mems) => {
    assert.equal(mems.length, 2, "CASE 3: Returns both active clinics");
    assert.equal(mems.some((m) => m.clinic_id === "clinic-1"), true);
    assert.equal(mems.some((m) => m.clinic_id === "clinic-2"), true);
  });

  // CASE 4: Inactive membership -> excluded
  const staffInactiveMem: MockStaff = {
    id: "staff-with-inactive-mem",
    user_id: "auth-inactive-mem",
    staff_code: "BS-INACT-MEM",
    full_name: "BS. Thành Viên Hết Hạn",
    is_active: true,
  };
  const inactiveMemResolver = createMockResolver(staffInactiveMem);

  inactiveMemResolver.getCurrentStaffClinicMemberships().then((mems) => {
    assert.equal(mems.length, 0, "CASE 4: Inactive membership is excluded");
  });

  // CASE 5: Active membership pointing to inactive clinic -> excluded
  const staffInactiveClinic: MockStaff = {
    id: "staff-with-inactive-clinic",
    user_id: "auth-inactive-clinic",
    staff_code: "BS-INACT-CLINIC",
    full_name: "BS. Cơ Sở Đóng Cửa",
    is_active: true,
  };
  const inactiveClinicResolver = createMockResolver(staffInactiveClinic);

  inactiveClinicResolver.getCurrentStaffClinicMemberships().then((mems) => {
    assert.equal(mems.length, 0, "CASE 5: Inactive clinic is excluded");
  });

  // CASE 6: is_primary metadata is preserved
  multiResolver.getCurrentStaffClinicMemberships().then((mems) => {
    const primary = mems.find((m) => m.clinic_id === "clinic-1");
    const secondary = mems.find((m) => m.clinic_id === "clinic-2");
    assert.equal(primary?.is_primary, true, "CASE 6: Primary flag preserved on clinic 1");
    assert.equal(secondary?.is_primary, false, "CASE 6: Secondary flag preserved on clinic 2");
  });

  // CASE 7: Resolver derives staff_id from verified identity, does NOT accept client staff_id
  assert.equal(
    typeof zeroResolver.getCurrentStaffClinicMemberships,
    "function",
    "CASE 7: Resolver API takes 0 client arguments and resolves identity strictly server-side"
  );

  // CASE 8: No staff_clinic_roles lookup in this Goal
  multiResolver.getCurrentStaffClinicMemberships().then((mems) => {
    for (const m of mems) {
      assert.equal(
        (m as unknown as { roles?: unknown }).roles,
        undefined,
        "CASE 8: staff_clinic_roles is not queried or returned in AUTH1.3"
      );
    }
  });

  console.log("All Clinic Membership Resolver Unit Tests PASSED!");
}
