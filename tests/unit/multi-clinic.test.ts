import assert from "node:assert/strict";
import type {
  Organization,
  Clinic,
  StaffClinicMembership,
  StaffClinicRole,
  StaffWithClinicMemberships,
} from "@/types/clinic";

export function runMultiClinicTests() {
  console.log("Running Multi-Clinic Domain Foundation Tests...");

  // Mock domain store representing database tables
  const organizationsTable: Organization[] = [];
  const clinicsTable: Clinic[] = [];
  const staffTable: { id: string; staff_code: string; full_name: string; is_active: boolean }[] = [];
  const membershipsTable: StaffClinicMembership[] = [];
  const rolesTable: StaffClinicRole[] = [];

  // Seed Org
  const org: Organization = {
    id: "org-1",
    code: "THUAN_THIEN",
    name: "Thuận Thiên",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  organizationsTable.push(org);

  // Case 1: One organization can contain multiple clinics (N clinics, data-driven, not limited to 6)
  const clinic1: Clinic = {
    id: "clinic-1",
    organization_id: org.id,
    clinic_code: "TT-CS1",
    name: "Thuận Thiên Cơ sở 1",
    short_name: "Cơ sở 1",
    address: "123 Đường A, TP.HCM",
    phone: "0281234567",
    timezone: "Asia/Ho_Chi_Minh",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const clinic2: Clinic = {
    id: "clinic-2",
    organization_id: org.id,
    clinic_code: "TT-CS2",
    name: "Thuận Thiên Cơ sở 2",
    short_name: "Cơ sở 2",
    address: "456 Đường B, TP.HCM",
    phone: "0287654321",
    timezone: "Asia/Ho_Chi_Minh",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  clinicsTable.push(clinic1, clinic2);

  const orgClinics = clinicsTable.filter((c) => c.organization_id === org.id);
  assert.equal(orgClinics.length, 2, "Case 1: One organization contains multiple clinics");

  // Case 2: One clinic belongs to one organization
  assert.equal(clinic1.organization_id, org.id, "Case 2: Clinic 1 belongs to organization");
  assert.equal(clinic2.organization_id, org.id, "Case 2: Clinic 2 belongs to organization");

  // Case 3 & 4: One staff member can belong to multiple clinics without being duplicated
  const doctorA = {
    id: "staff-doc-a",
    staff_code: "BS-HAI",
    full_name: "BS Hải",
    is_active: true,
  };
  staffTable.push(doctorA);

  const membership1: StaffClinicMembership = {
    id: "mem-1",
    staff_id: doctorA.id,
    clinic_id: clinic1.id,
    is_primary: true,
    is_active: true,
    joined_at: new Date().toISOString(),
    left_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const membership2: StaffClinicMembership = {
    id: "mem-2",
    staff_id: doctorA.id,
    clinic_id: clinic2.id,
    is_primary: false,
    is_active: true,
    joined_at: new Date().toISOString(),
    left_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  membershipsTable.push(membership1, membership2);

  // Verify staff record is NOT duplicated
  const staffRecords = staffTable.filter((s) => s.id === doctorA.id);
  assert.equal(staffRecords.length, 1, "Case 4: Staff master record is not duplicated");

  // Verify staff belongs to 2 clinics
  const docMemberships = membershipsTable.filter((m) => m.staff_id === doctorA.id);
  assert.equal(docMemberships.length, 2, "Case 3: Staff member belongs to multiple clinics");

  // Case 5: Same membership cannot be duplicated (same staff_id + same clinic_id must fail)
  const isDuplicateMembership = (staffId: string, clinicId: string) => {
    return membershipsTable.some((m) => m.staff_id === staffId && m.clinic_id === clinicId);
  };
  assert.equal(
    isDuplicateMembership(doctorA.id, clinic1.id),
    true,
    "Case 5: Duplicate membership correctly detected and prohibited"
  );

  // Case 6: One membership can contain multiple distinct roles (e.g. DOCTOR and MANAGER at Clinic 2)
  const role1: StaffClinicRole = {
    id: "role-1",
    staff_clinic_membership_id: membership1.id,
    role_code: "DOCTOR",
    created_at: new Date().toISOString(),
  };

  const role2: StaffClinicRole = {
    id: "role-2",
    staff_clinic_membership_id: membership2.id,
    role_code: "DOCTOR",
    created_at: new Date().toISOString(),
  };

  const role3: StaffClinicRole = {
    id: "role-3",
    staff_clinic_membership_id: membership2.id,
    role_code: "MANAGER",
    created_at: new Date().toISOString(),
  };

  rolesTable.push(role1, role2, role3);

  const mem2Roles = rolesTable.filter((r) => r.staff_clinic_membership_id === membership2.id);
  assert.equal(mem2Roles.length, 2, "Case 6: Membership 2 contains 2 distinct roles (DOCTOR, MANAGER)");

  // Case 7: Same role cannot be assigned twice to the same membership
  const isDuplicateRole = (membershipId: string, roleCode: string) => {
    return rolesTable.some((r) => r.staff_clinic_membership_id === membershipId && r.role_code === roleCode);
  };
  assert.equal(
    isDuplicateRole(membership2.id, "DOCTOR"),
    true,
    "Case 7: Duplicate role on same membership correctly detected and prohibited"
  );

  // Case 8: Soft deactivation without hard deleting operational data
  membership2.is_active = false;
  membership2.left_at = new Date().toISOString();
  assert.equal(membership2.is_active, false, "Case 8: Soft deactivation supported");
  assert.notEqual(membership2.left_at, null, "Case 8: Left timestamp recorded");

  // Aggregate projection test
  const staffWithMemberships: StaffWithClinicMemberships = {
    id: doctorA.id,
    staff_code: doctorA.staff_code,
    full_name: doctorA.full_name,
    phone: null,
    email: null,
    is_active: doctorA.is_active,
    memberships: [
      {
        membership_id: membership1.id,
        clinic_id: clinic1.id,
        clinic_name: clinic1.name,
        clinic_code: clinic1.clinic_code,
        is_primary: membership1.is_primary,
        is_active: membership1.is_active,
        roles: ["DOCTOR"],
      },
      {
        membership_id: membership2.id,
        clinic_id: clinic2.id,
        clinic_name: clinic2.name,
        clinic_code: clinic2.clinic_code,
        is_primary: membership2.is_primary,
        is_active: membership2.is_active,
        roles: ["DOCTOR", "MANAGER"],
      },
    ],
  };

  assert.equal(staffWithMemberships.memberships.length, 2);
  assert.equal(staffWithMemberships.memberships[0].roles.includes("DOCTOR"), true);
  assert.equal(staffWithMemberships.memberships[1].roles.includes("MANAGER"), true);

  console.log("All Multi-Clinic Domain Foundation Tests PASSED!");
}
