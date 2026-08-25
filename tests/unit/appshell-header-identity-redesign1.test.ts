import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";

export function runAppshellHeaderIdentityRedesign1Tests() {
  console.log("Running APPSHELL-HEADER-IDENTITY-REDESIGN1 Tests...");

  const sidebarPath = path.join(process.cwd(), "src", "components", "layout", "Sidebar.tsx");
  const headerPath = path.join(process.cwd(), "src", "components", "layout", "Header.tsx");
  const appShellPath = path.join(process.cwd(), "src", "components", "layout", "AppShell.tsx");
  const clientAppLayoutPath = path.join(process.cwd(), "src", "components", "layout", "ClientAppLayout.tsx");
  const patientDetailPagePath = path.join(process.cwd(), "src", "app", "patients", "[id]", "page.tsx");

  assert.ok(fs.existsSync(sidebarPath), "Sidebar.tsx exists");
  assert.ok(fs.existsSync(headerPath), "Header.tsx exists");
  assert.ok(fs.existsSync(appShellPath), "AppShell.tsx exists");
  assert.ok(fs.existsSync(clientAppLayoutPath), "ClientAppLayout.tsx exists");
  assert.ok(fs.existsSync(patientDetailPagePath), "Patient detail page.tsx exists");

  const sidebarCode = fs.readFileSync(sidebarPath, "utf-8");
  const headerCode = fs.readFileSync(headerPath, "utf-8");
  const appShellCode = fs.readFileSync(appShellPath, "utf-8");
  const clientAppLayoutCode = fs.readFileSync(clientAppLayoutPath, "utf-8");
  const patientDetailCode = fs.readFileSync(patientDetailPagePath, "utf-8");

  // 1. SHELL-HDR-1 & SHELL-HDR-8: Drawer Staff footer removed from Sidebar.tsx
  assert.ok(
    !sidebarCode.includes("Dropdown") && !sidebarCode.includes("secondaryLabel"),
    "Sidebar.tsx does not contain bottom Staff identity footer or account dropdown (SHELL-HDR-1, SHELL-HDR-8)"
  );

  // 2. SHELL-HDR-2: Hamburger is first/far-left Header control
  assert.ok(
    headerCode.includes("onOpenNav") && headerCode.includes("MenuOutlined"),
    "Header.tsx renders MenuOutlined hamburger trigger as far-left control (SHELL-HDR-2)"
  );

  // 3. SHELL-HDR-3: ArrowLeft back control rendered when backHref is provided
  assert.ok(
    headerCode.includes("backHref") && headerCode.includes("ArrowLeftOutlined"),
    "Header.tsx renders ArrowLeftOutlined back button when backHref is provided (SHELL-HDR-3)"
  );
  assert.ok(
    appShellCode.includes("backHref?: string") && clientAppLayoutCode.includes("backHref"),
    "AppShell and ClientAppLayout forward backHref to Header (SHELL-HDR-3)"
  );

  // 4. SHELL-HDR-4: Breadcrumb / title hierarchy in Header
  assert.ok(
    headerCode.includes("{title}") && headerCode.includes("{subtitle}"),
    "Header.tsx renders title and subtitle with proper hierarchy (SHELL-HDR-4)"
  );

  // 5. SHELL-HDR-5: Standalone "Đăng xuất" button removed from Header
  assert.ok(
    !headerCode.includes("<LogoutButton"),
    "Header.tsx does not contain standalone LogoutButton (SHELL-HDR-5)"
  );

  // 6. SHELL-HDR-6 & SHELL-HDR-7: Staff identity dropdown on Header right
  assert.ok(
    headerCode.includes("currentStaff?.full_name") &&
      headerCode.includes("initials") &&
      headerCode.includes("roleLabel"),
    "Header.tsx renders dynamic Staff identity with initials and role label (SHELL-HDR-6)"
  );
  assert.ok(
    headerCode.includes("LogoutOutlined") &&
      headerCode.includes("signOutAction") &&
      headerCode.includes("profileMenuItems"),
    "Header.tsx profile dropdown includes Logout option calling signOutAction (SHELL-HDR-7)"
  );

  // 7. SHELL-HDR-9: Redundant 'Quay Lại Danh Sách' removed in favor of backHref
  assert.ok(
    !patientDetailCode.includes("Quay Lại Danh Sách") &&
      patientDetailCode.includes('backHref="/patients"'),
    "Patient detail page uses backHref='/patients' and omits duplicate 'Quay Lại Danh Sách' button (SHELL-HDR-9)"
  );

  // 8. SHELL-HDR-11: Live Clock preserved
  assert.ok(
    headerCode.includes("ClockCircleOutlined") && headerCode.includes("timeStr"),
    "Header.tsx preserves realtime live clock (SHELL-HDR-11)"
  );

  console.log("All APPSHELL-HEADER-IDENTITY-REDESIGN1 Tests PASSED!");
}
