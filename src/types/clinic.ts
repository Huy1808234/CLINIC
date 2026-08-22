export type ClinicRoleCode =
  | "DOCTOR"
  | "RECEPTIONIST"
  | "TECHNICIAN"
  | "Y_SI"
  | "CSKH"
  | "MANAGER"
  | "ADMIN";

export interface Organization {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Clinic {
  id: string;
  organization_id: string;
  clinic_code: string;
  name: string;
  short_name: string | null;
  address: string | null;
  phone: string | null;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StaffClinicMembership {
  id: string;
  staff_id: string;
  clinic_id: string;
  is_primary: boolean;
  is_active: boolean;
  joined_at: string | null;
  left_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffClinicRole {
  id: string;
  staff_clinic_membership_id: string;
  role_code: ClinicRoleCode;
  created_at: string;
}

export interface StaffWithClinicMemberships {
  id: string;
  user_id?: string | null;
  auth_setup_required?: boolean;
  auth_setup_completed_at?: string | null;
  staff_code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  memberships: {
    membership_id: string;
    clinic_id: string;
    clinic_name: string;
    clinic_code: string;
    is_primary: boolean;
    is_active: boolean;
    roles: ClinicRoleCode[];
  }[];
}
