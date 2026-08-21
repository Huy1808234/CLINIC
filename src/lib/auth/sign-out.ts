import "server-only";
import { createClient } from "@/supabase-clients/server";
import { clearActiveClinicCookie } from "./clinic-context";

export type SignOutResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
      code: "SIGN_OUT_FAILED";
    };

/**
 * Signs out the currently authenticated user and clears the active clinic session cookie.
 *
 * Cleanup Behavior:
 * 1. Invokes Supabase Auth `signOut()` on the SSR server client.
 * 2. Clears the `tt_active_clinic_id` cookie via existing `clearActiveClinicCookie()`.
 * 3. Does NOT perform any UI redirect or navigation.
 *
 * @returns Typed `SignOutResult`.
 */
export async function signOutCurrentUser(): Promise<SignOutResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();

    // Always clear the active clinic selection cookie even if Supabase session was already cleared/expired
    await clearActiveClinicCookie();

    if (error) {
      console.error("Supabase signOut error:", error.message);
      return {
        success: false,
        error: "Không thể đăng xuất khỏi hệ thống. Vui lòng thử lại.",
        code: "SIGN_OUT_FAILED",
      };
    }

    return { success: true };
  } catch (err: unknown) {
    console.error("Unexpected error during signOutCurrentUser:", err);
    try {
      await clearActiveClinicCookie();
    } catch {
      // Ignore secondary cookie cleanup error
    }
    return {
      success: false,
      error: "Không thể đăng xuất khỏi hệ thống. Vui lòng thử lại.",
      code: "SIGN_OUT_FAILED",
    };
  }
}
