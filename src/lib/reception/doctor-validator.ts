import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export class InvalidDoctorTargetError extends Error {
  public readonly code = "INVALID_DOCTOR_TARGET";
  public readonly statusCode = 400;

  constructor(
    message = "Bác sĩ được chọn không hợp lệ hoặc không được phân công tại cơ sở hiện tại."
  ) {
    super(message);
    this.name = "InvalidDoctorTargetError";
    Object.setPrototypeOf(this, InvalidDoctorTargetError.prototype);
  }
}

export interface ValidatedDoctorTarget {
  id: string;
  staff_code: string;
  full_name: string;
}

/**
 * Validates that a client-supplied doctor_id target satisfies all server-side integrity predicates:
 * 1. Target Staff exists in `public.staff`
 * 2. Target Staff is active (`staff.is_active = true`)
 * 3. Target Staff has an active clinic membership at the specified clinic (`staff_clinic_memberships.is_active = true`)
 * 4. Target Staff possesses the 'DOCTOR' role on that active membership (`staff_clinic_roles.role_code = 'DOCTOR'`)
 *
 * @param supabase Authenticated or service-role Supabase client
 * @param doctorId Target staff UUID supplied by the client
 * @param clinicId Verified active clinic UUID derived from server context
 * @throws `InvalidDoctorTargetError` if any condition is not met.
 */
export async function validateDoctorForClinic(
  supabase: SupabaseClient<Database>,
  doctorId: string,
  clinicId: string
): Promise<ValidatedDoctorTarget> {
  // 1. Verify target staff exists and is active
  const { data: staff, error: staffErr } = await supabase
    .from("staff")
    .select("id, staff_code, full_name, is_active")
    .eq("id", doctorId)
    .maybeSingle();

  if (staffErr || !staff || !staff.is_active) {
    throw new InvalidDoctorTargetError(
      "Bác sĩ được chọn không tồn tại hoặc đã ngừng hoạt động."
    );
  }

  // 2. Verify active membership at the exact active clinic
  const { data: membership, error: memErr } = await supabase
    .from("staff_clinic_memberships")
    .select("id, is_active")
    .eq("staff_id", doctorId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (memErr || !membership || !membership.is_active) {
    throw new InvalidDoctorTargetError(
      "Bác sĩ được chọn không có phân công hoạt động tại cơ sở này."
    );
  }

  // 3. Verify DOCTOR role on that active membership
  const { data: roles, error: rolesErr } = await supabase
    .from("staff_clinic_roles")
    .select("role_code")
    .eq("staff_clinic_membership_id", membership.id)
    .eq("role_code", "DOCTOR");

  if (rolesErr || !roles || roles.length === 0) {
    throw new InvalidDoctorTargetError(
      "Nhân viên được chọn không có vai trò Bác sĩ (DOCTOR) tại cơ sở này."
    );
  }

  return {
    id: staff.id,
    staff_code: staff.staff_code,
    full_name: staff.full_name,
  };
}
