import "server-only";
import { createAdminClient } from "@/supabase-clients/admin";
import type { Clinic, Organization, StaffWithClinicMemberships, ClinicRoleCode } from "@/types/clinic";

export async function getClinicsList(): Promise<Clinic[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("clinics")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching clinics:", error);
      return [];
    }

    return (data || []).map((c) => ({
      id: c.id,
      organization_id: c.organization_id,
      clinic_code: c.clinic_code,
      name: c.name,
      short_name: c.short_name,
      address: c.address,
      phone: c.phone,
      timezone: c.timezone,
      is_active: c.is_active,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));
  } catch (err) {
    console.error("Failed to fetch clinics list:", err);
    return [];
  }
}

export async function getOrganizationsList(): Promise<Organization[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching organizations:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Failed to fetch organizations list:", err);
    return [];
  }
}

export async function getStaffList(clinicIdFilter?: string): Promise<StaffWithClinicMemberships[]> {
  try {
    const supabase = createAdminClient();

    // 1. Fetch staff members
    const { data: staffRows, error: staffError } = await supabase
      .from("staff")
      .select("*")
      .order("created_at", { ascending: false });

    if (staffError || !staffRows) {
      console.error("Error fetching staff list:", staffError);
      return [];
    }

    // 2. Fetch memberships with clinic details
    const { data: membershipRows, error: memError } = await supabase
      .from("staff_clinic_memberships")
      .select(`
        id,
        staff_id,
        clinic_id,
        is_primary,
        is_active,
        clinics (
          id,
          name,
          clinic_code
        )
      `);

    if (memError) {
      console.error("Error fetching memberships:", memError);
    }

    // 3. Fetch roles
    const { data: roleRows, error: roleError } = await supabase
      .from("staff_clinic_roles")
      .select("*");

    if (roleError) {
      console.error("Error fetching roles:", roleError);
    }

    // Map memberships with their roles
    const rolesByMembershipId: Record<string, ClinicRoleCode[]> = {};
    for (const r of roleRows || []) {
      if (!rolesByMembershipId[r.staff_clinic_membership_id]) {
        rolesByMembershipId[r.staff_clinic_membership_id] = [];
      }
      rolesByMembershipId[r.staff_clinic_membership_id].push(r.role_code as ClinicRoleCode);
    }

    const membershipsByStaffId: Record<string, StaffWithClinicMemberships["memberships"]> = {};
    for (const m of membershipRows || []) {
      if (!membershipsByStaffId[m.staff_id]) {
        membershipsByStaffId[m.staff_id] = [];
      }
      const clinicObj = m.clinics as unknown as { id: string; name: string; clinic_code: string } | null;
      membershipsByStaffId[m.staff_id].push({
        membership_id: m.id,
        clinic_id: m.clinic_id,
        clinic_name: clinicObj?.name || "Cơ sở",
        clinic_code: clinicObj?.clinic_code || "CS",
        is_primary: m.is_primary,
        is_active: m.is_active,
        roles: rolesByMembershipId[m.id] || [],
      });
    }

    // Combine into StaffWithClinicMemberships
    let result: StaffWithClinicMemberships[] = staffRows.map((s) => ({
      id: s.id,
      user_id: s.user_id || null,
      login_username: (s.login_username as string | null | undefined) ?? null,
      auth_setup_required: (s.auth_setup_required as boolean | undefined) ?? false,
      auth_setup_completed_at: (s.auth_setup_completed_at as string | null | undefined) ?? null,
      staff_code: s.staff_code,
      full_name: s.full_name,
      phone: s.phone,
      email: s.email,
      is_active: s.is_active,
      memberships: membershipsByStaffId[s.id] || [],
    }));

    if (clinicIdFilter) {
      result = result.filter((s) =>
        s.memberships.some((m) => m.clinic_id === clinicIdFilter && m.is_active)
      );
    }

    return result;
  } catch (err) {
    console.error("Failed to get staff list:", err);
    return [];
  }
}
