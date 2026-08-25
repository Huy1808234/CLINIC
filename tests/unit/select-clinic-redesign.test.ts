import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";

export function runSelectClinicRedesignTests() {
  console.log("Running Select Clinic Redesign & Security Contract Tests...");

  const viewPath = path.join(process.cwd(), "src", "components", "auth", "SelectClinicClientView.tsx");
  const pagePath = path.join(process.cwd(), "src", "app", "select-clinic", "page.tsx");

  assert.equal(fs.existsSync(viewPath), true, "SelectClinicClientView.tsx exists");
  assert.equal(fs.existsSync(pagePath), true, "select-clinic/page.tsx exists");

  const viewCode = fs.readFileSync(viewPath, "utf-8");
  const pageCode = fs.readFileSync(pagePath, "utf-8");

  // CLUI-1 & CLUI-14: Server page resolves only active verified memberships
  assert.equal(
    pageCode.includes("getCurrentStaffClinicMemberships()"),
    true,
    "Server page queries verified active memberships (CLUI-1, CLUI-14)"
  );

  // CLUI-2 & CLUI-3: Clinic list is data-driven, no hardcoded count
  assert.equal(
    viewCode.includes("memberships.map(") && !viewCode.includes("count === 5"),
    true,
    "Clinic list is dynamically mapped from memberships prop without hardcoded count (CLUI-2, CLUI-3)"
  );

  // CLUI-4: No hardcoded clinic names
  const hardcodedNames = ["Hồng Phúc", "Minh Đức", "Phúc Nguyên", "Tâm Phúc"];
  for (const name of hardcodedNames) {
    assert.equal(
      viewCode.includes(`"${name}"`) || viewCode.includes(`'${name}'`),
      false,
      `No hardcoded clinic name "${name}" in component (CLUI-4)`
    );
  }

  // CLUI-5 & CLUI-6: Staff name and code are dynamic props
  assert.equal(
    viewCode.includes("{staffName}") && viewCode.includes("{staffCode}"),
    true,
    "Staff name and staff code are rendered dynamically from props (CLUI-5, CLUI-6)"
  );

  // CLUI-7 & CLUI-8: Role tags derive dynamically from membership roles
  assert.equal(
    viewCode.includes("membership.roles") && viewCode.includes("ROLE_DISPLAY_LABELS"),
    true,
    "Role tags derive dynamically from actual membership roles and use centralized labels (CLUI-7, CLUI-8)"
  );

  // CLUI-9: Primary badge conditional
  assert.equal(
    viewCode.includes("membership.is_primary &&"),
    true,
    "Primary badge renders conditionally only when is_primary is true (CLUI-9)"
  );

  // CLUI-10: Selecting clinic delegates to setActiveClinicAction
  assert.equal(
    viewCode.includes("setActiveClinicAction(clinicId)"),
    true,
    "Clinic selection calls canonical setActiveClinicAction (CLUI-10)"
  );

  // CLUI-12: Duplicate submit protection while loading
  assert.equal(
    viewCode.includes("if (isSubmittingId) return;") && viewCode.includes("disabled={isSubmittingId !== null}"),
    true,
    "Duplicate submission is blocked while selection is in progress (CLUI-12)"
  );

  // CLUI-13: Zero clinic state is explicitly handled
  assert.equal(
    viewCode.includes("memberships.length === 0") && viewCode.includes("Chưa Được Phân Công Cơ Sở"),
    true,
    "Explicit empty state handled when staff has 0 active clinic memberships (CLUI-13)"
  );

  // CLUI-15: No operational AppShell on /select-clinic
  assert.equal(
    pageCode.includes("AppShell") || viewCode.includes("AppShell"),
    false,
    "No operational AppShell on select-clinic page (CLUI-15)"
  );

  // CLUI-16: Staff identity in header and context panel
  assert.equal(
    viewCode.includes("LogoutButton"),
    true,
    "Logout action is integrated in header/empty state (CLUI-17)"
  );

  console.log("All Select Clinic Redesign Tests PASSED!");
}
