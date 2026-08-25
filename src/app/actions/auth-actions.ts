"use server";

import { signInWithUsernamePassword, type SignInResult } from "@/lib/auth/sign-in";
import { signOutCurrentUser, type SignOutResult } from "@/lib/auth/sign-out";
import {
  setActiveClinicCookie,
  clearActiveClinicCookie,
  type ActiveClinicIdentity,
} from "@/lib/auth/clinic-context";
import { requireAuthenticatedUser } from "@/lib/auth/auth-resolver";
import { createClient } from "@/supabase-clients/server";
import { createAdminClient } from "@/supabase-clients/admin";
import { completeStaffAuthSetup } from "@/lib/staff/staff-auth-service";
import {
  setupStaffPasswordSchema,
  type SetupStaffPasswordInput,
} from "@/lib/validation/staff-schemas";
import {
  type SignInInput,
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from "@/lib/validation/auth-schemas";
import { AuthenticationRequiredError } from "@/lib/auth/auth-resolver";
import { ZodError } from "zod";

/**
 * Server Action for Staff username/password authentication.
 * Delegates to the centralized signInWithUsernamePassword resolver.
 *
 * @param input Username and password.
 * @returns Typed `SignInResult`.
 */
export async function signInAction(input: SignInInput): Promise<SignInResult> {
  return await signInWithUsernamePassword(input);
}

/**
 * Server Action to log out the current user and clear the active clinic context.
 *
 * @returns Typed `SignOutResult`.
 */
export async function signOutAction(): Promise<SignOutResult> {
  return await signOutCurrentUser();
}

export type SetActiveClinicResult =
  | {
      success: true;
      data: ActiveClinicIdentity;
    }
  | {
      success: false;
      error: string;
    };

/**
 * Server Action to set the active clinic selection for the session.
 *
 * @param clinicId Target clinic UUID.
 * @returns Typed `SetActiveClinicResult`.
 */
export async function setActiveClinicAction(clinicId: string): Promise<SetActiveClinicResult> {
  try {
    const clinic = await setActiveClinicCookie(clinicId);
    return { success: true, data: clinic };
  } catch (err: unknown) {
    return {
      success: false,
      error: (err as Error).message || "Không thể thiết lập cơ sở làm việc.",
    };
  }
}

/**
 * Server Action to clear the active clinic selection cookie.
 */
export async function clearActiveClinicAction(): Promise<{ success: true }> {
  await clearActiveClinicCookie();
  return { success: true };
}

/**
 * Server Action for an authenticated staff member to establish their own initial password.
 *
 * Sequence & Safety Invariants:
 * 1. Requires authenticated Supabase session.
 * 2. Validates input password & confirm_password.
 * 3. Updates Supabase Auth password via user session (`supabase.auth.updateUser({ password })`).
 * 4. Only after Auth update succeeds: calls atomic completion RPC (`completeStaffAuthSetup`).
 * 5. If Step 4 fails: auth_setup_required remains TRUE, keeping the account safely gated.
 */
export async function setupStaffPasswordAction(input: SetupStaffPasswordInput) {
  try {
    const validated = setupStaffPasswordSchema.parse(input);
    const authUser = await requireAuthenticatedUser();

    // 1. Update password in Supabase Auth using the user's session client
    const supabase = await createClient();
    const { error: authErr } = await supabase.auth.updateUser({
      password: validated.password,
    });

    if (authErr) {
      return {
        success: false,
        error: authErr.message || "Lỗi cập nhật mật khẩu trong hệ thống xác thực.",
      };
    }

    // 2. Mark setup completed atomically via service role RPC
    const adminSupabase = createAdminClient();
    await completeStaffAuthSetup(adminSupabase, authUser.id);

    return {
      success: true,
      message: "Thiết lập mật khẩu thành công. Bạn có thể bắt đầu sử dụng hệ thống.",
    };
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Dữ liệu mật khẩu không hợp lệ.",
      };
    }
    return {
      success: false,
      error: (error as Error).message || "Lỗi hoàn tất thiết lập mật khẩu.",
    };
  }
}

import {
  createPasswordRecoveryIntent,
  requireValidRecoveryContext,
  clearRecoveryContextCookie,
  PasswordRecoveryRequiredError,
} from "@/lib/auth/recovery-context";

/**
 * Server Action to request a password recovery link.
 *
 * Security Invariants:
 * 1. Enumeration-safe: always returns generic success message regardless of whether email exists.
 * 2. Creates a server-signed, account-bound, expiring recovery intent (recovery_state) embedded in redirectTo.
 * 3. Does NOT return recovery_state to the browser.
 * 4. Does NOT use service_role.
 * 5. Relies on Supabase Auth resetPasswordForEmail with site callback.
 */
export async function requestPasswordResetAction(input: ForgotPasswordInput) {
  try {
    const validated = forgotPasswordSchema.parse(input);
    const recoveryState = createPasswordRecoveryIntent(validated.email);
    const supabase = await createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    await supabase.auth.resetPasswordForEmail(validated.email, {
      redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password&recovery_state=${encodeURIComponent(recoveryState)}`,
    });

    return {
      success: true,
      message:
        "Nếu email này được liên kết với tài khoản, hướng dẫn đặt lại mật khẩu sẽ được gửi đến email.",
    };
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Dữ liệu email không hợp lệ.",
      };
    }
    return {
      success: true,
      message:
        "Nếu email này được liên kết với tài khoản, hướng dẫn đặt lại mật khẩu sẽ được gửi đến email.",
    };
  }
}

/**
 * Server Action to reset a password for a recovery-authenticated session.
 *
 * Security & Governance Invariants:
 * 1. Operates strictly from a genuine, verified recovery session (Auth User + valid recovery context token).
 * 2. Does NOT accept user_id, staff_id, or email from caller.
 * 3. Does NOT alter auth_setup_required on public.staff (initial setup and recovery are separate).
 * 4. Logs non-blocking security audit if staff record is found, never recording passwords.
 * 5. Consumes/clears recovery context cookie upon completion.
 * 6. Signs out the recovery session so that user authenticates cleanly with new credentials.
 */
export async function resetPasswordAction(input: ResetPasswordInput) {
  try {
    const validated = resetPasswordSchema.parse(input);
    const authUser = await requireAuthenticatedUser();

    // 1. Enforce verified recovery context bound to this specific Auth User
    await requireValidRecoveryContext(authUser.id);

    const supabase = await createClient();
    const { error: authErr } = await supabase.auth.updateUser({
      password: validated.password,
    });

    if (authErr) {
      return {
        success: false,
        error: authErr.message || "Lỗi cập nhật mật khẩu trong hệ thống xác thực.",
      };
    }

    // 2. Consume / clear the recovery context cookie
    await clearRecoveryContextCookie();

    // 3. Optional non-blocking audit log
    try {
      const adminSupabase = createAdminClient();
      const { data: staff } = await adminSupabase
        .from("staff")
        .select("id, staff_code")
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (staff) {
        await adminSupabase.from("audit_logs").insert({
          actor_user_id: authUser.id,
          action: "STAFF_PASSWORD_RECOVERY_COMPLETED",
          entity_type: "STAFF",
          entity_id: staff.id,
          after_data: {
            staff_id: staff.id,
            staff_code: staff.staff_code,
            auth_user_id: authUser.id,
            recovered_at: new Date().toISOString(),
          },
        });
      }
    } catch (auditErr) {
      console.error("Non-blocking audit log failure for password recovery:", auditErr);
    }

    // 4. Finalize recovery session: sign out to require fresh sign-in
    await supabase.auth.signOut();

    return {
      success: true,
      message: "Đổi mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.",
    };
  } catch (error: unknown) {
    if (error instanceof PasswordRecoveryRequiredError) {
      return {
        success: false,
        error: "Yêu cầu thực hiện quy trình đặt lại mật khẩu hợp lệ.",
      };
    }
    if (error instanceof AuthenticationRequiredError) {
      return {
        success: false,
        error: "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.",
      };
    }
    if (error instanceof ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Dữ liệu mật khẩu không hợp lệ.",
      };
    }
    return {
      success: false,
      error: (error as Error).message || "Không thể đặt lại mật khẩu lúc này. Vui lòng thử lại.",
    };
  }
}
