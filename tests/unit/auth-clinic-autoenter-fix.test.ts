import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { evaluateAutoEnterDecision } from "@/lib/auth/staff-preferences";
import type { StaffClinicMembershipIdentity } from "@/lib/auth/clinic-resolver";

export function runAuthClinicAutoEnterFixTests() {
  console.log("Running Auth Clinic Auto-Enter Boundary & Invariant Tests...");

  const pagePath = path.join(process.cwd(), "src", "app", "select-clinic", "page.tsx");
  const signInPath = path.join(process.cwd(), "src", "lib", "auth", "sign-in.ts");
  const actionsPath = path.join(process.cwd(), "src", "app", "actions", "auth-actions.ts");

  assert.equal(fs.existsSync(pagePath), true, "select-clinic/page.tsx exists");
  assert.equal(fs.existsSync(signInPath), true, "sign-in.ts exists");
  assert.equal(fs.existsSync(actionsPath), true, "auth-actions.ts exists");

  const pageCode = fs.readFileSync(pagePath, "utf-8");
  const signInCode = fs.readFileSync(signInPath, "utf-8");
  const actionsCode = fs.readFileSync(actionsPath, "utf-8");

  // CL-AUTO-FIX-1 & CL-AUTO-FIX-2: SelectClinicPage does NOT mutate cookies during render
  assert.equal(
    pageCode.includes("setActiveClinicCookie") || pageCode.includes("cookies().set"),
    false,
    "SelectClinicPage is strictly read-only and does not mutate cookies during render (CL-AUTO-FIX-1, CL-AUTO-FIX-2)"
  );

  // CL-AUTO-FIX-3 & CL-AUTO-FIX-4: Auto-enter is handled inside the signIn Server Action mutation boundary
  assert.equal(
    signInCode.includes("evaluateAutoEnterDecision") && signInCode.includes("setActiveClinicCookie"),
    true,
    "Auto-enter is evaluated and executed safely inside the signIn Server Action boundary (CL-AUTO-FIX-3, CL-AUTO-FIX-4)"
  );

  // CL-AUTO-FIX-8, CL-AUTO-FIX-9: Canonical setActiveClinicAction handles explicit selection & switching
  assert.equal(
    actionsCode.includes("export async function setActiveClinicAction"),
    true,
    "setActiveClinicAction is an exported Server Action mutation boundary (CL-AUTO-FIX-8, CL-AUTO-FIX-9)"
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

  // Case 1: Exactly 1 authorized clinic -> auto-enters that clinic (CL-AUTO-FIX-3)
  const res1 = evaluateAutoEnterDecision([clinicA], null);
  assert.equal(res1.shouldAutoEnter, true, "1 authorized clinic auto-enters");
  assert.equal(res1.targetClinicId, "clinic-A");

  // Case 2: Multiple clinics + valid remembered clinic -> auto-enters remembered clinic (CL-AUTO-FIX-4)
  const res2 = evaluateAutoEnterDecision([clinicA, clinicB], "clinic-B");
  assert.equal(res2.shouldAutoEnter, true, "Valid remembered preference auto-enters");
  assert.equal(res2.targetClinicId, "clinic-B");

  // Case 3: Multiple clinics + no preference -> shows selection page (CL-AUTO-FIX-5)
  const res3 = evaluateAutoEnterDecision([clinicA, clinicB], null);
  assert.equal(res3.shouldAutoEnter, false, "No preference prompts for selection");
  assert.equal(res3.targetClinicId, null);

  // Case 4: Remembered clinic is not in active memberships (inactive or revoked) -> shows selection page (CL-AUTO-FIX-6, CL-AUTO-FIX-7)
  const res4 = evaluateAutoEnterDecision([clinicA, clinicB], "revoked-clinic-X");
  assert.equal(res4.shouldAutoEnter, false, "Revoked preference falls back to selection");
  assert.equal(res4.targetClinicId, null);

  // Case 5: 0 authorized clinics -> does not auto-enter
  const res5 = evaluateAutoEnterDecision([], null);
  assert.equal(res5.shouldAutoEnter, false, "0 authorized clinics does not auto-enter");

  console.log("All Auth Clinic Auto-Enter Fix Tests PASSED!");
}
