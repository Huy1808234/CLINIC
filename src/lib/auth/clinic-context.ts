import "server-only";
import { cookies } from "next/headers";
import {
  getCurrentStaffClinicMemberships,
  requireCurrentStaffClinicMemberships,
} from "./clinic-resolver";
import { StaffClinicAccessDeniedError } from "./role-resolver";

export const ACTIVE_CLINIC_COOKIE_NAME = "tt_active_clinic_id";

/**
 * Standard typed application error when an operation requires an active clinic
 * selection, but no clinic has been chosen yet.
 */
export class NoActiveClinicSelectedError extends Error {
  public readonly code = "NO_ACTIVE_CLINIC_SELECTED";
  public readonly statusCode = 400;

  constructor(message = "Vui lòng chọn cơ sở phòng khám làm việc.") {
    super(message);
    this.name = "NoActiveClinicSelectedError";
    Object.setPrototypeOf(this, NoActiveClinicSelectedError.prototype);
  }
}

/**
 * Verified identity representing the active clinic for the current session.
 */
export interface ActiveClinicIdentity {
  id: string;
  clinic_code: string;
  name: string;
  organization_id: string;
  is_primary: boolean;
  membership_id: string;
  timezone: string;
}

/**
 * Reads the raw clinic ID stored in the session cookie without verification.
 */
export async function getActiveClinicIdFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_CLINIC_COOKIE_NAME)?.value || null;
}

/**
 * Sets the active clinic selection in the server session cookie.
 *
 * Security Invariant:
 * The selected `clinicId` is ALWAYS validated against the caller's active clinic memberships
 * (from AUTH1.3) before the cookie is written.
 *
 * @param clinicId Target clinic UUID to set as active.
 * @returns Verified `ActiveClinicIdentity` of the newly active clinic.
 * @throws `StaffClinicAccessDeniedError` if caller is not authorized for the clinic.
 */
export async function setActiveClinicCookie(clinicId: string): Promise<ActiveClinicIdentity> {
  if (!clinicId) {
    throw new StaffClinicAccessDeniedError("Mã cơ sở phòng khám không hợp lệ.");
  }

  const authorizedMemberships = await requireCurrentStaffClinicMemberships();
  const matched = authorizedMemberships.find((m) => m.clinic_id === clinicId);

  if (!matched) {
    throw new StaffClinicAccessDeniedError();
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_CLINIC_COOKIE_NAME, matched.clinic_id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  // Persist user's latest workspace preference in database
  try {
    const { saveStaffClinicPreference } = await import("./staff-preferences");
    await saveStaffClinicPreference(matched.staff_id, matched.clinic_id);
  } catch (err: unknown) {
    console.error("Secondary error saving clinic preference:", err);
  }

  return {
    id: matched.clinic_id,
    clinic_code: matched.clinic_code,
    name: matched.clinic_name,
    organization_id: matched.organization_id,
    is_primary: matched.is_primary,
    membership_id: matched.membership_id,
    timezone: matched.timezone || "Asia/Ho_Chi_Minh",
  };
}

/**
 * Resolves the verified active clinic for the current session.
 *
 * Verification Pipeline:
 * cookie clinic_id -> resolve current staff memberships (AUTH1.3) -> verify match -> return ActiveClinicIdentity.
 *
 * @returns Verified `ActiveClinicIdentity` or `null` if no cookie set or membership revoked.
 */
export async function getActiveClinicContext(): Promise<ActiveClinicIdentity | null> {
  const cookieClinicId = await getActiveClinicIdFromCookie();
  if (!cookieClinicId) {
    return null;
  }

  const authorizedMemberships = await getCurrentStaffClinicMemberships();
  const matched = authorizedMemberships.find((m) => m.clinic_id === cookieClinicId);

  if (!matched) {
    return null;
  }

  return {
    id: matched.clinic_id,
    clinic_code: matched.clinic_code,
    name: matched.clinic_name,
    organization_id: matched.organization_id,
    is_primary: matched.is_primary,
    membership_id: matched.membership_id,
    timezone: matched.timezone || "Asia/Ho_Chi_Minh",
  };
}

/**
 * Requires a verified active clinic selection for operations that require a clinic context.
 *
 * Enforces the complete pipeline:
 * 1. Verified Auth User (AUTH1.1)
 * 2. Linked Active Staff (AUTH1.2)
 * 3. Active Clinic Memberships (AUTH1.3)
 * 4. Cookie Clinic ID is present and matches an authorized membership.
 *
 * @returns Verified `ActiveClinicIdentity`.
 * @throws `NoActiveClinicSelectedError` if no clinic has been selected.
 * @throws `StaffClinicAccessDeniedError` if the selected clinic is unauthorized or revoked.
 */
export async function requireActiveClinic(): Promise<ActiveClinicIdentity> {
  const authorizedMemberships = await requireCurrentStaffClinicMemberships();
  const cookieClinicId = await getActiveClinicIdFromCookie();

  if (!cookieClinicId) {
    throw new NoActiveClinicSelectedError();
  }

  const matched = authorizedMemberships.find((m) => m.clinic_id === cookieClinicId);

  if (!matched) {
    throw new StaffClinicAccessDeniedError("Cơ sở phòng khám đã chọn không còn thuộc quyền truy cập của bạn.");
  }

  return {
    id: matched.clinic_id,
    clinic_code: matched.clinic_code,
    name: matched.clinic_name,
    organization_id: matched.organization_id,
    is_primary: matched.is_primary,
    membership_id: matched.membership_id,
    timezone: matched.timezone || "Asia/Ho_Chi_Minh",
  };
}

/**
 * Clears the active clinic selection cookie.
 */
export async function clearActiveClinicCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_CLINIC_COOKIE_NAME);
}
