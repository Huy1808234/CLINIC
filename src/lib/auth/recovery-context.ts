import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export const RECOVERY_CONTEXT_COOKIE_NAME = "tt_recovery_context";
export const RECOVERY_CONTEXT_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const RECOVERY_INTENT_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Standard typed application error when an operation requires an active, verified
 * password-recovery context, but none is present or it is invalid/expired.
 */
export class PasswordRecoveryRequiredError extends Error {
  public readonly code = "PASSWORD_RECOVERY_REQUIRED";
  public readonly statusCode = 403;

  constructor(message = "Yêu cầu thực hiện quy trình đặt lại mật khẩu hợp lệ.") {
    super(message);
    this.name = "PasswordRecoveryRequiredError";
    Object.setPrototypeOf(this, PasswordRecoveryRequiredError.prototype);
  }
}

/**
 * Retrieves the dedicated server-only recovery signing secret.
 * Fails closed if the secret is missing. Zero public or hardcoded fallbacks.
 */
function getRecoverySecret(): string {
  const secret = process.env.RECOVERY_CONTEXT_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      "Server configuration error: RECOVERY_CONTEXT_SECRET is missing or empty."
    );
  }
  return secret.trim();
}

/**
 * Computes a canonical HMAC digest of a normalized email address.
 */
function computeEmailHash(email: string, secret: string): string {
  const normalized = email.trim().toLowerCase();
  return crypto.createHmac("sha256", secret).update(`intent-email:${normalized}`).digest("hex");
}

/**
 * Creates a signed password recovery intent bound to the requester's normalized email.
 * This intent travels in the server-generated Supabase `redirectTo` URL.
 */
export function createPasswordRecoveryIntent(email: string, ttlMs = RECOVERY_INTENT_TTL_MS): string {
  const secret = getRecoverySecret();
  const expiresAt = Date.now() + ttlMs;
  const emailHash = computeEmailHash(email, secret);
  const data = `intent:v1:${emailHash}:${expiresAt}`;
  const hmac = crypto.createHmac("sha256", secret).update(data).digest("hex");
  return `${data}:${hmac}`;
}

/**
 * Verifies that a recovery intent token is authentic, unexpired, and matches the authenticated user's email.
 */
export function verifyPasswordRecoveryIntent(
  token: string | null | undefined,
  authenticatedUserEmail: string | null | undefined
): boolean {
  if (!token || typeof token !== "string" || !authenticatedUserEmail || typeof authenticatedUserEmail !== "string") {
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
    const secret = getRecoverySecret();
    const expectedEmailHash = computeEmailHash(authenticatedUserEmail, secret);

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

/**
 * Generates an HMAC-signed recovery context token bound to a specific Supabase Auth User ID.
 */
export function generateRecoveryToken(userId: string, ttlMs = RECOVERY_CONTEXT_TTL_MS): string {
  const secret = getRecoverySecret();
  const expiresAt = Date.now() + ttlMs;
  const data = `context:v1:${userId}:${expiresAt}`;
  const hmac = crypto.createHmac("sha256", secret).update(data).digest("hex");
  return `${data}:${hmac}`;
}

/**
 * Verifies that the recovery token is authentic, unexpired, and matches the expected Auth User ID.
 */
export function verifyRecoveryToken(token: string | null | undefined, expectedUserId: string): boolean {
  if (!token || typeof token !== "string" || !expectedUserId) {
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
    const secret = getRecoverySecret();
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

/**
 * Attaches the recovery context cookie to a NextResponse (used in route handlers such as /auth/callback).
 */
export function attachRecoveryCookieToResponse(
  response: NextResponse,
  userId: string,
  ttlMs = RECOVERY_CONTEXT_TTL_MS
): void {
  const token = generateRecoveryToken(userId, ttlMs);
  response.cookies.set({
    name: RECOVERY_CONTEXT_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ttlMs / 1000),
  });
}

/**
 * Verifies whether the incoming cookie store contains a valid recovery context for the given user.
 */
export async function verifyRecoveryContextCookie(userId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(RECOVERY_CONTEXT_COOKIE_NAME)?.value;
  return verifyRecoveryToken(token, userId);
}

/**
 * Enforces that the caller has a valid recovery context cookie matching the given user ID.
 * Throws `PasswordRecoveryRequiredError` if missing, invalid, or expired.
 */
export async function requireValidRecoveryContext(userId: string): Promise<void> {
  const isValid = await verifyRecoveryContextCookie(userId);
  if (!isValid) {
    throw new PasswordRecoveryRequiredError();
  }
}

/**
 * Clears/consumes the recovery context cookie.
 */
export async function clearRecoveryContextCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: RECOVERY_CONTEXT_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
