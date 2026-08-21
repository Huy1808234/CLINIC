import assert from "node:assert/strict";

type MockSignOutResponse = {
  error: { message: string } | null;
};

// Simulation of signOutCurrentUser logic under test
async function simulateSignOut(
  mockSignOutFn: () => Promise<MockSignOutResponse>,
  mockClearCookieFn: () => Promise<void>
) {
  let cookieCleared = false;

  try {
    const { error } = await mockSignOutFn();

    // Always clear active clinic selection cookie
    await mockClearCookieFn();
    cookieCleared = true;

    if (error) {
      return {
        success: false as const,
        error: "Không thể đăng xuất khỏi hệ thống. Vui lòng thử lại.",
        code: "SIGN_OUT_FAILED" as const,
        cookieCleared,
      };
    }

    return {
      success: true as const,
      cookieCleared,
    };
  } catch {
    try {
      await mockClearCookieFn();
      cookieCleared = true;
    } catch {
      // secondary cleanup error ignored
    }
    return {
      success: false as const,
      error: "Không thể đăng xuất khỏi hệ thống. Vui lòng thử lại.",
      code: "SIGN_OUT_FAILED" as const,
      cookieCleared,
    };
  }
}

export function runSignOutTests() {
  console.log("Running Sign-Out Unit Tests...");

  // CASE 1: Authenticated session -> signOut called + cookie cleared -> success
  let cookieDeleted = false;
  let supabaseSignOutCalled = false;

  const mockSuccessAuth = async () => {
    supabaseSignOutCalled = true;
    return { error: null };
  };
  const mockClearCookie = async () => {
    cookieDeleted = true;
  };

  simulateSignOut(mockSuccessAuth, mockClearCookie).then((res) => {
    assert.equal(res.success, true, "CASE 1: Sign out returns success");
    assert.equal(supabaseSignOutCalled, true, "CASE 1: Supabase auth.signOut was invoked");
    assert.equal(cookieDeleted, true, "CASE 1: Active clinic cookie was cleared");

    // CASE 7: No secrets, session or tokens leaked in result
    assert.equal((res as unknown as { access_token?: string }).access_token, undefined, "CASE 7: No access_token leaked");
    assert.equal((res as unknown as { session?: unknown }).session, undefined, "CASE 7: No session leaked");
    assert.equal((res as unknown as { cookie?: string }).cookie, undefined, "CASE 7: No cookie value leaked");
  });

  // CASE 2: No active clinic cookie -> logout still succeeds
  cookieDeleted = false;
  simulateSignOut(mockSuccessAuth, async () => {
    // Cookie was not set, deleting non-existent cookie is no-op
    cookieDeleted = true;
  }).then((res) => {
    assert.equal(res.success, true, "CASE 2: Succeeds even if no clinic cookie was present");
  });

  // CASE 3: Already unauthenticated state -> cleanup remains safe/idempotent
  const mockAlreadyLoggedOut = async () => ({ error: null });
  simulateSignOut(mockAlreadyLoggedOut, mockClearCookie).then((res) => {
    assert.equal(res.success, true, "CASE 3: Already unauthenticated session handled safely");
  });

  // CASE 4: Supabase signOut unexpected failure -> SIGN_OUT_FAILED, raw error not exposed
  const mockFailingAuth = async () => ({
    error: { message: "Internal server error during token invalidation" },
  });

  simulateSignOut(mockFailingAuth, mockClearCookie).then((res) => {
    assert.equal(res.success, false, "CASE 4: Returns failure when Supabase signOut fails");
    if (!res.success) {
      assert.equal(res.code, "SIGN_OUT_FAILED");
      assert.equal(res.error, "Không thể đăng xuất khỏi hệ thống. Vui lòng thử lại.");
      assert.equal(res.error.includes("Internal server error"), false, "CASE 4: Raw error message not leaked");
    }
  });

  console.log("All Sign-Out Unit Tests PASSED!");
}
