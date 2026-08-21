import "server-only";
import { createClient } from "@/supabase-clients/server";
import { signInSchema, type SignInInput } from "@/lib/validation/auth-schemas";

export type SignInResult =
  | {
      success: true;
      user: {
        id: string;
        email: string;
      };
    }
  | {
      success: false;
      error: string;
      code: "INVALID_CREDENTIALS" | "VALIDATION_ERROR" | "AUTH_SERVICE_ERROR";
    };

/**
 * Signs in a user with email and password via Supabase Auth.
 *
 * Uses the Supabase SSR server client to establish session cookies automatically.
 * Returns only minimal user identity (id, email) and never exposes tokens, session
 * internals, or submitted passwords.
 *
 * @param input Email and password object.
 * @returns Typed `SignInResult`.
 */
export async function signInWithEmailPassword(input: SignInInput): Promise<SignInResult> {
  const parseResult = signInSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues[0]?.message || "Thông tin đăng nhập không hợp lệ.",
      code: "VALIDATION_ERROR",
    };
  }

  const { email, password } = parseResult.data;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      // Distinguish rate-limits or infrastructure downtime from invalid credentials
      const status = error && "status" in error && typeof error.status === "number" ? error.status : undefined;
      if (status !== undefined && (status === 429 || status >= 500)) {
        console.error("Supabase auth service error:", error?.message);
        return {
          success: false,
          error: "Hệ thống xác thực tạm thời không khả dụng. Vui lòng thử lại sau.",
          code: "AUTH_SERVICE_ERROR",
        };
      }

      // Generic error message for all credential mismatches
      return {
        success: false,
        error: "Email hoặc mật khẩu không chính xác.",
        code: "INVALID_CREDENTIALS",
      };
    }

    return {
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email || email,
      },
    };
  } catch (err: unknown) {
    console.error("Unexpected error during signInWithEmailPassword:", err);
    return {
      success: false,
      error: "Hệ thống xác thực tạm thời không khả dụng. Vui lòng thử lại sau.",
      code: "AUTH_SERVICE_ERROR",
    };
  }
}
