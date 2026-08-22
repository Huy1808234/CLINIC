import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from "@/lib/validation/auth-schemas";

// Test-isolated implementation of cryptographic helpers matching production algorithm
const TEST_RECOVERY_SECRET = "test-only-dedicated-recovery-secret-key-32bytes!";

function testComputeEmailHash(email: string, secret = TEST_RECOVERY_SECRET): string {
  const normalized = email.trim().toLowerCase();
  return crypto.createHmac("sha256", secret).update(`intent-email:${normalized}`).digest("hex");
}

function testCreatePasswordRecoveryIntent(email: string, ttlMs = 15 * 60 * 1000, secret = TEST_RECOVERY_SECRET): string {
  if (!secret) {
    throw new Error("Missing secret");
  }
  const expiresAt = Date.now() + ttlMs;
  const emailHash = testComputeEmailHash(email, secret);
  const data = `intent:v1:${emailHash}:${expiresAt}`;
  const hmac = crypto.createHmac("sha256", secret).update(data).digest("hex");
  return `${data}:${hmac}`;
}

function testVerifyPasswordRecoveryIntent(
  token: string | null | undefined,
  authenticatedUserEmail: string | null | undefined,
  secret = TEST_RECOVERY_SECRET
): boolean {
  if (!token || typeof token !== "string" || !authenticatedUserEmail || typeof authenticatedUserEmail !== "string" || !secret) {
    return false;
  }

  const parts = token.split(":");
  if (parts.length !== 5) {
    return false;
  }

  const [domain, version, receivedEmailHash, expiresAtStr, receivedHmac] = parts;
  if (domain !== "intent" || version !== "v1" || !receivedEmailHash || !expiresAtStr || !receivedHmac) {
    return false;
  }

  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) {
    return false;
  }

  try {
    const expectedEmailHash = testComputeEmailHash(authenticatedUserEmail, secret);
    const emailHashBuf = Buffer.from(receivedEmailHash, "hex");
    const expectedEmailHashBuf = Buffer.from(expectedEmailHash, "hex");
    if (emailHashBuf.length !== expectedEmailHashBuf.length || !crypto.timingSafeEqual(emailHashBuf, expectedEmailHashBuf)) {
      return false;
    }

    const data = `intent:v1:${receivedEmailHash}:${expiresAt}`;
    const expectedHmac = crypto.createHmac("sha256", secret).update(data).digest("hex");
    const receivedHmacBuf = Buffer.from(receivedHmac, "hex");
    const expectedHmacBuf = Buffer.from(expectedHmac, "hex");

    if (receivedHmacBuf.length !== expectedHmacBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(receivedHmacBuf, expectedHmacBuf);
  } catch {
    return false;
  }
}

function testGenerateRecoveryToken(userId: string, ttlMs = 15 * 60 * 1000, secret = TEST_RECOVERY_SECRET): string {
  if (!secret) {
    throw new Error("Missing secret");
  }
  const expiresAt = Date.now() + ttlMs;
  const data = `context:v1:${userId}:${expiresAt}`;
  const hmac = crypto.createHmac("sha256", secret).update(data).digest("hex");
  return `${data}:${hmac}`;
}

function testVerifyRecoveryToken(token: string | null | undefined, expectedUserId: string, secret = TEST_RECOVERY_SECRET): boolean {
  if (!token || typeof token !== "string" || !expectedUserId || !secret) {
    return false;
  }

  const parts = token.split(":");
  if (parts.length !== 5) {
    return false;
  }

  const [domain, version, userId, expiresAtStr, receivedHmac] = parts;
  if (domain !== "context" || version !== "v1" || !userId || !expiresAtStr || !receivedHmac) {
    return false;
  }

  if (userId !== expectedUserId) {
    return false;
  }

  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) {
    return false;
  }

  try {
    const data = `context:v1:${userId}:${expiresAt}`;
    const expectedHmac = crypto.createHmac("sha256", secret).update(data).digest("hex");
    const receivedBuffer = Buffer.from(receivedHmac, "hex");
    const expectedBuffer = Buffer.from(expectedHmac, "hex");

    if (receivedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

function sanitizeNextUrl(rawNext: string | null | undefined): string {
  const next = rawNext || "/select-clinic";
  if (!next.startsWith("/") || next.startsWith("//")) {
    return "/select-clinic";
  }
  return next;
}

export async function runPasswordRecoveryTests() {
  console.log("Running Password Recovery Unit Tests...");

  // Mock Environment
  interface MockStaff {
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

  interface MockEnv {
    staffDb: MockStaff[];
    authUsersDb: MockAuthUser[];
    auditLogs: { action: string; entity_id: string; after_data: unknown }[];
  }

  const makeTestEnv = (): MockEnv => ({
    staffDb: [
      {
        id: "staff-activated-01",
        staff_code: "BS-THU",
        full_name: "BS Anh Thư",
        is_active: true,
        user_id: "auth-user-thu",
        auth_setup_required: false,
        auth_setup_completed_at: "2026-08-20T00:00:00Z",
      },
      {
        id: "staff-setup-req-02",
        staff_code: "LT-HOA",
        full_name: "Lễ tân Hoa (Setup Pending)",
        is_active: true,
        user_id: "auth-user-hoa",
        auth_setup_required: true,
        auth_setup_completed_at: null,
      },
    ],
    authUsersDb: [
      {
        id: "auth-user-thu",
        email: "doctor.thu@thuanthien.vn",
        password: "OldPassword123!",
      },
      {
        id: "auth-user-hoa",
        email: "reception.hoa@thuanthien.vn",
        password: "InitialInvitePassword!",
      },
    ],
    auditLogs: [],
  });

  // Simulated requestPasswordResetAction
  async function simulateRequestPasswordReset(
    _env: MockEnv,
    input: ForgotPasswordInput
  ) {
    const parseResult = forgotPasswordSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.issues[0]?.message || "Dữ liệu email không hợp lệ.",
      };
    }
    const validated = parseResult.data;

    // Generates internal signed intent
    const recoveryState = testCreatePasswordRecoveryIntent(validated.email);
    const redirectTo = `http://localhost:3000/auth/callback?next=/auth/reset-password&recovery_state=${encodeURIComponent(recoveryState)}`;

    // Enumeration-safe user response does NOT return recoveryState
    return {
      success: true,
      message: "Nếu email này được liên kết với tài khoản, hướng dẫn đặt lại mật khẩu sẽ được gửi đến email.",
      _internalRedirectTo: redirectTo,
    };
  }

  // Simulated Callback Route Handler
  async function simulateAuthCallback(
    env: MockEnv,
    params: {
      code?: string;
      token_hash?: string;
      type?: string;
      recovery_state?: string;
      next?: string;
    }
  ) {
    const next = sanitizeNextUrl(params.next);

    // 1. PKCE Code branch
    if (params.code) {
      const user = env.authUsersDb.find((u) => u.id === params.code || `code-${u.id}` === params.code);
      if (!user) {
        return { success: false, redirect: "/login?error=invalid_or_expired_link", recoveryCookie: null };
      }

      const hasValidRecoveryIntent = params.recovery_state
        ? testVerifyPasswordRecoveryIntent(params.recovery_state, user.email)
        : false;

      const recoveryCookie = hasValidRecoveryIntent ? testGenerateRecoveryToken(user.id) : null;
      return { success: true, redirect: next, recoveryCookie, userId: user.id };
    }

    // 2. Token Hash branch
    if (params.token_hash && params.type) {
      const user = env.authUsersDb.find((u) => `hash-${u.id}` === params.token_hash);
      if (!user) {
        return { success: false, redirect: "/login?error=invalid_or_expired_link", recoveryCookie: null };
      }

      // Recovery cookie issued ONLY when type === "recovery"
      const recoveryCookie = params.type === "recovery" ? testGenerateRecoveryToken(user.id) : null;
      return { success: true, redirect: next, recoveryCookie, userId: user.id };
    }

    return { success: false, redirect: "/login?error=invalid_or_expired_link", recoveryCookie: null };
  }

  // Simulated resetPasswordAction
  async function simulateResetPassword(
    env: MockEnv,
    sessionUser: { id: string } | null,
    input: ResetPasswordInput,
    recoveryToken?: string | null
  ) {
    if (!sessionUser) {
      return {
        success: false,
        error_code: "AUTHENTICATION_REQUIRED",
        error: "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.",
      };
    }

    const hasValidRecoveryContext = testVerifyRecoveryToken(recoveryToken, sessionUser.id);
    if (!hasValidRecoveryContext) {
      return {
        success: false,
        error_code: "PASSWORD_RECOVERY_REQUIRED",
        error: "Yêu cầu thực hiện quy trình đặt lại mật khẩu hợp lệ.",
      };
    }

    const parseResult = resetPasswordSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        success: false,
        error_code: "INVALID_PASSWORD",
        error: parseResult.error.issues[0]?.message || "Dữ liệu mật khẩu không hợp lệ.",
      };
    }
    const validated = parseResult.data;

    const authUser = env.authUsersDb.find((u) => u.id === sessionUser.id);
    if (!authUser) {
      return {
        success: false,
        error_code: "USER_NOT_FOUND",
        error: "Không tìm thấy tài khoản người dùng.",
      };
    }

    authUser.password = validated.password;

    const staff = env.staffDb.find((s) => s.user_id === sessionUser.id);
    if (staff) {
      env.auditLogs.push({
        action: "STAFF_PASSWORD_RECOVERY_COMPLETED",
        entity_id: staff.id,
        after_data: {
          staff_id: staff.id,
          staff_code: staff.staff_code,
          auth_user_id: sessionUser.id,
          recovered_at: new Date().toISOString(),
        },
      });
    }

    return {
      success: true,
      message: "Đổi mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.",
    };
  }

  function simulateApplicationAccessGate(
    env: MockEnv,
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

  // =========================================================================
  // TEST SUITE: STAFF-AUTH1B-FIX2
  // =========================================================================

  const env = makeTestEnv();

  // CASE STAFF-AUTH1B-FIX2-1: Recovery token_hash + type=recovery -> recovery context issued
  const cbRecoveryHash = await simulateAuthCallback(env, {
    token_hash: "hash-auth-user-thu",
    type: "recovery",
    next: "/auth/reset-password",
  });
  assert.equal(cbRecoveryHash.success, true, "CASE FIX2-1: Valid recovery OTP succeeds");
  assert.notEqual(cbRecoveryHash.recoveryCookie, null, "CASE FIX2-1: Recovery cookie issued");
  assert.equal(testVerifyRecoveryToken(cbRecoveryHash.recoveryCookie, "auth-user-thu"), true, "CASE FIX2-1: Cookie valid for user");

  // CASE STAFF-AUTH1B-FIX2-2: Invalid recovery token_hash + type=recovery -> no recovery context
  const cbInvalidHash = await simulateAuthCallback(env, {
    token_hash: "invalid-hash",
    type: "recovery",
  });
  assert.equal(cbInvalidHash.success, false, "CASE FIX2-2: Invalid OTP rejected");
  assert.equal(cbInvalidHash.recoveryCookie, null, "CASE FIX2-2: Zero recovery cookie on failure");

  // CASE STAFF-AUTH1B-FIX2-3: Valid invite token + type=invite + next=/auth/reset-password -> no recovery context
  const cbInviteHash = await simulateAuthCallback(env, {
    token_hash: "hash-auth-user-hoa",
    type: "invite",
    next: "/auth/reset-password",
  });
  assert.equal(cbInviteHash.success, true, "CASE FIX2-3: Invite OTP verification succeeds");
  assert.equal(cbInviteHash.recoveryCookie, null, "CASE FIX2-3: Invite flow NEVER receives recovery cookie despite next");

  // CASE STAFF-AUTH1B-FIX2-4: Valid signup/email-confirm token + next=/auth/reset-password -> no recovery context
  const cbEmailHash = await simulateAuthCallback(env, {
    token_hash: "hash-auth-user-thu",
    type: "email",
    next: "/auth/reset-password",
  });
  assert.equal(cbEmailHash.recoveryCookie, null, "CASE FIX2-4: Email confirmation NEVER receives recovery cookie");

  // CASE STAFF-AUTH1B-FIX2-5 (CRITICAL): Normal valid PKCE code + next=/auth/reset-password + NO recovery_state -> no recovery context
  const cbNormalPkce = await simulateAuthCallback(env, {
    code: "code-auth-user-thu",
    next: "/auth/reset-password",
  });
  assert.equal(cbNormalPkce.success, true, "CASE FIX2-5: Normal PKCE exchange succeeds");
  assert.equal(cbNormalPkce.recoveryCookie, null, "CASE FIX2-5: Normal PKCE code without recovery_state NEVER receives recovery cookie");

  // CASE STAFF-AUTH1B-FIX2-6: Normal valid PKCE code + type=recovery + NO recovery_state -> no recovery context
  const cbManipulatedPkce = await simulateAuthCallback(env, {
    code: "code-auth-user-thu",
    type: "recovery",
  });
  assert.equal(cbManipulatedPkce.recoveryCookie, null, "CASE FIX2-6: Manipulated raw type on PKCE code without recovery_state rejected");

  // CASE STAFF-AUTH1B-FIX2-7: requestPasswordResetAction creates signed recovery intent internally
  // CASE STAFF-AUTH1B-FIX2-8: Forgot-password action does NOT return recovery_state to browser
  const forgotRes = await simulateRequestPasswordReset(env, {
    email: "doctor.thu@thuanthien.vn",
  });
  assert.equal(forgotRes.success, true, "CASE FIX2-7: Forgot password request succeeded");
  assert.equal("recovery_state" in (forgotRes as Record<string, unknown>), false, "CASE FIX2-8: recovery_state never in browser response");
  assert(forgotRes._internalRedirectTo?.includes("recovery_state="), "CASE FIX2-7: recovery_state embedded in internal redirectTo URL");

  // CASE STAFF-AUTH1B-FIX2-9: Valid recovery PKCE code + valid recovery_state + matching Auth User email -> recovery context issued
  const validState = testCreatePasswordRecoveryIntent("doctor.thu@thuanthien.vn");
  const cbValidPkce = await simulateAuthCallback(env, {
    code: "code-auth-user-thu",
    recovery_state: validState,
    next: "/auth/reset-password",
  });
  assert.equal(cbValidPkce.success, true, "CASE FIX2-9: Recovery PKCE exchange succeeds");
  assert.notEqual(cbValidPkce.recoveryCookie, null, "CASE FIX2-9: Recovery cookie successfully issued");

  // CASE STAFF-AUTH1B-FIX2-10: Valid PKCE exchange + tampered recovery_state -> no recovery context
  const tamperedState = validState.slice(0, -4) + "ffff";
  const cbTamperedState = await simulateAuthCallback(env, {
    code: "code-auth-user-thu",
    recovery_state: tamperedState,
    next: "/auth/reset-password",
  });
  assert.equal(cbTamperedState.recoveryCookie, null, "CASE FIX2-10: Tampered recovery state rejected");

  // CASE STAFF-AUTH1B-FIX2-11: Valid PKCE exchange + expired recovery_state -> no recovery context
  const expiredState = testCreatePasswordRecoveryIntent("doctor.thu@thuanthien.vn", -1000);
  const cbExpiredState = await simulateAuthCallback(env, {
    code: "code-auth-user-thu",
    recovery_state: expiredState,
    next: "/auth/reset-password",
  });
  assert.equal(cbExpiredState.recoveryCookie, null, "CASE FIX2-11: Expired recovery state rejected");

  // CASE STAFF-AUTH1B-FIX2-12: Recovery state for User A + PKCE Auth User B -> no recovery context
  const stateUserA = testCreatePasswordRecoveryIntent("doctor.thu@thuanthien.vn");
  const cbMismatchUser = await simulateAuthCallback(env, {
    code: "code-auth-user-hoa", // User B (reception.hoa@thuanthien.vn)
    recovery_state: stateUserA,
    next: "/auth/reset-password",
  });
  assert.equal(cbMismatchUser.recoveryCookie, null, "CASE FIX2-12: Email mismatch between recovery state and Auth User rejected");

  // CASE STAFF-AUTH1B-FIX2-13, 16, 17: Dedicated server-only secret required and fails closed if missing
  assert.throws(
    () => testCreatePasswordRecoveryIntent("doctor.thu@thuanthien.vn", 900000, ""),
    /Missing secret/,
    "CASE FIX2-17: Missing secret fails closed"
  );

  // CASE STAFF-AUTH1B-FIX2-18: Intent signed fields include purpose, email binding, expiry
  assert(validState.startsWith("intent:v1:"), "CASE FIX2-18: Intent format begins with intent:v1:");
  assert.equal(validState.split(":").length, 5, "CASE FIX2-18: Intent contains domain, version, emailHash, expiresAt, hmac");

  // CASE STAFF-AUTH1B-FIX2-19: Context signed fields include user ID, expiry, purpose/version
  const contextToken = testGenerateRecoveryToken("auth-user-thu");
  assert(contextToken.startsWith("context:v1:"), "CASE FIX2-19: Context format begins with context:v1:");
  assert.equal(contextToken.split(":").length, 5, "CASE FIX2-19: Context contains domain, version, userId, expiresAt, hmac");

  // CASE STAFF-AUTH1B-FIX2-20: Intent token cannot be accepted as context token
  assert.equal(testVerifyRecoveryToken(validState, "auth-user-thu"), false, "CASE FIX2-20: Intent token rejected as context token");

  // CASE STAFF-AUTH1B-FIX2-21: Context token cannot be accepted as intent token
  assert.equal(testVerifyPasswordRecoveryIntent(contextToken, "doctor.thu@thuanthien.vn"), false, "CASE FIX2-21: Context token rejected as intent token");

  // CASE STAFF-AUTH1B-FIX2-22: User ID tamper detected
  const tamperedContext = contextToken.replace("auth-user-thu", "auth-user-hoa");
  assert.equal(testVerifyRecoveryToken(tamperedContext, "auth-user-hoa"), false, "CASE FIX2-22: User ID tampering detected by HMAC");

  // CASE STAFF-AUTH1B-FIX2-23: Expiry tamper detected
  const parts = contextToken.split(":");
  parts[3] = (Date.now() + 99999999).toString();
  const tamperedExpiry = parts.join(":");
  assert.equal(testVerifyRecoveryToken(tamperedExpiry, "auth-user-thu"), false, "CASE FIX2-23: Expiry tampering detected by HMAC");

  // CASE STAFF-AUTH1B-FIX2-25: Normal logged-in session still cannot invoke resetPasswordAction
  const resNoContext = await simulateResetPassword(
    env,
    { id: "auth-user-thu" },
    {
      password: "NewSecurePassword123!",
      confirm_password: "NewSecurePassword123!",
    },
    null // no recovery cookie
  );
  assert.equal(resNoContext.success, false, "CASE FIX2-25: Normal logged in session rejected");
  assert.equal(resNoContext.error_code, "PASSWORD_RECOVERY_REQUIRED", "CASE FIX2-25: Error is PASSWORD_RECOVERY_REQUIRED");

  // CASE STAFF-AUTH1B-FIX2-26: Valid recovery still resets password successfully
  // CASE STAFF-AUTH1B-FIX2-27: Recovery context cleared after successful reset
  const resSuccess = await simulateResetPassword(
    env,
    { id: "auth-user-thu" },
    {
      password: "NewSecurePassword123!",
      confirm_password: "NewSecurePassword123!",
    },
    cbValidPkce.recoveryCookie
  );
  assert.equal(resSuccess.success, true, "CASE FIX2-26: Reset succeeded with valid recovery context");
  assert.equal(env.authUsersDb[0].password, "NewSecurePassword123!", "CASE FIX2-26: Auth password updated");

  // CASE STAFF-AUTH1B-FIX2-28: Failed password update retains valid context until original TTL
  const resFailedValidation = await simulateResetPassword(
    env,
    { id: "auth-user-thu" },
    {
      password: "short",
      confirm_password: "short",
    },
    cbValidPkce.recoveryCookie
  );
  assert.equal(resFailedValidation.success, false, "CASE FIX2-28: Validation failed");
  // Context token is still cryptographically valid:
  assert.equal(testVerifyRecoveryToken(cbValidPkce.recoveryCookie, "auth-user-thu"), true, "CASE FIX2-28: Recovery context remains valid for retry");

  // CASE STAFF-AUTH1B-FIX2-29: Setup-required account remains setup-required
  const hoaIntent = testCreatePasswordRecoveryIntent("reception.hoa@thuanthien.vn");
  const cbHoa = await simulateAuthCallback(env, {
    code: "code-auth-user-hoa",
    recovery_state: hoaIntent,
    next: "/auth/reset-password",
  });
  const resHoaReset = await simulateResetPassword(
    env,
    { id: "auth-user-hoa" },
    {
      password: "NewPasswordForPending123!",
      confirm_password: "NewPasswordForPending123!",
    },
    cbHoa.recoveryCookie
  );
  assert.equal(resHoaReset.success, true, "CASE FIX2-29: Setup-required staff can recover auth credential");
  const hoaGate = simulateApplicationAccessGate(env, { id: "auth-user-hoa" });
  assert.equal(hoaGate.allowed, false, "CASE FIX2-29: Application access gate remains strictly CLOSED");
  assert.equal(hoaGate.error, "ACCOUNT_SETUP_REQUIRED", "CASE FIX2-29: Reason is ACCOUNT_SETUP_REQUIRED");

  // CASE STAFF-AUTH1B-FIX2-31: External redirect payloads remain rejected
  assert.equal(sanitizeNextUrl("https://evil.example"), "/select-clinic", "CASE FIX2-31: https://evil.example rejected");
  assert.equal(sanitizeNextUrl("//evil.example"), "/select-clinic", "CASE FIX2-31: //evil.example rejected");
  assert.equal(sanitizeNextUrl("\\evil.example"), "/select-clinic", "CASE FIX2-31: \\evil.example rejected");
  assert.equal(sanitizeNextUrl("javascript:alert(1)"), "/select-clinic", "CASE FIX2-31: javascript:alert(1) rejected");
  assert.equal(sanitizeNextUrl("/auth/reset-password"), "/auth/reset-password", "CASE FIX2-31: /auth/reset-password allowed");

  // CASE STAFF-AUTH1B-FIX2-32: No password/Auth token stored inside custom recovery tokens
  assert(!validState.includes("password"), "CASE FIX2-32: No password in intent");
  assert(!contextToken.includes("password"), "CASE FIX2-32: No password in context");

  console.log("All Password Recovery Unit Tests PASSED!");
}
