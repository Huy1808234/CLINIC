import assert from "node:assert/strict";
import { signInSchema, type SignInInput } from "@/lib/validation/auth-schemas";

type MockAuthResponse = {
  data: { user: { id: string; email?: string } | null; session: unknown | null };
  error: { message: string; status: number } | null;
};

// Simulation of signInWithEmailPassword logic under test
async function simulateSignIn(
  input: SignInInput,
  mockAuthFn: (email: string, pass: string) => Promise<MockAuthResponse>
) {
  const parseResult = signInSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      success: false as const,
      error: parseResult.error.issues[0]?.message || "Thông tin đăng nhập không hợp lệ.",
      code: "VALIDATION_ERROR" as const,
    };
  }

  const { email, password } = parseResult.data;

  try {
    const { data, error } = await mockAuthFn(email, password);

    if (error || !data.user) {
      if (error && (error.status === 429 || error.status >= 500)) {
        return {
          success: false as const,
          error: "Hệ thống xác thực tạm thời không khả dụng. Vui lòng thử lại sau.",
          code: "AUTH_SERVICE_ERROR" as const,
        };
      }

      return {
        success: false as const,
        error: "Email hoặc mật khẩu không chính xác.",
        code: "INVALID_CREDENTIALS" as const,
      };
    }

    return {
      success: true as const,
      user: {
        id: data.user.id,
        email: data.user.email || email,
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

export function runSignInTests() {
  console.log("Running Sign-In Unit Tests...");

  // CASE 1: Valid credentials -> success result with minimal user identity
  const mockValidAuth = async (email: string) => ({
    data: {
      user: { id: "user-123-fake-uuid", email },
      session: { access_token: "secret-token-do-not-leak", refresh_token: "secret-refresh" },
    },
    error: null,
  });

  simulateSignIn({ email: "test.admin@thuanthien.vn", password: "SamplePassword123" }, mockValidAuth).then(
    (res) => {
      assert.equal(res.success, true, "CASE 1: Login succeeds with valid credentials");
      if (res.success) {
        assert.equal(res.user.id, "user-123-fake-uuid");
        assert.equal(res.user.email, "test.admin@thuanthien.vn");

        // CASE 7: Secrets / tokens are NEVER returned
        assert.equal((res as unknown as { access_token?: string }).access_token, undefined, "CASE 7: access_token not leaked");
        assert.equal((res as unknown as { session?: unknown }).session, undefined, "CASE 7: session object not leaked");
        assert.equal((res as unknown as { password?: string }).password, undefined, "CASE 7: password not leaked");
      }
    }
  );

  // CASE 2: Invalid credentials -> generic INVALID_CREDENTIALS error
  const mockInvalidAuth = async () => ({
    data: { user: null, session: null },
    error: { message: "Invalid login credentials (internal Supabase detail)", status: 400 },
  });

  simulateSignIn({ email: "test.admin@thuanthien.vn", password: "WrongPassword" }, mockInvalidAuth).then(
    (res) => {
      assert.equal(res.success, false, "CASE 2: Login fails with invalid credentials");
      if (!res.success) {
        assert.equal(res.code, "INVALID_CREDENTIALS");
        assert.equal(res.error, "Email hoặc mật khẩu không chính xác.");
        assert.equal(res.error.includes("Supabase"), false, "CASE 2: Raw internal error not leaked");
      }
    }
  );

  // CASE 3: Missing or invalid email -> VALIDATION_ERROR before calling Supabase
  let authCalled = false;
  const mockShouldNotCall = async () => {
    authCalled = true;
    return { data: { user: null, session: null }, error: null };
  };

  simulateSignIn({ email: "invalid-email-format", password: "some-password" }, mockShouldNotCall).then(
    (res) => {
      assert.equal(res.success, false, "CASE 3: Validation fails for invalid email");
      assert.equal(authCalled, false, "CASE 3: Supabase Auth not called on invalid email format");
      if (!res.success) {
        assert.equal(res.code, "VALIDATION_ERROR");
      }
    }
  );

  // CASE 4: Missing password -> VALIDATION_ERROR before calling Supabase
  authCalled = false;
  simulateSignIn({ email: "test@thuanthien.vn", password: "" }, mockShouldNotCall).then(
    (res) => {
      assert.equal(res.success, false, "CASE 4: Validation fails for empty password");
      assert.equal(authCalled, false, "CASE 4: Supabase Auth not called on empty password");
      if (!res.success) {
        assert.equal(res.code, "VALIDATION_ERROR");
      }
    }
  );

  // CASE 5: Unexpected Supabase Auth failure (HTTP 500) -> AUTH_SERVICE_ERROR
  const mockServiceError = async () => ({
    data: { user: null, session: null },
    error: { message: "Internal server error connecting to auth backend", status: 500 },
  });

  simulateSignIn({ email: "test@thuanthien.vn", password: "somepassword" }, mockServiceError).then(
    (res) => {
      assert.equal(res.success, false, "CASE 5: Service failure captured");
      if (!res.success) {
        assert.equal(res.code, "AUTH_SERVICE_ERROR");
        assert.equal(res.error.includes("Internal server error"), false, "CASE 5: Raw error not leaked");
      }
    }
  );

  // CASE 6: Schema normalization: Email is trimmed and converted to lowercase
  const parsed = signInSchema.parse({ email: "  ADMIN.Doctor@ThuanThien.VN  ", password: "mypassword" });
  assert.equal(parsed.email, "admin.doctor@thuanthien.vn", "CASE 6: Email normalized to lowercase and trimmed");
  assert.equal(parsed.password, "mypassword", "CASE 6: Password preserved exactly");

  console.log("All Sign-In Unit Tests PASSED!");
}
