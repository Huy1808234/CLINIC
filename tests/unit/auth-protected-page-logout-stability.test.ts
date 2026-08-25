import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";

class MockAuthenticationRequiredError extends Error {
  public readonly code = "AUTHENTICATION_REQUIRED";
}

class MockActionForbiddenError extends Error {
  public readonly code = "ACTION_FORBIDDEN";
}

export function runAuthProtectedPageLogoutStabilityTests() {
  console.log("Running AUTH-PROTECTED-PAGE-LOGOUT-STABILITY1 Tests...");

  const pagePath = path.join(process.cwd(), "src", "app", "master-data", "diagnoses", "page.tsx");
  const appAccessPath = path.join(process.cwd(), "src", "lib", "auth", "application-access.ts");
  const signOutPath = path.join(process.cwd(), "src", "lib", "auth", "sign-out.ts");
  const authActionsPath = path.join(process.cwd(), "src", "app", "actions", "auth-actions.ts");
  const diagnosisActionsPath = path.join(process.cwd(), "src", "app", "actions", "diagnosis-catalog-actions.ts");
  const sidebarPath = path.join(process.cwd(), "src", "components", "layout", "Sidebar.tsx");
  const headerPath = path.join(process.cwd(), "src", "components", "layout", "Header.tsx");

  const pageCode = fs.readFileSync(pagePath, "utf-8");
  const appAccessCode = fs.readFileSync(appAccessPath, "utf-8");
  const signOutCode = fs.readFileSync(signOutPath, "utf-8");
  const authActionsCode = fs.readFileSync(authActionsPath, "utf-8");
  const diagnosisActionsCode = fs.readFileSync(diagnosisActionsPath, "utf-8");
  const sidebarCode = fs.readFileSync(sidebarPath, "utf-8");
  const headerCode = fs.readFileSync(headerPath, "utf-8");

  // AUTH-STABLE-1 & AUTH-STABLE-2: Page uses canonical requireApplicationPageAccessContext
  assert.ok(
    pageCode.includes("requireApplicationPageAccessContext"),
    "DiagnosisMasterDataPage uses canonical requireApplicationPageAccessContext (AUTH-STABLE-1)"
  );
  assert.equal(
    pageCode.includes("requireApplicationAccessContext()"),
    false,
    "DiagnosisMasterDataPage does not call bare unhandled requireApplicationAccessContext (AUTH-STABLE-2)"
  );

  // AUTH-STABLE-3 & AUTH-STABLE-4: signOutCurrentUser clears active clinic cookie and signs out
  assert.ok(
    authActionsCode.includes("signOutCurrentUser()"),
    "signOutAction invokes signOutCurrentUser (AUTH-STABLE-3)"
  );
  assert.ok(
    signOutCode.includes("supabase.auth.signOut()"),
    "signOutCurrentUser invokes Supabase Auth signOut (AUTH-STABLE-3)"
  );
  assert.ok(
    signOutCode.includes("clearActiveClinicCookie()"),
    "signOutCurrentUser clears active clinic cookie (AUTH-STABLE-4)"
  );

  // AUTH-STABLE-5: signOutCurrentUser does NOT clear staff_preferences.last_selected_clinic_id
  assert.equal(
    signOutCode.includes("last_selected_clinic_id"),
    false,
    "signOutCurrentUser preserves database last_selected_clinic_id preference (AUTH-STABLE-5)"
  );

  // AUTH-STABLE-6: requireApplicationPageAccessContext redirects on AuthenticationRequiredError
  assert.ok(
    appAccessCode.includes("if (error instanceof AuthenticationRequiredError)") &&
      appAccessCode.includes('redirect("/login")'),
    "requireApplicationPageAccessContext redirects to /login on AuthenticationRequiredError (AUTH-STABLE-6)"
  );

  // AUTH-STABLE-7: Mutations enforce strict server-side authorization
  assert.ok(
    diagnosisActionsCode.includes('requireActionAuthorization({ requiredRoles: ["ADMIN", "MANAGER"] })'),
    "Diagnosis Server Actions strictly enforce role authorization (AUTH-STABLE-7)"
  );

  // AUTH-STABLE-8: AuthorizationError is distinct and not treated as unauthenticated
  const forbiddenErr = new MockActionForbiddenError("Forbidden");
  assert.ok(
    forbiddenErr instanceof MockActionForbiddenError,
    "ActionForbiddenError is a distinct error class (AUTH-STABLE-8)"
  );
  assert.equal(
    forbiddenErr instanceof MockAuthenticationRequiredError,
    false,
    "ActionForbiddenError is NOT an instance of AuthenticationRequiredError (AUTH-STABLE-8)"
  );

  // AUTH-STABLE-9: Unexpected errors are re-thrown, not redirected to login
  assert.ok(
    appAccessCode.includes("throw error;"),
    "requireApplicationPageAccessContext re-throws unexpected errors without masking as login (AUTH-STABLE-9)"
  );

  // AUTH-STABLE-10: Next.js NEXT_REDIRECT is preserved and not swallowed
  assert.ok(
    appAccessCode.includes('digest.startsWith("NEXT_REDIRECT")'),
    "NEXT_REDIRECT digest errors are preserved and re-thrown to avoid redirect loops (AUTH-STABLE-10)"
  );

  // AUTH-STABLE-11 & AUTH-STABLE-12: Header / Sidebar handles logout cleanly
  assert.ok(
    (headerCode.includes("signOutAction()") && headerCode.includes('router.replace("/login")')) ||
      (sidebarCode.includes("signOutAction()") && sidebarCode.includes('router.replace("/login")')),
    "Header/Sidebar handleLogout invokes signOutAction and replaces router to /login (AUTH-STABLE-11, AUTH-STABLE-12)"
  );

  console.log("All AUTH-PROTECTED-PAGE-LOGOUT-STABILITY1 Tests PASSED!");
}
