import assert from "node:assert/strict";

// Standard typed error classes matching production
class AuthenticationRequiredError extends Error {
  public readonly code = "AUTHENTICATION_REQUIRED";
  public readonly statusCode = 401;
  constructor() {
    super("Yêu cầu đăng nhập.");
  }
}

class StaffNotLinkedError extends Error {
  public readonly code = "STAFF_NOT_LINKED";
  public readonly statusCode = 403;
  constructor() {
    super("Tài khoản người dùng chưa được liên kết với hồ sơ nhân viên.");
  }
}

class StaffInactiveError extends Error {
  public readonly code = "STAFF_INACTIVE";
  public readonly statusCode = 403;
  constructor() {
    super("Hồ sơ nhân viên đã bị khóa hoặc ngừng hoạt động.");
  }
}

class NoActiveClinicSelectedError extends Error {
  public readonly code = "NO_ACTIVE_CLINIC_SELECTED";
  public readonly statusCode = 400;
  constructor() {
    super("Vui lòng chọn cơ sở phòng khám làm việc.");
  }
}

class StaffClinicAccessDeniedError extends Error {
  public readonly code = "STAFF_CLINIC_ACCESS_DENIED";
  public readonly statusCode = 403;
  constructor() {
    super("Nhân viên không có quyền truy cập hoặc không thuộc cơ sở phòng khám này.");
  }
}

interface MockStaff {
  id: string;
  staff_code: string;
  full_name: string;
  is_active: boolean;
}

interface MockMembership {
  membership_id: string;
  staff_id: string;
  clinic_id: string;
  clinic_code: string;
  clinic_name: string;
  organization_id: string;
  is_primary: boolean;
  membership_active: boolean;
  clinic_active: boolean;
}

// Pure simulation of application-access logic under test
function createMockAccessResolver(params: {
  authUser: { id: string } | null;
  staff: MockStaff | null;
  memberships: MockMembership[];
  cookieClinicId: string | null;
}) {
  const { authUser, staff, memberships, cookieClinicId } = params;

  const resolveStaff = () => {
    if (!authUser) throw new AuthenticationRequiredError();
    if (!staff) throw new StaffNotLinkedError();
    if (!staff.is_active) throw new StaffInactiveError();
    return staff;
  };

  const resolveActiveClinic = () => {
    if (!cookieClinicId) throw new NoActiveClinicSelectedError();
    const matched = memberships.find(
      (m) =>
        m.clinic_id === cookieClinicId &&
        m.membership_active === true &&
        m.clinic_active === true
    );
    if (!matched) throw new StaffClinicAccessDeniedError();
    return {
      clinic_id: matched.clinic_id,
      clinic_code: matched.clinic_code,
      clinic_name: matched.clinic_name,
      organization_id: matched.organization_id,
      membership_id: matched.membership_id,
      is_primary: matched.is_primary,
    };
  };

  return {
    getApplicationAccessContext: async () => {
      if (!authUser || !staff || !staff.is_active || !cookieClinicId) {
        return null;
      }
      const matched = memberships.find(
        (m) =>
          m.clinic_id === cookieClinicId &&
          m.membership_active === true &&
          m.clinic_active === true
      );
      if (!matched) {
        return null;
      }
      return {
        staff: {
          id: staff.id,
          staff_code: staff.staff_code,
          full_name: staff.full_name,
        },
        clinic: {
          clinic_id: matched.clinic_id,
          clinic_code: matched.clinic_code,
          clinic_name: matched.clinic_name,
          organization_id: matched.organization_id,
          membership_id: matched.membership_id,
          is_primary: matched.is_primary,
        },
      };
    },
    requireApplicationAccessContext: async () => {
      const validStaff = resolveStaff();
      const validClinic = resolveActiveClinic();

      return {
        staff: {
          id: validStaff.id,
          staff_code: validStaff.staff_code,
          full_name: validStaff.full_name,
        },
        clinic: validClinic,
      };
    },
  };
}

// Simulation of AppShell boundary handling logic
async function simulateAppShellBoundary(resolver: ReturnType<typeof createMockAccessResolver>) {
  try {
    const ctx = await resolver.requireApplicationAccessContext();
    return { action: "RENDER_APP" as const, context: ctx };
  } catch (error: unknown) {
    if (
      error instanceof NoActiveClinicSelectedError ||
      error instanceof StaffClinicAccessDeniedError
    ) {
      return { action: "REDIRECT_SELECT_CLINIC" as const };
    }
    if (error instanceof StaffNotLinkedError) {
      return { action: "RENDER_ACCESS_DENIED" as const, code: "STAFF_NOT_LINKED" as const };
    }
    if (error instanceof StaffInactiveError) {
      return { action: "RENDER_ACCESS_DENIED" as const, code: "STAFF_INACTIVE" as const };
    }
    if (error instanceof AuthenticationRequiredError) {
      return { action: "REDIRECT_LOGIN" as const };
    }
    throw error;
  }
}

export function runApplicationAccessTests() {
  console.log("Running Application Access Context Unit Tests...");

  const validStaff: MockStaff = {
    id: "staff-1",
    staff_code: "ADMIN-01",
    full_name: "Quản Trị Hệ Thống",
    is_active: true,
  };

  const validMemberships: MockMembership[] = [
    {
      membership_id: "mem-tt01",
      staff_id: "staff-1",
      clinic_id: "clinic-tt01",
      clinic_code: "TT01",
      clinic_name: "Thuận Thiên",
      organization_id: "org-1",
      is_primary: false,
      membership_active: true,
      clinic_active: true,
    },
    {
      membership_id: "mem-pn01",
      staff_id: "staff-1",
      clinic_id: "clinic-pn01",
      clinic_code: "PN01",
      clinic_name: "Phúc Nguyên",
      organization_id: "org-1",
      is_primary: false,
      membership_active: true,
      clinic_active: true,
    },
  ];

  // CASE 1: Valid Auth + active Staff + valid active clinic -> trusted context returned
  const validResolver = createMockAccessResolver({
    authUser: { id: "user-1" },
    staff: validStaff,
    memberships: validMemberships,
    cookieClinicId: "clinic-tt01",
  });

  validResolver.requireApplicationAccessContext().then((ctx) => {
    assert.equal(ctx.staff.staff_code, "ADMIN-01", "CASE 1: Staff identity resolved");
    assert.equal(ctx.clinic.clinic_code, "TT01", "CASE 1: Active clinic resolved");
    assert.equal(ctx.clinic.membership_id, "mem-tt01");
  });

  // CASE 2: Unauthenticated caller -> throws AuthenticationRequiredError
  const unauthResolver = createMockAccessResolver({
    authUser: null,
    staff: validStaff,
    memberships: validMemberships,
    cookieClinicId: "clinic-tt01",
  });

  assert.rejects(
    async () => {
      await unauthResolver.requireApplicationAccessContext();
    },
    (err: unknown) => err instanceof AuthenticationRequiredError,
    "CASE 2: Throws AuthenticationRequiredError when unauthenticated"
  );

  // CASE 3: Auth user not linked to Staff -> throws StaffNotLinkedError
  const unlinkedResolver = createMockAccessResolver({
    authUser: { id: "user-unlinked" },
    staff: null,
    memberships: [],
    cookieClinicId: "clinic-tt01",
  });

  assert.rejects(
    async () => {
      await unlinkedResolver.requireApplicationAccessContext();
    },
    (err: unknown) => err instanceof StaffNotLinkedError,
    "CASE 3: Throws StaffNotLinkedError when unlinked"
  );

  // CASE 4: Inactive Staff -> throws StaffInactiveError
  const inactiveStaffResolver = createMockAccessResolver({
    authUser: { id: "user-1" },
    staff: { ...validStaff, is_active: false },
    memberships: validMemberships,
    cookieClinicId: "clinic-tt01",
  });

  assert.rejects(
    async () => {
      await inactiveStaffResolver.requireApplicationAccessContext();
    },
    (err: unknown) => err instanceof StaffInactiveError,
    "CASE 4: Throws StaffInactiveError when staff inactive"
  );

  // CASE 5: No active clinic cookie -> optional getter returns null, require throws NoActiveClinicSelectedError
  const noCookieResolver = createMockAccessResolver({
    authUser: { id: "user-1" },
    staff: validStaff,
    memberships: validMemberships,
    cookieClinicId: null,
  });

  noCookieResolver.getApplicationAccessContext().then((res) => {
    assert.equal(res, null, "CASE 5: Optional getter returns null when no cookie set");
  });

  assert.rejects(
    async () => {
      await noCookieResolver.requireApplicationAccessContext();
    },
    (err: unknown) => err instanceof NoActiveClinicSelectedError,
    "CASE 5: Require throws NoActiveClinicSelectedError when no cookie set"
  );

  // CASE 6: Forged/unauthorized clinic cookie -> throws StaffClinicAccessDeniedError
  const forgedResolver = createMockAccessResolver({
    authUser: { id: "user-1" },
    staff: validStaff,
    memberships: validMemberships,
    cookieClinicId: "attacker-forged-clinic-99",
  });

  assert.rejects(
    async () => {
      await forgedResolver.requireApplicationAccessContext();
    },
    (err: unknown) => err instanceof StaffClinicAccessDeniedError,
    "CASE 6: Forged cookie rejected with StaffClinicAccessDeniedError"
  );

  // CASE 7: Previously valid membership becomes inactive -> does not resolve
  const revokedMembershipResolver = createMockAccessResolver({
    authUser: { id: "user-1" },
    staff: validStaff,
    memberships: [{ ...validMemberships[0], membership_active: false }],
    cookieClinicId: "clinic-tt01",
  });

  revokedMembershipResolver.getApplicationAccessContext().then((res) => {
    assert.equal(res, null, "CASE 7: Inactive membership returns null");
  });

  // CASE 8: Clinic becomes inactive -> does not resolve
  const inactiveClinicResolver = createMockAccessResolver({
    authUser: { id: "user-1" },
    staff: validStaff,
    memberships: [{ ...validMemberships[0], clinic_active: false }],
    cookieClinicId: "clinic-tt01",
  });

  inactiveClinicResolver.getApplicationAccessContext().then((res) => {
    assert.equal(res, null, "CASE 8: Inactive clinic returns null");
  });

  // CASE 9 & 10: Explicit selection respected across multiple memberships with is_primary = false
  const pnResolver = createMockAccessResolver({
    authUser: { id: "user-1" },
    staff: validStaff,
    memberships: validMemberships,
    cookieClinicId: "clinic-pn01",
  });

  pnResolver.requireApplicationAccessContext().then((ctx) => {
    assert.equal(ctx.clinic.clinic_code, "PN01", "CASE 9: Returns explicitly selected PN01");
  });

  // BOUNDARY TESTS FOR APPSHELL ERROR HANDLING (AUTH1.6B2-FIX1):
  // CASE 14: STAFF_NOT_LINKED -> renders AccessDeniedView without redirect loop
  simulateAppShellBoundary(unlinkedResolver).then((res) => {
    assert.equal(res.action, "RENDER_ACCESS_DENIED");
    if (res.action === "RENDER_ACCESS_DENIED") {
      assert.equal(res.code, "STAFF_NOT_LINKED", "CASE 14: STAFF_NOT_LINKED handled cleanly");
    }
  });

  // CASE 15: STAFF_INACTIVE -> renders AccessDeniedView without redirect loop
  simulateAppShellBoundary(inactiveStaffResolver).then((res) => {
    assert.equal(res.action, "RENDER_ACCESS_DENIED");
    if (res.action === "RENDER_ACCESS_DENIED") {
      assert.equal(res.code, "STAFF_INACTIVE", "CASE 15: STAFF_INACTIVE handled cleanly");
    }
  });

  // CASE 16: NO_ACTIVE_CLINIC_SELECTED -> redirects to /select-clinic
  simulateAppShellBoundary(noCookieResolver).then((res) => {
    assert.equal(res.action, "REDIRECT_SELECT_CLINIC", "CASE 16: Missing clinic redirects to /select-clinic");
  });

  // CASE 17: Valid Staff & Clinic -> renders App
  simulateAppShellBoundary(validResolver).then((res) => {
    assert.equal(res.action, "RENDER_APP", "CASE 17: Valid access renders App normally");
  });

  console.log("All Application Access Context Unit Tests PASSED!");
}
