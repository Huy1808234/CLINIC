import "server-only";
import { createClient } from "@/supabase-clients/server";
import type { User } from "@supabase/supabase-js";

/**
 * Standard typed application error when an unauthenticated caller attempts
 * an operation that requires a valid authenticated session.
 */
export class AuthenticationRequiredError extends Error {
  public readonly code = "UNAUTHENTICATED";
  public readonly statusCode = 401;

  constructor(message = "Yêu cầu đăng nhập để truy cập tài nguyên này.") {
    super(message);
    this.name = "AuthenticationRequiredError";
    Object.setPrototypeOf(this, AuthenticationRequiredError.prototype);
  }
}

/**
 * Resolves the currently authenticated Supabase user on the server.
 *
 * Uses the standard Supabase server client (scoped to caller's cookies) and
 * verifies the JWT against the Supabase Auth server using `getUser()`.
 *
 * @returns The authenticated Supabase `User` or `null` if unauthenticated.
 */
export async function getCurrentAuthUser(): Promise<User | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  } catch (err: unknown) {
    // If the error is an unexpected infrastructure/connection issue, log it and return null safely
    console.error("Failed to resolve authenticated auth user:", err);
    return null;
  }
}

/**
 * Requires a valid authenticated Supabase user on the server.
 *
 * Throws a typed `AuthenticationRequiredError` if no valid user session is present.
 *
 * @returns The authenticated Supabase `User`.
 * @throws `AuthenticationRequiredError` if unauthenticated.
 */
export async function requireAuthenticatedUser(): Promise<User> {
  const user = await getCurrentAuthUser();

  if (!user) {
    throw new AuthenticationRequiredError();
  }

  return user;
}
