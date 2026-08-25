import "server-only";
import { createClient } from "@/supabase-clients/server";
import { createAdminClient } from "@/supabase-clients/admin";
import {
  signInSchema,
  USERNAME_REGEX,
  type SignInInput,
} from "@/lib/validation/auth-schemas";
import type { StaffClinicMembershipIdentity } from "./clinic-resolver";
import { getStaffClinicPreference, evaluateAutoEnterDecision } from "./staff-preferences";
import { setActiveClinicCookie } from "./clinic-context";

export type SignInResult =
  | {
      success: true;
      user: {
        id: string;
      };
      redirectUrl?: string;
    }
  | {
      success: false;
      error: string;
      code: "INVALID_CREDENTIALS" | "AUTH_SERVICE_ERROR";
    };

const GENERIC_CREDENTIAL_ERROR = "Tài khoản hoặc mật khẩu không đúng.";
const SERVICE_ERROR_MESSAGE = "Hệ thống xác thực tạm thời không khả dụng. Vui lòng thử lại sau.";

/**
 * Signs in a Staff user using canonical `login_username` and password.
 *
 * Sequence & Invariants:
 * 1. Username is normalized server-side (trim + lowercase) and validated against canonical regex.
 * 2. Trusted service-role lookup verifies Staff by exact `login_username`.
 * 3. Requires `staff.user_id IS NOT NULL`, `staff.is_active = TRUE`, and `auth_setup_required = FALSE`.
 * 4. Resolves the linked Supabase Auth User's ACTUAL Auth email via `auth.admin.getUserById(staff.user_id)`.
 *    (Does NOT use `staff.email` as the final login Auth identity).
 * 5. Uses normal session-capable server Supabase client (`signInWithPassword`) to establish session cookies.
 * 6. Evaluates active clinic auto-enter decision inside this Server Action mutation boundary:
 *    - 0 clinics -> redirects to /select-clinic (shows zero-clinic state)
 *    - 1 clinic -> sets active clinic cookie & persists preference -> redirects to /
 *    - >1 clinics + valid remembered clinic -> sets active clinic cookie & refreshes preference -> redirects to /
 *    - >1 clinics + invalid/no preference -> redirects to /select-clinic
 * 7. Returns generic error message for all credential mismatches to prevent account enumeration.
 *
 * @param input Username and password object.
 * @returns Typed `SignInResult`.
 */
export async function signInWithUsernamePassword(input: SignInInput): Promise<SignInResult> {
  const parseResult = signInSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      success: false,
      error: GENERIC_CREDENTIAL_ERROR,
      code: "INVALID_CREDENTIALS",
    };
  }

  const { login_username, password } = parseResult.data;

  // Format validation: must match canonical username format
  if (!USERNAME_REGEX.test(login_username) || !password) {
    return {
      success: false,
      error: GENERIC_CREDENTIAL_ERROR,
      code: "INVALID_CREDENTIALS",
    };
  }

  try {
    const adminSupabase = createAdminClient();

    // 1. Trusted server-side lookup of Staff by exact canonical login_username
    const { data: staff, error: staffErr } = await adminSupabase
      .from("staff")
      .select("id, user_id, is_active, auth_setup_required")
      .eq("login_username", login_username)
      .maybeSingle();

    if (staffErr || !staff || !staff.user_id) {
      // Enumeration safety: return same generic error
      return {
        success: false,
        error: GENERIC_CREDENTIAL_ERROR,
        code: "INVALID_CREDENTIALS",
      };
    }

    // Inactive staff or setup-pending accounts cannot log in via normal flow
    if (!staff.is_active || staff.auth_setup_required) {
      return {
        success: false,
        error: GENERIC_CREDENTIAL_ERROR,
        code: "INVALID_CREDENTIALS",
      };
    }

    // 2. Resolve actual Auth User email from linked staff.user_id (NOT staff.email)
    const { data: authUserData, error: authUserErr } = await adminSupabase.auth.admin.getUserById(
      staff.user_id
    );

    if (authUserErr || !authUserData?.user?.email) {
      return {
        success: false,
        error: GENERIC_CREDENTIAL_ERROR,
        code: "INVALID_CREDENTIALS",
      };
    }

    const actualAuthEmail = authUserData.user.email;

    // 3. Authenticate with normal session-capable server client
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: actualAuthEmail,
      password,
    });

    if (error || !data.user) {
      const status =
        error && "status" in error && typeof error.status === "number"
          ? error.status
          : undefined;

      if (status !== undefined && (status === 429 || status >= 500)) {
        console.error("Supabase auth service error during login:", error?.message);
        return {
          success: false,
          error: SERVICE_ERROR_MESSAGE,
          code: "AUTH_SERVICE_ERROR",
        };
      }

      // Generic error for invalid password / credential mismatch
      return {
        success: false,
        error: GENERIC_CREDENTIAL_ERROR,
        code: "INVALID_CREDENTIALS",
      };
    }

    // 4. Auto-enter evaluation inside the Server Action mutation boundary
    let redirectUrl = "/select-clinic";
    try {
      const { data: memberRows } = await adminSupabase
        .from("staff_clinic_memberships")
        .select(`
          id,
          staff_id,
          clinic_id,
          is_primary,
          is_active,
          clinics (
            id,
            organization_id,
            clinic_code,
            name,
            timezone,
            is_active
          )
        `)
        .eq("staff_id", staff.id)
        .eq("is_active", true);

      const authorizedMemberships: StaffClinicMembershipIdentity[] = [];
      if (memberRows) {
        for (const row of memberRows) {
          const clinic = row.clinics as unknown as {
            id: string;
            organization_id: string;
            clinic_code: string;
            name: string;
            timezone?: string | null;
            is_active: boolean;
          } | null;

          if (clinic && clinic.is_active) {
            authorizedMemberships.push({
              membership_id: row.id,
              staff_id: row.staff_id,
              clinic_id: clinic.id,
              clinic_code: clinic.clinic_code,
              clinic_name: clinic.name,
              organization_id: clinic.organization_id,
              is_primary: row.is_primary ?? false,
              timezone: clinic.timezone || "Asia/Ho_Chi_Minh",
            });
          }
        }
      }

      const pref = await getStaffClinicPreference(staff.id);
      const { shouldAutoEnter, targetClinicId } = evaluateAutoEnterDecision(
        authorizedMemberships,
        pref?.last_selected_clinic_id || null
      );

      if (shouldAutoEnter && targetClinicId) {
        await setActiveClinicCookie(targetClinicId);
        redirectUrl = "/";
      }
    } catch (autoErr: unknown) {
      console.error("Secondary error evaluating auto-enter during sign-in:", autoErr);
    }

    return {
      success: true,
      user: {
        id: data.user.id,
      },
      redirectUrl,
    };
  } catch (err: unknown) {
    console.error("Unexpected error during signInWithUsernamePassword:", err);
    return {
      success: false,
      error: SERVICE_ERROR_MESSAGE,
      code: "AUTH_SERVICE_ERROR",
    };
  }
}

/**
 * Backward compatibility alias for existing callers/tests during migration.
 */
export const signInWithEmailPassword = signInWithUsernamePassword;
