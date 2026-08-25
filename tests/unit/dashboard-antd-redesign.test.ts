import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { isRouteVisibleForRoles, NAVIGATION_ROUTE_ACCESS } from "@/lib/auth/shell-identity";
import type { ClinicRoleCode } from "@/types/clinic";

export function runDashboardAntdRedesignTests() {
  console.log("Running Dashboard Home Redesign & Content Width Contract Tests...");

  const pagePath = path.join(process.cwd(), "src", "app", "page.tsx");
  const viewPath = path.join(process.cwd(), "src", "components", "dashboard", "DashboardClientView.tsx");
  const statsCardPath = path.join(process.cwd(), "src", "components", "reception", "ReceptionStatsCards.tsx");

  assert.equal(fs.existsSync(pagePath), true, "src/app/page.tsx exists");
  assert.equal(fs.existsSync(viewPath), true, "DashboardClientView.tsx exists");
  assert.equal(fs.existsSync(statsCardPath), true, "ReceptionStatsCards.tsx exists");

  const pageCode = fs.readFileSync(pagePath, "utf-8");
  const viewCode = fs.readFileSync(viewPath, "utf-8");
  const statsCode = fs.readFileSync(statsCardPath, "utf-8");

  // DASH-UI-1 & DASH-UI-2: Dynamic Staff & Clinic greeting
  assert.equal(
    viewCode.includes("Xin chào, {staff.full_name}!") &&
      viewCode.includes("{clinic.clinic_name}"),
    true,
    "Dynamic staff and active clinic name rendered in greeting (DASH-UI-1, DASH-UI-2)"
  );

  // DASH-UI-3: No Next.js & Supabase technical stack wording in page or view
  assert.equal(
    pageCode.includes("Next.js & Supabase") ||
      pageCode.includes("Phiên bản chuẩn hóa Next.js") ||
      viewCode.includes("Next.js & Supabase") ||
      viewCode.includes("Phiên bản chuẩn hóa Next.js"),
    false,
    "Technical stack wording removed from user-facing production UI (DASH-UI-3)"
  );

  // DASH-UI-4 & DASH-UI-5: Real statistics query and stats binding
  assert.equal(
    pageCode.includes("getReceptionStats()") && pageCode.includes("<DashboardClientView"),
    true,
    "Four operational stats remain data-backed from getReceptionStats (DASH-UI-4)"
  );

  assert.equal(
    statsCode.includes("stats.total_today") &&
      statsCode.includes("stats.new_patients_today") &&
      statsCode.includes("stats.returning_patients_today") &&
      statsCode.includes("stats.waiting_exam_count + stats.in_treatment_count"),
    true,
    "Stats cards map directly to live stats object without hardcoded numbers (DASH-UI-5)"
  );

  // DASH-WIDTH-1, DASH-WIDTH-2, DASH-WIDTH-3, DASH-WIDTH-4: Wide canonical content rail
  assert.equal(
    viewCode.includes("max-w-[1560px]") && viewCode.includes("w-full"),
    true,
    "Dashboard uses wide 1560px canonical content rail (DASH-WIDTH-1, DASH-WIDTH-3)"
  );

  // DASH-WIDTH-5: Stats cards expand naturally with 20px gutter
  assert.equal(
    statsCode.includes("gutter={[20, 20]}") && statsCode.includes("xl={6}"),
    true,
    "Stats cards use 4-column responsive grid with balanced 20px gutter (DASH-WIDTH-5)"
  );

  // DASH-WIDTH-6 & DASH-WIDTH-7: Module cards use 2-column grid and full width without fixed pixel width
  assert.equal(
    viewCode.includes("grid-cols-1 md:grid-cols-2") && !viewCode.includes("width: 650px"),
    true,
    "Module cards use 2-column responsive grid and fill column width (DASH-WIDTH-6, DASH-WIDTH-7)"
  );

  // DASH-UI-6 & DASH-UI-8: Module visibility derived from centralized role authorization
  assert.equal(
    viewCode.includes("isRouteVisibleForRoles(mod.href, activeRoles)"),
    true,
    "Dashboard modules are filtered using centralized isRouteVisibleForRoles (DASH-UI-6, DASH-UI-8)"
  );

  // DASH-UI-7, DASH-UI-10, DASH-UI-11, DASH-UI-12, DASH-UI-13: Valid canonical routes
  const expectedRoutes = ["/reception", "/schedule", "/patients", "/staff", "/migration"];
  for (const route of expectedRoutes) {
    assert.equal(
      viewCode.includes(`href: "${route}"`),
      true,
      `Expected canonical route "${route}" exists in module config (DASH-UI-7)`
    );
    assert.equal(
      NAVIGATION_ROUTE_ACCESS.some((n) => n.href === route),
      true,
      `Route "${route}" is a registered navigation route in NAVIGATION_ROUTE_ACCESS`
    );
  }

  // DASH-UI-8 & DASH-UI-9: Role authorization logic verification
  const doctorRoles: ClinicRoleCode[] = ["DOCTOR"];
  assert.equal(
    isRouteVisibleForRoles("/schedule", doctorRoles),
    true,
    "Doctor can see /schedule"
  );
  assert.equal(
    isRouteVisibleForRoles("/reception", doctorRoles),
    false,
    "Doctor without RECEPTIONIST/ADMIN cannot see /reception (DASH-UI-8)"
  );
  assert.equal(
    isRouteVisibleForRoles("/migration", doctorRoles),
    false,
    "Doctor cannot see /migration (DASH-UI-13)"
  );

  // Multi-role UNION: Doctor + Receptionist
  const doctorReceptionistRoles: ClinicRoleCode[] = ["DOCTOR", "RECEPTIONIST"];
  assert.equal(
    isRouteVisibleForRoles("/reception", doctorReceptionistRoles),
    true,
    "Multi-role UNION allows /reception (DASH-UI-9)"
  );
  assert.equal(
    isRouteVisibleForRoles("/schedule", doctorReceptionistRoles),
    true,
    "Multi-role UNION allows /schedule (DASH-UI-9)"
  );

  // DASH-UI-14 & DASH-UI-15: Global shell architecture preserved (no permanent sidebar)
  const appShellPath = path.join(process.cwd(), "src", "components", "layout", "AppShell.tsx");
  const appShellCode = fs.readFileSync(appShellPath, "utf-8");
  assert.equal(
    appShellCode.includes("ClientAppLayout"),
    true,
    "AppShell uses ClientAppLayout (DASH-UI-14, DASH-UI-15)"
  );

  // DASH-UI-17: Clean minimal footer without fake hotline/version
  assert.equal(
    viewCode.includes("1900") || viewCode.includes("v1.0.0"),
    false,
    "No fake contact/version data in footer (DASH-UI-17)"
  );

  console.log("All Dashboard Home Redesign & Content Width Tests PASSED!");
}
