import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ClinicRoleCode } from "@/types/clinic";
import {
  getAvatarInitials,
  getPrimaryRoleLabel,
  formatSecondaryAccountLabel,
  ROLE_DISPLAY_LABELS,
  isRouteVisibleForRoles,
  NAVIGATION_ROUTE_ACCESS,
} from "@/lib/auth/shell-identity";

export function runShellIdentityTests() {
  console.log("Running AppShell Dynamic Identity & Navigation Auth Unit Tests...");

  // ==========================================
  // APP-SHELL-IDENTITY1 TESTS
  // ==========================================

  // SHELL-ID-13: Avatar Initials Generation
  assert.equal(getAvatarInitials("BS Anh Thư"), "AT", "SHELL-ID-13: BS Anh Thư -> AT");
  assert.equal(getAvatarInitials("Nguyễn Hải Huy"), "HH", "SHELL-ID-13: Nguyễn Hải Huy -> HH");
  assert.equal(getAvatarInitials("Thảo"), "T", "SHELL-ID-13: Thảo -> T");
  assert.equal(getAvatarInitials("Nguyễn Văn A"), "VA", "SHELL-ID-13: Nguyễn Văn A -> VA");
  assert.equal(getAvatarInitials(""), "NV", "SHELL-ID-13: empty string -> NV");
  assert.equal(getAvatarInitials("   "), "NV", "SHELL-ID-13: whitespace -> NV");

  // SHELL-ID-5 to 8: Role Display Labels
  assert.equal(ROLE_DISPLAY_LABELS.DOCTOR, "Bác sĩ", "SHELL-ID-5: DOCTOR -> Bác sĩ");
  assert.equal(ROLE_DISPLAY_LABELS.Y_SI, "Y sĩ", "SHELL-ID-6: Y_SI -> Y sĩ");
  assert.equal(ROLE_DISPLAY_LABELS.RECEPTIONIST, "Tiếp nhận", "SHELL-ID-7: RECEPTIONIST -> Tiếp nhận");
  assert.equal(ROLE_DISPLAY_LABELS.TECHNICIAN, "Kỹ thuật viên", "TECHNICIAN -> Kỹ thuật viên");
  assert.equal(ROLE_DISPLAY_LABELS.CSKH, "CSKH", "CSKH -> CSKH");
  assert.equal(ROLE_DISPLAY_LABELS.MANAGER, "Quản lý", "MANAGER -> Quản lý");
  assert.equal(ROLE_DISPLAY_LABELS.ADMIN, "Quản trị viên", "SHELL-ID-8: ADMIN -> Quản trị viên");

  // SHELL-ID-11: Multiple Role Deterministic Display Priority
  const multiRoles1: ClinicRoleCode[] = ["DOCTOR", "ADMIN", "RECEPTIONIST"];
  assert.equal(getPrimaryRoleLabel(multiRoles1), "Quản trị viên", "SHELL-ID-11: ADMIN takes priority over DOCTOR");

  const multiRoles2: ClinicRoleCode[] = ["RECEPTIONIST", "DOCTOR", "CSKH"];
  assert.equal(getPrimaryRoleLabel(multiRoles2), "Bác sĩ", "SHELL-ID-11: DOCTOR takes priority over RECEPTIONIST");

  const multiRoles3: ClinicRoleCode[] = ["TECHNICIAN", "Y_SI"];
  assert.equal(getPrimaryRoleLabel(multiRoles3), "Y sĩ", "SHELL-ID-11: Y_SI takes priority over TECHNICIAN");

  // SHELL-ID-3 & SHELL-ID-4: Secondary Account Line Formatting across clinics
  const sec1 = formatSecondaryAccountLabel(["DOCTOR"], "Thuận Thiên");
  assert.equal(sec1, "Bác sĩ • Thuận Thiên", "SHELL-ID-3: Bác sĩ • Thuận Thiên");

  const sec2 = formatSecondaryAccountLabel(["ADMIN"], "Phúc Nguyên");
  assert.equal(sec2, "Quản trị viên • Phúc Nguyên", "SHELL-ID-4: Quản trị viên • Phúc Nguyên");

  const sec3 = formatSecondaryAccountLabel(["Y_SI"], "Thuận Thiên");
  assert.equal(sec3, "Y sĩ • Thuận Thiên", "SHELL-ID-6: Y sĩ • Thuận Thiên");

  // SHELL-ID-2: Source Inspection: Ensure no hardcoded "Bác Sĩ Tiếp Nhận" or "Phòng Khám YHCT" in Sidebar.tsx
  const sidebarPath = path.join(process.cwd(), "src", "components", "layout", "Sidebar.tsx");
  assert(fs.existsSync(sidebarPath), "Sidebar.tsx exists");
  const sidebarCode = fs.readFileSync(sidebarPath, "utf-8");

  assert(!sidebarCode.includes("Bác Sĩ Tiếp Nhận"), "SHELL-ID-2: No hardcoded 'Bác Sĩ Tiếp Nhận' in Sidebar");
  assert(!sidebarCode.includes("Phòng Khám YHCT"), "SHELL-ID-2: No hardcoded 'Phòng Khám YHCT' in Sidebar");

  // SHELL-ID-1 & SHELL-ID-3: Dynamic fields in Sidebar
  assert(sidebarCode.includes("currentStaff?.full_name"), "SHELL-ID-1: Sidebar renders currentStaff.full_name");
  assert(sidebarCode.includes("activeClinic?.name"), "SHELL-ID-3: Sidebar renders activeClinic.name");
  assert(sidebarCode.includes("initials"), "SHELL-ID-13: Sidebar renders initials");
  assert(sidebarCode.includes("secondaryLabel"), "SHELL-ID-3: Sidebar renders secondaryLabel");

  // ==========================================
  // APP-SHELL-NAV-AUTH1 & NAV-FIX1 TESTS
  // ==========================================

  // NAV-AUTH-1 & NAV-FIX1-5: ADMIN sees all approved navigation
  assert.equal(isRouteVisibleForRoles("/staff", ["ADMIN"]), true, "NAV-AUTH-1: ADMIN sees /staff");
  assert.equal(isRouteVisibleForRoles("/migration", ["ADMIN"]), true, "NAV-AUTH-1: ADMIN sees /migration");
  assert.equal(isRouteVisibleForRoles("/reception", ["ADMIN"]), true, "NAV-AUTH-1: ADMIN sees /reception");
  assert.equal(isRouteVisibleForRoles("/schedule", ["ADMIN"]), true, "NAV-AUTH-1: ADMIN sees /schedule");
  assert.equal(isRouteVisibleForRoles("/patients", ["ADMIN"]), true, "NAV-AUTH-1: ADMIN sees /patients");

  // NAV-AUTH-2 & NAV-FIX1-6: DOCTOR-only does not see Nhân Sự & Cơ Sở (/staff)
  assert.equal(isRouteVisibleForRoles("/staff", ["DOCTOR"]), false, "NAV-AUTH-2: DOCTOR-only cannot see /staff");
  assert.equal(isRouteVisibleForRoles("/migration", ["DOCTOR"]), false, "NAV-AUTH-3: DOCTOR-only cannot see /migration");
  assert.equal(isRouteVisibleForRoles("/reception", ["DOCTOR"]), false, "NAV-FIX1-6: DOCTOR cannot see /reception");
  assert.equal(isRouteVisibleForRoles("/schedule", ["DOCTOR"]), true, "NAV-AUTH-3: DOCTOR sees /schedule");
  assert.equal(isRouteVisibleForRoles("/patients", ["DOCTOR"]), true, "NAV-AUTH-3: DOCTOR sees /patients");

  // NAV-AUTH-4 & NAV-FIX1-7: RECEPTIONIST sees Tiếp Nhận Khám (/reception), /schedule, /patients
  assert.equal(isRouteVisibleForRoles("/reception", ["RECEPTIONIST"]), true, "NAV-AUTH-4: RECEPTIONIST sees /reception");
  assert.equal(isRouteVisibleForRoles("/schedule", ["RECEPTIONIST"]), true, "NAV-AUTH-4: RECEPTIONIST sees /schedule");
  assert.equal(isRouteVisibleForRoles("/patients", ["RECEPTIONIST"]), true, "NAV-AUTH-4: RECEPTIONIST sees /patients");
  assert.equal(isRouteVisibleForRoles("/staff", ["RECEPTIONIST"]), false, "NAV-AUTH-4: RECEPTIONIST cannot see /staff");
  assert.equal(isRouteVisibleForRoles("/migration", ["RECEPTIONIST"]), false, "NAV-AUTH-4: RECEPTIONIST cannot see /migration");

  // NAV-AUTH-5, 6 & NAV-FIX1-8, 9: Y_SI and TECHNICIAN matrix
  assert.equal(isRouteVisibleForRoles("/schedule", ["Y_SI"]), true, "NAV-FIX1-8: Y_SI sees /schedule");
  assert.equal(isRouteVisibleForRoles("/patients", ["Y_SI"]), true, "NAV-FIX1-8: Y_SI sees /patients");
  assert.equal(isRouteVisibleForRoles("/staff", ["Y_SI"]), false, "NAV-AUTH-5: Y_SI cannot see /staff");
  assert.equal(isRouteVisibleForRoles("/migration", ["Y_SI"]), false, "NAV-AUTH-5: Y_SI cannot see /migration");
  assert.equal(isRouteVisibleForRoles("/reception", ["Y_SI"]), false, "NAV-FIX1-8: Y_SI cannot see /reception");

  assert.equal(isRouteVisibleForRoles("/schedule", ["TECHNICIAN"]), true, "NAV-FIX1-9: TECHNICIAN sees /schedule");
  assert.equal(isRouteVisibleForRoles("/patients", ["TECHNICIAN"]), true, "NAV-FIX1-9: TECHNICIAN sees /patients");
  assert.equal(isRouteVisibleForRoles("/staff", ["TECHNICIAN"]), false, "NAV-AUTH-6: TECHNICIAN cannot see /staff");
  assert.equal(isRouteVisibleForRoles("/migration", ["TECHNICIAN"]), false, "NAV-AUTH-6: TECHNICIAN cannot see /migration");
  assert.equal(isRouteVisibleForRoles("/reception", ["TECHNICIAN"]), false, "NAV-FIX1-9: TECHNICIAN cannot see /reception");

  // NAV-FIX1-1 & NAV-FIX1-3: CSKH only sees /patients, does NOT see /schedule, /reception, /staff, /migration
  assert.equal(isRouteVisibleForRoles("/schedule", ["CSKH"]), false, "NAV-FIX1-1: CSKH cannot see /schedule");
  assert.equal(isRouteVisibleForRoles("/reception", ["CSKH"]), false, "NAV-FIX1-1: CSKH cannot see /reception");
  assert.equal(isRouteVisibleForRoles("/staff", ["CSKH"]), false, "NAV-FIX1-1: CSKH cannot see /staff");
  assert.equal(isRouteVisibleForRoles("/migration", ["CSKH"]), false, "NAV-FIX1-1: CSKH cannot see /migration");
  assert.equal(isRouteVisibleForRoles("/patients", ["CSKH"]), true, "NAV-FIX1-3: CSKH sees /patients");

  // NAV-FIX1-2 & NAV-FIX1-4: MANAGER only sees /patients unless holding other roles
  assert.equal(isRouteVisibleForRoles("/schedule", ["MANAGER"]), false, "NAV-FIX1-2: MANAGER cannot see /schedule");
  assert.equal(isRouteVisibleForRoles("/reception", ["MANAGER"]), false, "NAV-FIX1-2: MANAGER cannot see /reception");
  assert.equal(isRouteVisibleForRoles("/staff", ["MANAGER"]), false, "NAV-AUTH-7: MANAGER cannot see /staff");
  assert.equal(isRouteVisibleForRoles("/migration", ["MANAGER"]), false, "NAV-AUTH-7: MANAGER cannot see /migration");
  assert.equal(isRouteVisibleForRoles("/patients", ["MANAGER"]), true, "NAV-FIX1-4: MANAGER sees /patients");

  // NAV-AUTH-8 & NAV-FIX1-12: Multi-role UNION semantics
  const adminDoctorRoles: ClinicRoleCode[] = ["DOCTOR", "ADMIN"];
  assert.equal(isRouteVisibleForRoles("/staff", adminDoctorRoles), true, "NAV-AUTH-8: DOCTOR + ADMIN sees /staff");
  assert.equal(isRouteVisibleForRoles("/migration", adminDoctorRoles), true, "NAV-AUTH-8: DOCTOR + ADMIN sees /migration");
  assert.equal(isRouteVisibleForRoles("/schedule", adminDoctorRoles), true, "NAV-AUTH-8: DOCTOR + ADMIN sees /schedule");
  assert.equal(isRouteVisibleForRoles("/patients", adminDoctorRoles), true, "NAV-AUTH-8: DOCTOR + ADMIN sees /patients");

  const cskhReceptionistRoles: ClinicRoleCode[] = ["CSKH", "RECEPTIONIST"];
  assert.equal(isRouteVisibleForRoles("/reception", cskhReceptionistRoles), true, "NAV-FIX1-12: CSKH + RECEPTIONIST sees /reception");
  assert.equal(isRouteVisibleForRoles("/schedule", cskhReceptionistRoles), true, "NAV-FIX1-12: CSKH + RECEPTIONIST sees /schedule");
  assert.equal(isRouteVisibleForRoles("/patients", cskhReceptionistRoles), true, "NAV-FIX1-12: CSKH + RECEPTIONIST sees /patients");
  assert.equal(isRouteVisibleForRoles("/staff", cskhReceptionistRoles), false, "NAV-FIX1-12: CSKH + RECEPTIONIST cannot see /staff");

  const managerAdminRoles: ClinicRoleCode[] = ["MANAGER", "ADMIN"];
  assert.equal(isRouteVisibleForRoles("/staff", managerAdminRoles), true, "NAV-FIX1-12: MANAGER + ADMIN sees /staff");

  // NAV-AUTH-9 to 11 & NAV-FIX1-11: Clinic-scoped role switching
  const clinicARoles: ClinicRoleCode[] = ["ADMIN", "DOCTOR"];
  const clinicBRoles: ClinicRoleCode[] = ["DOCTOR"];
  // Clinic A: ADMIN visible
  assert.equal(isRouteVisibleForRoles("/staff", clinicARoles), true, "NAV-AUTH-9: Clinic A has ADMIN");
  // Switch to Clinic B: ADMIN removed
  assert.equal(isRouteVisibleForRoles("/staff", clinicBRoles), false, "NAV-AUTH-10: Clinic B DOCTOR-only has no ADMIN menu");
  // Switch back to Clinic A: ADMIN restored
  assert.equal(isRouteVisibleForRoles("/staff", clinicARoles), true, "NAV-AUTH-11: Switch back restores ADMIN menu");

  // NAV-AUTH-12: No-role / Empty role state does not default to ADMIN
  assert.equal(isRouteVisibleForRoles("/staff", []), false, "NAV-AUTH-12: Empty roles cannot see /staff");
  assert.equal(isRouteVisibleForRoles("/migration", []), false, "NAV-AUTH-12: Empty roles cannot see /migration");
  assert.equal(isRouteVisibleForRoles("/reception", []), false, "NAV-AUTH-12: Empty roles cannot see /reception");
  assert.equal(isRouteVisibleForRoles("/schedule", []), false, "NAV-AUTH-12: Empty roles cannot see /schedule");
  assert.equal(isRouteVisibleForRoles("/patients", []), false, "NAV-AUTH-12: Empty roles cannot see /patients");
  assert.equal(isRouteVisibleForRoles("/master-data/diagnoses", []), false, "Empty roles cannot see /master-data/diagnoses");
  assert.equal(isRouteVisibleForRoles("/master-data/diagnoses", ["ADMIN"]), true, "ADMIN can see /master-data/diagnoses");

  // Verify all centralized routes exist in NAVIGATION_ROUTE_ACCESS
  assert.equal(NAVIGATION_ROUTE_ACCESS.length, 6, "Centralized navigation defines 6 standard routes");

  console.log("All AppShell Dynamic Identity & Navigation Auth Unit Tests PASSED!");
}
