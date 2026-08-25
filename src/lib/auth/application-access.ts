import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { AuthenticationRequiredError } from "./auth-resolver";
import {
  getCurrentStaff,
  requireCurrentStaff,
  AccountSetupRequiredError,
} from "./staff-resolver";
import {
  getActiveClinicContext,
  requireActiveClinic,
  NoActiveClinicSelectedError,
} from "./clinic-context";
import { StaffClinicAccessDeniedError } from "./role-resolver";
import { StaffNoActiveClinicError } from "./clinic-resolver";
import { PasswordRecoveryRequiredError } from "./recovery-context";

/**
 * Verified Application Access Context representing an active authenticated Staff
 * operating within an authorized active Clinic context.
 */
export interface ApplicationAccessContext {
  staff: {
    id: string;
    staff_code: string;
    full_name: string;
  };
  clinic: {
    clinic_id: string;
    clinic_code: string;
    clinic_name: string;
    organization_id: string;
    membership_id: string;
    is_primary: boolean;
    timezone: string;
  };
}

/**
 * Resolves the Application Access Context for the current caller if fully authenticated,
 * linked to an active staff member, and operating within an authorized active clinic.
 *
 * Returns `null` if unauthenticated, unlinked, inactive, or no active clinic is selected.
 *
 * Wrapped with React `cache()` for request-scoped deduplication.
 *
 * @returns Verified `ApplicationAccessContext` or `null`.
 */
export const getApplicationAccessContext = cache(async (): Promise<ApplicationAccessContext | null> => {
  const staff = await getCurrentStaff();
  if (!staff) {
    return null;
  }

  const clinic = await getActiveClinicContext();
  if (!clinic) {
    return null;
  }

  return {
    staff: {
      id: staff.id,
      staff_code: staff.staff_code,
      full_name: staff.full_name,
    },
    clinic: {
      clinic_id: clinic.id,
      clinic_code: clinic.clinic_code,
      clinic_name: clinic.name,
      organization_id: clinic.organization_id,
      membership_id: clinic.membership_id,
      is_primary: clinic.is_primary,
      timezone: clinic.timezone || "Asia/Ho_Chi_Minh",
    },
  };
});

/**
 * Enforces and returns the verified Application Access Context for the current request.
 *
 * Enforces the complete trusted chain:
 * 1. Verified Auth User (`getCurrentAuthUser`) -> throws `AuthenticationRequiredError`
 * 2. Active Linked Staff (`getCurrentStaff`) -> throws `StaffNotLinkedError` / `StaffInactiveError`
 * 3. Active Clinic Memberships (`getCurrentStaffClinicMemberships`) -> throws `StaffNoActiveClinicError`
 * 4. Active Clinic Selection (`getActiveClinicContext`) -> throws `NoActiveClinicSelectedError` / `StaffClinicAccessDeniedError`
 *
 * Wrapped with React `cache()` for request-scoped deduplication across
 * Server Component render trees in a single HTTP request.
 *
 * @returns Verified `ApplicationAccessContext`.
 */
export const requireApplicationAccessContext = cache(async (): Promise<ApplicationAccessContext> => {
  const staff = await requireCurrentStaff();
  const clinic = await requireActiveClinic();

  return {
    staff: {
      id: staff.id,
      staff_code: staff.staff_code,
      full_name: staff.full_name,
    },
    clinic: {
      clinic_id: clinic.id,
      clinic_code: clinic.clinic_code,
      clinic_name: clinic.name,
      organization_id: clinic.organization_id,
      membership_id: clinic.membership_id,
      is_primary: clinic.is_primary,
      timezone: clinic.timezone || "Asia/Ho_Chi_Minh",
    },
  };
});

function isNextRedirectError(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "digest" in error) {
    const digest = String((error as { digest?: unknown }).digest || "");
    return digest.startsWith("NEXT_REDIRECT");
  }
  return false;
}

/**
 * Enforces and returns the verified Application Access Context for a Server Component Page.
 *
 * Catches unauthenticated/session-navigation conditions and initiates clean redirects:
 * - `AuthenticationRequiredError` -> `redirect("/login")`
 * - `NoActiveClinicSelectedError` / `StaffClinicAccessDeniedError` / `StaffNoActiveClinicError` -> `redirect("/select-clinic")`
 * - `AccountSetupRequiredError` -> `redirect("/auth/setup-password")`
 * - `PasswordRecoveryRequiredError` -> `redirect("/auth/reset-password")`
 *
 * Unexpected infrastructure or database errors are re-thrown so they are not masked as login redirects.
 *
 * Wrapped with React `cache()` for request-scoped deduplication.
 *
 * @returns Verified `ApplicationAccessContext`.
 */
export const requireApplicationPageAccessContext = cache(async (): Promise<ApplicationAccessContext> => {
  try {
    return await requireApplicationAccessContext();
  } catch (error: unknown) {
    // Preserve Next.js redirect control-flow error without swallowing or modifying it
    if (isNextRedirectError(error)) {
      throw error;
    }

    if (error instanceof AuthenticationRequiredError) {
      redirect("/login");
    }

    if (
      error instanceof NoActiveClinicSelectedError ||
      error instanceof StaffClinicAccessDeniedError ||
      error instanceof StaffNoActiveClinicError
    ) {
      redirect("/select-clinic");
    }

    if (error instanceof AccountSetupRequiredError) {
      redirect("/auth/setup-password");
    }

    if (error instanceof PasswordRecoveryRequiredError) {
      redirect("/auth/reset-password");
    }

    // Re-throw any other error (StaffNotLinkedError, StaffInactiveError, DB errors, etc.)
    throw error;
  }
});

