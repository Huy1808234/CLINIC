import "server-only";
import { getCurrentStaff, requireCurrentStaff } from "./staff-resolver";
import { getActiveClinicContext, requireActiveClinic } from "./clinic-context";

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
  };
}

/**
 * Resolves the Application Access Context for the current caller if fully authenticated,
 * linked to an active staff member, and operating within an authorized active clinic.
 *
 * Returns `null` if unauthenticated, unlinked, inactive, or no active clinic is selected.
 *
 * @returns Verified `ApplicationAccessContext` or `null`.
 */
export async function getApplicationAccessContext(): Promise<ApplicationAccessContext | null> {
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
    },
  };
}

/**
 * Enforces and returns the verified Application Access Context for the current request.
 *
 * Enforces the complete trusted chain:
 * 1. Verified Auth User (`getCurrentAuthUser`) -> throws `AuthenticationRequiredError`
 * 2. Active Linked Staff (`getCurrentStaff`) -> throws `StaffNotLinkedError` / `StaffInactiveError`
 * 3. Active Clinic Memberships (`getCurrentStaffClinicMemberships`) -> throws `StaffNoActiveClinicError`
 * 4. Active Clinic Selection (`getActiveClinicContext`) -> throws `NoActiveClinicSelectedError` / `StaffClinicAccessDeniedError`
 *
 * @returns Verified `ApplicationAccessContext`.
 */
export async function requireApplicationAccessContext(): Promise<ApplicationAccessContext> {
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
    },
  };
}
