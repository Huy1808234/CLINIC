import "server-only";
import { cache } from "react";
import { createClient } from "@/supabase-clients/server";
import { getCurrentStaff, requireCurrentStaff } from "./staff-resolver";

/**
 * Standard typed application error when an active staff member has no active clinic memberships.
 */
export class StaffNoActiveClinicError extends Error {
  public readonly code = "STAFF_NO_ACTIVE_CLINIC";
  public readonly statusCode = 403;

  constructor(message = "Nhân viên chưa được phân công vào bất kỳ cơ sở phòng khám nào đang hoạt động.") {
    super(message);
    this.name = "StaffNoActiveClinicError";
    Object.setPrototypeOf(this, StaffNoActiveClinicError.prototype);
  }
}

/**
 * DTO representing an active clinic membership for the currently verified staff.
 */
export interface StaffClinicMembershipIdentity {
  membership_id: string;
  staff_id: string;
  clinic_id: string;
  clinic_code: string;
  clinic_name: string;
  organization_id: string;
  is_primary: boolean;
  timezone: string;
}

/**
 * Resolves all active clinic memberships for the currently authenticated active staff member.
 *
 * Rules:
 * - Membership must be active (`staff_clinic_memberships.is_active = true`).
 * - Referenced clinic must be active (`clinics.is_active = true`).
 * - Never trusts client-provided staff_id; resolves via verified Auth -> Staff Master identity.
 * - Does NOT load roles or permissions (deferred to future Goal).
 * - Does NOT auto-select or store an active clinic context.
 *
 * Wrapped with React `cache()` for request-scoped deduplication across
 * Server Component render trees in a single HTTP request.
 *
 * @returns Array of active `StaffClinicMembershipIdentity` records, or empty array if unauthenticated/unlinked/no active clinics.
 */
export const getCurrentStaffClinicMemberships = cache(async (): Promise<StaffClinicMembershipIdentity[]> => {
  const currentStaff = await getCurrentStaff();
  if (!currentStaff) {
    return [];
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
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
      .eq("staff_id", currentStaff.id)
      .eq("is_active", true);

    if (error || !data) {
      console.error("Database error querying staff clinic memberships:", error);
      return [];
    }

    const results: StaffClinicMembershipIdentity[] = [];

    for (const row of data) {
      const clinic = row.clinics as unknown as {
        id: string;
        organization_id: string;
        clinic_code: string;
        name: string;
        timezone?: string | null;
        is_active: boolean;
      } | null;

      // Membership and referenced clinic must both be active
      if (clinic && clinic.is_active) {
        results.push({
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

    return results;
  } catch (err: unknown) {
    console.error("Failed to resolve current staff clinic memberships:", err);
    return [];
  }
});

/**
 * Requires the currently authenticated staff member to possess at least one active clinic membership.
 *
 * Enforces the complete authentication pipeline:
 * 1. Verified Auth User (throws `AuthenticationRequiredError` if missing, 401)
 * 2. Linked Staff Profile (throws `StaffNotLinkedError` if missing, 403)
 * 3. Active Staff Status (throws `StaffInactiveError` if inactive, 403)
 * 4. At least one Active Clinic Membership (throws `StaffNoActiveClinicError` if 0 memberships, 403)
 *
 * Wrapped with React `cache()` for request-scoped deduplication.
 *
 * @returns Non-empty array of active `StaffClinicMembershipIdentity` records.
 * @throws `AuthenticationRequiredError` | `StaffNotLinkedError` | `StaffInactiveError` | `StaffNoActiveClinicError`
 */
export const requireCurrentStaffClinicMemberships = cache(async (): Promise<StaffClinicMembershipIdentity[]> => {
  // Enforces valid, linked, active staff
  await requireCurrentStaff();

  const memberships = await getCurrentStaffClinicMemberships();

  if (memberships.length === 0) {
    throw new StaffNoActiveClinicError();
  }

  return memberships;
});
