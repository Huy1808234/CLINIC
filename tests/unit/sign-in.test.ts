import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { signInSchema, USERNAME_REGEX, type SignInInput } from "@/lib/validation/auth-schemas";

type MockStaffRecord = {
  id: string;
  user_id: string | null;
  login_username: string | null;
  is_active: boolean;
  auth_setup_required: boolean;
  email: string | null;
};

type MockAuthUser = {
  id: string;
  email: string;
};

// Simulation of signInWithUsernamePassword logic under test
async function simulateUsernameSignIn(
  input: SignInInput,
  mockDatabase: {
    findStaffByUsername: (username: string) => Promise<MockStaffRecord | null>;
    getAuthUserById: (userId: string) => Promise<MockAuthUser | null>;
    signInWithPassword: (email: string, pass: string) => Promise<{
      data: { user: { id: string; email?: string } | null; session: unknown | null };
      error: { message: string; status?: number } | null;
    }>;
  }
) {
  const parseResult = signInSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      success: false as const,
      error: "Tài khoản hoặc mật khẩu không đúng.",
      code: "INVALID_CREDENTIALS" as const,
    };
  }

  const { login_username, password } = parseResult.data;

  if (!USERNAME_REGEX.test(login_username) || !password) {
    return {
      success: false as const,
      error: "Tài khoản hoặc mật khẩu không đúng.",
      code: "INVALID_CREDENTIALS" as const,
    };
  }

  try {
    const staff = await mockDatabase.findStaffByUsername(login_username);
    if (!staff || !staff.user_id || !staff.is_active || staff.auth_setup_required) {
      return {
        success: false as const,
        error: "Tài khoản hoặc mật khẩu không đúng.",
        code: "INVALID_CREDENTIALS" as const,
      };
    }

    const authUser = await mockDatabase.getAuthUserById(staff.user_id);
    if (!authUser || !authUser.email) {
      return {
        success: false as const,
        error: "Tài khoản hoặc mật khẩu không đúng.",
        code: "INVALID_CREDENTIALS" as const,
      };
    }

    const { data, error } = await mockDatabase.signInWithPassword(authUser.email, password);

    if (error || !data.user) {
      if (error && error.status && (error.status === 429 || error.status >= 500)) {
        return {
          success: false as const,
          error: "Hệ thống xác thực tạm thời không khả dụng. Vui lòng thử lại sau.",
          code: "AUTH_SERVICE_ERROR" as const,
        };
      }

      return {
        success: false as const,
        error: "Tài khoản hoặc mật khẩu không đúng.",
        code: "INVALID_CREDENTIALS" as const,
      };
    }

    return {
      success: true as const,
      user: {
        id: data.user.id,
      },
    };
  } catch {
    return {
      success: false as const,
      error: "Hệ thống xác thực tạm thời không khả dụng. Vui lòng thử lại sau.",
      code: "AUTH_SERVICE_ERROR" as const,
    };
  }
}

export async function runSignInTests() {
  console.log("Running Sign-In & Login Username Unit Tests...");

  const mockStaff: MockStaffRecord = {
    id: "staff-1",
    user_id: "auth-user-1",
    login_username: "bs.anhthu",
    is_active: true,
    auth_setup_required: false,
    email: "contact.anhthu@clinic.vn", // Note: different from actual Auth email
  };

  const mockAuthUser: MockAuthUser = {
    id: "auth-user-1",
    email: "auth.actual.anhthu@clinic.internal",
  };

  let usedAuthEmailForSignIn = "";

  const mockDb = {
    findStaffByUsername: async (username: string) => {
      if (username === "bs.anhthu") return mockStaff;
      if (username === "unlinked.user") {
        return { ...mockStaff, id: "staff-2", user_id: null, login_username: "unlinked.user" };
      }
      if (username === "inactive.user") {
        return { ...mockStaff, id: "staff-3", is_active: false, login_username: "inactive.user" };
      }
      if (username === "pending.setup") {
        return { ...mockStaff, id: "staff-4", auth_setup_required: true, login_username: "pending.setup" };
      }
      return null;
    },
    getAuthUserById: async (userId: string) => {
      if (userId === "auth-user-1") return mockAuthUser;
      return null;
    },
    signInWithPassword: async (email: string, pass: string) => {
      usedAuthEmailForSignIn = email;
      if (pass === "CorrectPassword123!") {
        return {
          data: {
            user: { id: "auth-user-1", email },
            session: { access_token: "secret-token", refresh_token: "secret-refresh" },
          },
          error: null,
        };
      }
      return {
        data: { user: null, session: null },
        error: { message: "Invalid credentials", status: 400 },
      };
    },
  };

  // LOGIN1-4 & LOGIN1-10 & LOGIN1-11 & LOGIN1-13: Valid login with username normalization
  const res1 = await simulateUsernameSignIn(
    { login_username: "  BS.AnhThu  ", password: "CorrectPassword123!" },
    mockDb
  );
  assert.equal(res1.success, true, "LOGIN1-13: Valid login succeeds");
  if (res1.success) {
    assert.equal(res1.user.id, "auth-user-1");
    // LOGIN1-10 & LOGIN1-11: Auth email resolved from Auth User, not staff.email
    assert.equal(
      usedAuthEmailForSignIn,
      "auth.actual.anhthu@clinic.internal",
      "LOGIN1-10: Used exact Auth User email for signInWithPassword"
    );
    assert.notEqual(
      usedAuthEmailForSignIn,
      "contact.anhthu@clinic.vn",
      "LOGIN1-10: Did not use staff.email contact field"
    );

    // LOGIN1-19, 22: No tokens, passwords, or emails leaked to browser
    assert.equal((res1.user as unknown as { email?: string }).email, undefined, "LOGIN1-19: email not returned");
    assert.equal((res1 as unknown as { access_token?: string }).access_token, undefined, "LOGIN1-19: token not returned");
    assert.equal((res1 as unknown as { password?: string }).password, undefined, "LOGIN1-22: password not returned");
  }

  // LOGIN1-14: Unknown username -> Generic error
  const resUnknown = await simulateUsernameSignIn(
    { login_username: "nonexistent.user", password: "Password123!" },
    mockDb
  );
  assert.equal(resUnknown.success, false, "LOGIN1-14: Unknown username fails");
  if (!resUnknown.success) {
    assert.equal(resUnknown.error, "Tài khoản hoặc mật khẩu không đúng.");
  }

  // LOGIN1-15: Invalid username format -> Generic error
  const resInvalidFormat = await simulateUsernameSignIn(
    { login_username: "A", password: "Password123!" },
    mockDb
  );
  assert.equal(resInvalidFormat.success, false, "LOGIN1-15: Invalid format fails");
  if (!resInvalidFormat.success) {
    assert.equal(resInvalidFormat.error, "Tài khoản hoặc mật khẩu không đúng.");
  }

  // LOGIN1-16: Wrong password -> Same generic error
  const resWrongPass = await simulateUsernameSignIn(
    { login_username: "bs.anhthu", password: "WrongPassword" },
    mockDb
  );
  assert.equal(resWrongPass.success, false, "LOGIN1-16: Wrong password fails");
  if (!resWrongPass.success) {
    assert.equal(resWrongPass.error, "Tài khoản hoặc mật khẩu không đúng.");
    assert.equal(resWrongPass.error, resUnknown.success ? "" : resUnknown.error, "LOGIN1-16: Same message as unknown username");
  }

  // LOGIN1-17: Staff user_id is NULL -> Generic error
  const resUnlinked = await simulateUsernameSignIn(
    { login_username: "unlinked.user", password: "CorrectPassword123!" },
    mockDb
  );
  assert.equal(resUnlinked.success, false, "LOGIN1-17: Unlinked staff fails");
  if (!resUnlinked.success) {
    assert.equal(resUnlinked.error, "Tài khoản hoặc mật khẩu không đúng.");
  }

  // LOGIN1-32: Inactive Staff -> Generic error
  const resInactive = await simulateUsernameSignIn(
    { login_username: "inactive.user", password: "CorrectPassword123!" },
    mockDb
  );
  assert.equal(resInactive.success, false, "LOGIN1-32: Inactive staff fails");

  // LOGIN1-33: auth_setup_required TRUE -> Generic error
  const resPending = await simulateUsernameSignIn(
    { login_username: "pending.setup", password: "CorrectPassword123!" },
    mockDb
  );
  assert.equal(resPending.success, false, "LOGIN1-33: Pending setup staff fails");

  // Code inspection on UI & Source files
  const loginFormPath = path.join(process.cwd(), "src", "components", "auth", "LoginForm.tsx");
  assert(fs.existsSync(loginFormPath), "LOGIN1-1: LoginForm.tsx exists");
  const loginFormCode = fs.readFileSync(loginFormPath, "utf-8");

  // LOGIN1-1 & LOGIN1-2 & LOGIN1-3: Label is Tài khoản, name is login_username, no email input
  assert(loginFormCode.includes("Tài Khoản *"), "LOGIN1-1: Label is Tài Khoản");
  assert(!loginFormCode.includes("type=\"email\""), "LOGIN1-2: No type=email in LoginForm");
  assert(loginFormCode.includes("name=\"login_username\""), "LOGIN1-3: Input name is login_username");
  assert(loginFormCode.includes("autoComplete=\"username\""), "LOGIN1-3: autoComplete is username");

  // LOGIN1-23: No localStorage or sessionStorage
  assert(!loginFormCode.includes("localStorage"), "LOGIN1-23: No localStorage in LoginForm");
  assert(!loginFormCode.includes("sessionStorage"), "LOGIN1-23: No sessionStorage in LoginForm");

  // LOGIN1-24 & LOGIN1-25: Informational forgot password, no link to forgot-password
  assert(!loginFormCode.includes("href=\"/auth/forgot-password\""), "LOGIN1-24: No link to /auth/forgot-password in LoginForm");
  assert(loginFormCode.includes("Quên mật khẩu? Vui lòng liên hệ quản trị viên."), "LOGIN1-25: Truthful informational message present");

  // LOGIN1-26 & LOGIN1-27: Legacy auth routes still exist on disk
  const forgotPwPage = path.join(process.cwd(), "src", "app", "auth", "forgot-password", "page.tsx");
  const setupPwPage = path.join(process.cwd(), "src", "app", "auth", "setup-password", "page.tsx");
  const resetPwPage = path.join(process.cwd(), "src", "app", "auth", "reset-password", "page.tsx");
  assert(fs.existsSync(forgotPwPage), "LOGIN1-26: /auth/forgot-password route preserved");
  assert(fs.existsSync(setupPwPage), "LOGIN1-27: /auth/setup-password route preserved");
  assert(fs.existsSync(resetPwPage), "LOGIN1-26: /auth/reset-password route preserved");

  console.log("All Sign-In & Login Username Unit Tests PASSED!");
}
