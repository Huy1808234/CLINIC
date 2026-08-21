"use server";

import { signInWithEmailPassword, type SignInResult } from "@/lib/auth/sign-in";
import { signOutCurrentUser, type SignOutResult } from "@/lib/auth/sign-out";
import {
  setActiveClinicCookie,
  clearActiveClinicCookie,
  type ActiveClinicIdentity,
} from "@/lib/auth/clinic-context";
import type { SignInInput } from "@/lib/validation/auth-schemas";

/**
 * Server Action for email/password authentication.
 * Delegates to the centralized signInWithEmailPassword resolver.
 *
 * @param input Email and password.
 * @returns Typed `SignInResult`.
 */
export async function signInAction(input: SignInInput): Promise<SignInResult> {
  return await signInWithEmailPassword(input);
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
