import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { evaluateAutoEnterDecision } from "@/lib/auth/staff-preferences";
import type { StaffClinicMembershipIdentity } from "@/lib/auth/clinic-resolver";

export function runClinicSelectionUxTests() {
  console.log("Running Clinic Selection UX & Preference Invariant Tests...");

  const viewPath = path.join(process.cwd(), "src", "components", "auth", "SelectClinicClientView.tsx");
  const pagePath = path.join(process.cwd(), "src", "app", "select-clinic", "page.tsx");
  const prefPath = path.join(process.cwd(), "src", "lib", "auth", "staff-preferences.ts");
  const migrationPath = path.join(process.cwd(), "supabase", "migrations", "20260825000036_staff_clinic_preferences.sql");

  assert.equal(fs.existsSync(viewPath), true, "SelectClinicClientView.tsx exists");
  assert.equal(fs.existsSync(pagePath), true, "select-clinic/page.tsx exists");
  assert.equal(fs.existsSync(prefPath), true, "staff-preferences.ts exists");
  assert.equal(fs.existsSync(migrationPath), true, "Migration 36 exists");

  const viewCode = fs.readFileSync(viewPath, "utf-8");
  const pageCode = fs.readFileSync(pagePath, "utf-8");
  const prefCode = fs.readFileSync(prefPath, "utf-8");
  const migrationCode = fs.readFileSync(migrationPath, "utf-8");

  assert.equal(
    prefCode.includes("evaluateAutoEnterDecision") && prefCode.includes("saveStaffClinicPreference"),
    true,
    "staff-preferences.ts exports preference save and evaluation functions"
  );

  // CLSEL-UI-1 & CLSEL-UI-5: Staff identity and dynamic clinic count
  assert.equal(
    viewCode.includes("{staffName}") && viewCode.includes("{staffCode}"),
    true,
    "Staff identity renders dynamically (CLSEL-UI-1)"
  );
  assert.equal(
    viewCode.includes("{memberships.length} cơ sở"),
    true,
    "Dynamic clinic count rendered (CLSEL-UI-5)"
  );

  // CLSEL-UI-4: Roles render from real data with centralized labels
  assert.equal(
    viewCode.includes("ROLE_DISPLAY_LABELS") && viewCode.includes("membership.roles"),
    true,
    "Roles render dynamically from membership data using centralized labels (CLSEL-UI-4)"
  );

  // CLSEL-UI-6: Recent clinic visual hint
  assert.equal(
    viewCode.includes("isRecent") && viewCode.includes("Gần đây"),
    true,
    "Recent clinic badge renders conditionally (CLSEL-UI-6)"
  );

  // CLSEL-PERF-1 & CLSEL-PERF-2: Server pre-fetches roles without client-side waterfalls
  assert.equal(
    pageCode.includes("getCurrentStaffRolesForClinic"),
    true,
    "Roles are pre-fetched on server to prevent N+1 client waterfalls (CLSEL-PERF-1, CLSEL-PERF-2)"
  );

  // CLSEL-PERF-3: Preference lookup is PK-based on staff_id
  assert.equal(
    migrationCode.includes("staff_id UUID PRIMARY KEY REFERENCES public.staff(id)"),
    true,
    "staff_preferences uses primary key staff_id for O(1) indexed lookup (CLSEL-PERF-3)"
  );

  // ==========================================
  // PURE LOGICAL TESTS FOR AUTO-ENTER DECISION
  // ==========================================

  const clinicA: StaffClinicMembershipIdentity = {
    membership_id: "mem-1",
    staff_id: "staff-1",
    clinic_id: "clinic-A",
    clinic_code: "HP01",
    clinic_name: "Hồng Phúc",
    organization_id: "org-1",
    is_primary: true,
    timezone: "Asia/Ho_Chi_Minh",
  };

  const clinicB: StaffClinicMembershipIdentity = {
    membership_id: "mem-2",
    staff_id: "staff-1",
    clinic_id: "clinic-B",
    clinic_code: "MD01",
    clinic_name: "Minh Đức",
    organization_id: "org-1",
    is_primary: false,
    timezone: "Asia/Ho_Chi_Minh",
  };

  // CLSEL-PREF-8: Zero authorized clinics -> deny / no-clinic state
  const case8 = evaluateAutoEnterDecision([], null);
  assert.equal(case8.shouldAutoEnter, false, "CLSEL-PREF-8: 0 clinics does not auto-enter");
  assert.equal(case8.targetClinicId, null, "CLSEL-PREF-8: targetClinicId is null");

  // CLSEL-PREF-7: Exactly 1 authorized clinic -> auto-enter regardless of stale preference to another clinic
  const case7 = evaluateAutoEnterDecision([clinicA], "stale-clinic-X");
  assert.equal(case7.shouldAutoEnter, true, "CLSEL-PREF-7: 1 clinic auto-enters");
  assert.equal(case7.targetClinicId, "clinic-A", "CLSEL-PREF-7: target is the single authorized clinic");

  // CLSEL-PREF-4: Multiple clinics with valid remembered preference -> auto-enters remembered clinic
  const case4 = evaluateAutoEnterDecision([clinicA, clinicB], "clinic-B");
  assert.equal(case4.shouldAutoEnter, true, "CLSEL-PREF-4: valid preference auto-enters");
  assert.equal(case4.targetClinicId, "clinic-B", "CLSEL-PREF-4: target is clinic-B");

  // CLSEL-PREF-5: Preference for Clinic B but membership B revoked/missing -> fallback to selection UI
  const case5 = evaluateAutoEnterDecision([clinicA], "clinic-B");
  assert.equal(case5.shouldAutoEnter, true, "1 remaining clinic still auto-enters");
  assert.equal(case5.targetClinicId, "clinic-A");

  // If multiple clinics remain but preference was revoked:
  const clinicC: StaffClinicMembershipIdentity = {
    ...clinicB,
    membership_id: "mem-3",
    clinic_id: "clinic-C",
    clinic_code: "PN01",
    clinic_name: "Phúc Nguyên",
  };
  const case5Multi = evaluateAutoEnterDecision([clinicA, clinicC], "clinic-B");
  assert.equal(case5Multi.shouldAutoEnter, false, "CLSEL-PREF-5: Revoked preference does NOT auto-enter");
  assert.equal(case5Multi.targetClinicId, null, "CLSEL-PREF-5: Prompts for clinic selection");

  // CLSEL-PREF-6: Multiple clinics with no preference -> show selection page
  const case6 = evaluateAutoEnterDecision([clinicA, clinicC], null);
  assert.equal(case6.shouldAutoEnter, false, "CLSEL-PREF-6: No preference shows selection page");
  assert.equal(case6.targetClinicId, null, "CLSEL-PREF-6: null target");

  console.log("All Clinic Selection UX Tests PASSED!");
}
