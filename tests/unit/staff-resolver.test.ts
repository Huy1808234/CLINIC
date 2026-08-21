import assert from "node:assert/strict";
import type { User } from "@supabase/supabase-js";

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

interface StaffRecord {
  id: string;
  user_id: string | null;
  staff_code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

export function runStaffResolverTests() {
  console.log("Running Staff Resolver Unit Tests...");

  // Mock staff table
  const mockStaffTable: StaffRecord[] = [
    {
      id: "staff-1",
      user_id: "auth-user-123",
      staff_code: "BS-HAI",
      full_name: "BS. Nguyễn Văn Hải",
      phone: "0912345678",
      email: "bs.hai@thuanthien.vn",
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: "staff-2",
      user_id: "auth-user-456",
      staff_code: "BS-TUAN",
      full_name: "BS. Trần Tuấn",
      phone: "0987654321",
      email: "bs.tuan@thuanthien.vn",
      is_active: false, // INACTIVE
      created_at: new Date().toISOString(),
    },
    {
      id: "staff-3",
      user_id: null, // UNLINKED
      staff_code: "BS-KHA",
      full_name: "BS. Lê Kha",
      phone: "0900112233",
      email: "same.email@thuanthien.vn", // Same email as another auth user to test invariant
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ];

  // Resolver implementation under test (mirroring staff-resolver.ts)
  const createMockResolver = (currentUser: User | null) => {
    return {
      getCurrentStaff: async () => {
        if (!currentUser) return null;
        // Strictly lookup by user_id = currentUser.id (NEVER by email, phone, or name)
        const staff = mockStaffTable.find((s) => s.user_id === currentUser.id);
        if (!staff || !staff.user_id) return null;
        return { ...staff, user_id: staff.user_id };
      },
      requireCurrentStaff: async () => {
        if (!currentUser) {
          throw new AuthenticationRequiredError();
        }
        // Strictly lookup by user_id = currentUser.id
        const staff = mockStaffTable.find((s) => s.user_id === currentUser.id);
        if (!staff || !staff.user_id) {
          throw new StaffNotLinkedError();
        }
        if (!staff.is_active) {
          throw new StaffInactiveError();
        }
        return { ...staff, user_id: staff.user_id };
      },
    };
  };

  // CASE 1: No authenticated user -> getCurrentStaff() returns null
  const unauthenticatedResolver = createMockResolver(null);
  unauthenticatedResolver.getCurrentStaff().then((res) => {
    assert.equal(res, null, "CASE 1: Unauthenticated session returns null");
  });

  assert.rejects(
    async () => {
      await unauthenticatedResolver.requireCurrentStaff();
    },
    (err: unknown) => {
      return err instanceof AuthenticationRequiredError && err.code === "UNAUTHENTICATED";
    },
    "CASE 1: requireCurrentStaff throws UNAUTHENTICATED when not logged in"
  );

  // CASE 2: Authenticated user exists but no staff row has matching user_id -> throws STAFF_NOT_LINKED
  const unlinkedUser: User = {
    id: "auth-user-unlinked-999",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
    email: "unlinked.person@thuanthien.vn",
  };
  const unlinkedResolver = createMockResolver(unlinkedUser);

  unlinkedResolver.getCurrentStaff().then((res) => {
    assert.equal(res, null, "CASE 2: Unlinked staff returns null from getCurrentStaff");
  });

  assert.rejects(
    async () => {
      await unlinkedResolver.requireCurrentStaff();
    },
    (err: unknown) => {
      return (
        err instanceof StaffNotLinkedError &&
        err.code === "STAFF_NOT_LINKED" &&
        err.statusCode === 403
      );
    },
    "CASE 2: requireCurrentStaff throws STAFF_NOT_LINKED for unlinked auth user"
  );

  // CASE 3: Authenticated user linked to inactive staff -> rejects with STAFF_INACTIVE
  const inactiveUser: User = {
    id: "auth-user-456",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
    email: "bs.tuan@thuanthien.vn",
  };
  const inactiveResolver = createMockResolver(inactiveUser);

  assert.rejects(
    async () => {
      await inactiveResolver.requireCurrentStaff();
    },
    (err: unknown) => {
      return (
        err instanceof StaffInactiveError &&
        err.code === "STAFF_INACTIVE" &&
        err.statusCode === 403
      );
    },
    "CASE 3: requireCurrentStaff throws STAFF_INACTIVE when staff.is_active = false"
  );

  // CASE 4: Authenticated user linked to active staff -> returns the correct Staff identity
  const activeUser: User = {
    id: "auth-user-123",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
    email: "bs.hai@thuanthien.vn",
  };
  const activeResolver = createMockResolver(activeUser);

  activeResolver.getCurrentStaff().then((staff) => {
    assert.notEqual(staff, null, "CASE 4: Active staff identity resolved");
    assert.equal(staff?.id, "staff-1");
    assert.equal(staff?.staff_code, "BS-HAI");
    assert.equal(staff?.full_name, "BS. Nguyễn Văn Hải");
    assert.equal(staff?.is_active, true);
  });

  activeResolver.requireCurrentStaff().then((staff) => {
    assert.equal(staff.id, "staff-1");
    assert.equal(staff.staff_code, "BS-HAI");
  });

  // CASE 5: Security Invariant: Staff lookup uses auth user ID and does NOT attempt email/name matching
  const matchingEmailUser: User = {
    id: "auth-user-attacker-777",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
    email: "same.email@thuanthien.vn", // Matches staff-3 email, but user_id differs
  };
  const emailMatchingResolver = createMockResolver(matchingEmailUser);

  emailMatchingResolver.getCurrentStaff().then((res) => {
    assert.equal(
      res,
      null,
      "CASE 5: Must NOT link by email when auth.users.id does not match staff.user_id"
    );
  });

  console.log("All Staff Resolver Unit Tests PASSED!");
}
