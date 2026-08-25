import "server-only";
import { cache } from "react";
import { createClient } from "@/supabase-clients/server";
import type { ClinicRoleCode } from "@/types/clinic";
import {
  getCurrentStaffClinicMemberships,
  requireCurrentStaffClinicMemberships,
} from "./clinic-resolver";

/**
 * Standard typed application error when an authenticated staff member attempts
 * to access a clinic to which they do not actively belong.
 */
export class StaffClinicAccessDeniedError extends Error {
  public readonly code = "STAFF_CLINIC_ACCESS_DENIED";
  public readonly statusCode = 403;

  constructor(message = "Nhân viên không có quyền truy cập hoặc không thuộc cơ sở phòng khám này.") {
    super(message);
    this.name = "StaffClinicAccessDeniedError";
    Object.setPrototypeOf(this, StaffClinicAccessDeniedError.prototype);
  }
}

/**
 * Standard typed application error when an active staff member belongs to a clinic
 * but has zero roles assigned at that specific clinic.
 */
export class StaffNoClinicRolesError extends Error {
  public readonly code = "STAFF_NO_CLINIC_ROLES";
  public readonly statusCode = 403;

  constructor(message = "Nhân viên chưa được phân công vai trò nào tại cơ sở phòng khám này.") {
    super(message);
    this.name = "StaffNoClinicRolesError";
    Object.setPrototypeOf(this, StaffNoClinicRolesError.prototype);
  }
}

/**
 * Verified role context for the current staff member at a specific authorized clinic.
 */
export interface StaffClinicRoleContext {
  membership_id: string;
  staff_id: string;
  clinic_id: string;
  clinic_code: string;
  clinic_name: string;
  organization_id: string;
  is_primary: boolean;
  roles: ClinicRoleCode[];
}

/**
 * Resolves role codes for the currently authenticated staff member at a specific target clinic.
 *
 * Rules:
 * - Verified caller must hold an active membership at the specified clinic.
 * - If caller is unauthenticated, unlinked, or does not belong to the clinic, returns `[]`.
 * - Only queries `staff_clinic_roles` for that specific membership.
 * - Does NOT use `createAdminClient()`.
 *
 * Wrapped with React `cache()` for request-scoped deduplication across
 * Server Component render trees in a single HTTP request.
 *
 * @param clinicId Target clinic UUID.
 * @returns Array of `ClinicRoleCode` or empty array if unauthorized/no roles.
 */
export const getCurrentStaffRolesForClinic = cache(async (clinicId: string): Promise<ClinicRoleCode[]> => {
  if (!clinicId) {
    return [];
  }

  const memberships = await getCurrentStaffClinicMemberships();
  const targetMembership = memberships.find((m) => m.clinic_id === clinicId);

  if (!targetMembership) {
    return [];
  }

  try {
    const supabase = await createClient();
    const { data: roleRows, error } = await supabase
      .from("staff_clinic_roles")
      .select("role_code")
      .eq("staff_clinic_membership_id", targetMembership.membership_id);

    if (error || !roleRows) {
      console.error("Database error querying staff clinic roles:", error);
      return [];
    }

    return roleRows.map((r) => r.role_code as ClinicRoleCode);
  } catch (err: unknown) {
    console.error("Failed to resolve staff clinic roles:", err);
    return [];
  }
});

/**
 * Requires the current staff member to hold an active membership with at least one role at the target clinic.
 *
 * Enforces the complete pipeline:
 * 1. Verified Auth User (throws `AuthenticationRequiredError`, 401)
 * 2. Linked Staff Master Profile (throws `StaffNotLinkedError`, 403)
 * 3. Active Staff Status (throws `StaffInactiveError`, 403)
 * 4. Active Membership at Target Clinic (throws `StaffClinicAccessDeniedError`, 403)
 * 5. At least one assigned Role at Target Clinic (throws `StaffNoClinicRolesError`, 403)
 *
 * Wrapped with React `cache()` for request-scoped deduplication.
 *
 * @param clinicId Target clinic UUID.
 * @returns Verified `StaffClinicRoleContext` containing membership metadata and assigned roles.
 * @throws `AuthenticationRequiredError` | `StaffNotLinkedError` | `StaffInactiveError` | `StaffClinicAccessDeniedError` | `StaffNoClinicRolesError`
 */
export const requireCurrentStaffRolesForClinic = cache(async (clinicId: string): Promise<StaffClinicRoleContext> => {
  if (!clinicId) {
    throw new StaffClinicAccessDeniedError("Mã cơ sở phòng khám không hợp lệ.");
  }

  // Enforces valid auth -> linked staff -> active status -> active memberships
  const authorizedMemberships = await requireCurrentStaffClinicMemberships();
  const targetMembership = authorizedMemberships.find((m) => m.clinic_id === clinicId);

  if (!targetMembership) {
    throw new StaffClinicAccessDeniedError();
  }

  const supabase = await createClient();
  const { data: roleRows, error } = await supabase
    .from("staff_clinic_roles")
    .select("role_code")
    .eq("staff_clinic_membership_id", targetMembership.membership_id);

  if (error) {
    console.error("Database error querying staff clinic roles:", error);
    throw new Error("Lỗi truy vấn vai trò nhân viên tại cơ sở.");
  }

  if (!roleRows || roleRows.length === 0) {
    throw new StaffNoClinicRolesError();
  }

  const roles = roleRows.map((r) => r.role_code as ClinicRoleCode);

  return {
    membership_id: targetMembership.membership_id,
    staff_id: targetMembership.staff_id,
    clinic_id: targetMembership.clinic_id,
    clinic_code: targetMembership.clinic_code,
    clinic_name: targetMembership.clinic_name,
    organization_id: targetMembership.organization_id,
    is_primary: targetMembership.is_primary,
    roles,
  };
});

/**
 * Pure helper to verify if a role list includes a specific role code.
 */
export function hasClinicRole(roles: ClinicRoleCode[], requiredRole: ClinicRoleCode): boolean {
  return roles.includes(requiredRole);
}
