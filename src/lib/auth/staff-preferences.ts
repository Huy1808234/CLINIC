import type { StaffClinicMembershipIdentity } from "./clinic-resolver";

export interface StaffClinicPreference {
  staff_id: string;
  last_selected_clinic_id: string | null;
  last_selected_at: string | null;
}

/**
 * Reads persistent clinic preference for the given staff member.
 * Primary-key indexed lookup on public.staff_preferences(staff_id).
 *
 * @param staffId Target staff UUID.
 * @returns StaffClinicPreference or null if not found.
 */
export async function getStaffClinicPreference(
  staffId: string
): Promise<StaffClinicPreference | null> {
  if (!staffId) return null;

  try {
    const { createAdminClient } = await import("@/supabase-clients/admin");
    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase
      .from("staff_preferences")
      .select("staff_id, last_selected_clinic_id, last_selected_at")
      .eq("staff_id", staffId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      staff_id: data.staff_id,
      last_selected_clinic_id: data.last_selected_clinic_id,
      last_selected_at: data.last_selected_at,
    };
  } catch (err: unknown) {
    console.error("Error reading staff clinic preference:", err);
    return null;
  }
}

/**
 * Persists the user's latest selected clinic in public.staff_preferences.
 *
 * Security Invariant:
 * Called only after staff authentication and membership authorization have been strictly verified.
 *
 * @param staffId Verified staff UUID.
 * @param clinicId Target authorized clinic UUID.
 */
export async function saveStaffClinicPreference(
  staffId: string,
  clinicId: string
): Promise<void> {
  if (!staffId || !clinicId) return;

  try {
    const { createAdminClient } = await import("@/supabase-clients/admin");
    const adminSupabase = createAdminClient();
    const now = new Date().toISOString();

    const { error } = await adminSupabase
      .from("staff_preferences")
      .upsert(
        {
          staff_id: staffId,
          last_selected_clinic_id: clinicId,
          last_selected_at: now,
          updated_at: now,
        },
        { onConflict: "staff_id" }
      );

    if (error) {
      console.error("Failed to save staff clinic preference:", error.message);
    }
  } catch (err: unknown) {
    console.error("Unexpected error saving staff clinic preference:", err);
  }
}

/**
 * Pure evaluation function for auto-entering a clinic workspace based on authorized active memberships
 * and persistent staff preference.
 *
 * Rules:
 * - CASE 1 (0 clinics): Deny / show zero-clinic state.
 * - CASE 2 (1 clinic): Auto-enter that single clinic regardless of stale preference.
 * - CASE 3 (>1 clinics + valid remembered clinic): Auto-enter the remembered clinic.
 * - CASE 4 (>1 clinics + invalid/missing remembered clinic): Show clinic selection page.
 *
 * Security:
 * The returned clinic_id is ALWAYS verified to belong to the caller's active authorized memberships.
 */
export function evaluateAutoEnterDecision(
  memberships: StaffClinicMembershipIdentity[],
  lastSelectedClinicId: string | null
): { shouldAutoEnter: boolean; targetClinicId: string | null } {
  // CASE 1: 0 authorized clinics
  if (!memberships || memberships.length === 0) {
    return { shouldAutoEnter: false, targetClinicId: null };
  }

  // CASE 2: Exactly 1 authorized clinic
  if (memberships.length === 1) {
    return { shouldAutoEnter: true, targetClinicId: memberships[0].clinic_id };
  }

  // CASE 3: Multiple clinics with valid remembered preference
  if (lastSelectedClinicId) {
    const matched = memberships.find((m) => m.clinic_id === lastSelectedClinicId);
    if (matched) {
      return { shouldAutoEnter: true, targetClinicId: matched.clinic_id };
    }
  }

  // CASE 4: Multiple clinics with no valid remembered preference -> show selection page
  return { shouldAutoEnter: false, targetClinicId: null };
}
