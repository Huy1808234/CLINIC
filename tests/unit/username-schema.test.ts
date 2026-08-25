import fs from "fs";
import path from "path";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

// Canonical username validation regex matching the database CHECK constraint:
// ^[a-z0-9][a-z0-9._-]{2,31}$ (3-32 characters, lowercase alphanumeric with dots, underscores, hyphens)
export const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function isValidUsername(username: string | null | undefined): boolean {
  if (username === null || username === undefined) return true; // Nullable
  return USERNAME_REGEX.test(username);
}

export function runUsernameSchemaTests() {
  console.log("Running Canonical Username Schema Unit Tests...");

  // USERNAME-SCHEMA-1: Existing Staff rows remain valid with login_username = NULL
  assert(isValidUsername(null) === true, "CASE 1: login_username = NULL must be allowed for existing staff");
  assert(isValidUsername(undefined) === true, "CASE 1b: login_username = undefined must be allowed");

  // USERNAME-SCHEMA-2: Valid: bs.anhthu
  assert(isValidUsername("bs.anhthu") === true, "CASE 2: 'bs.anhthu' must be valid");

  // USERNAME-SCHEMA-3: Valid: ys_thao
  assert(isValidUsername("ys_thao") === true, "CASE 3: 'ys_thao' must be valid");

  // USERNAME-SCHEMA-4: Valid: letan-01
  assert(isValidUsername("letan-01") === true, "CASE 4: 'letan-01' must be valid");

  // USERNAME-SCHEMA-5: Reject uppercase: BS.AnhThu
  assert(isValidUsername("BS.AnhThu") === false, "CASE 5: Uppercase characters must be rejected");
  assert(isValidUsername("bs.AnhThu") === false, "CASE 5b: Mixed case characters must be rejected");

  // USERNAME-SCHEMA-6: Reject spaces: bs anhthu
  assert(isValidUsername("bs anhthu") === false, "CASE 6: Spaces must be rejected");
  assert(isValidUsername(" bs.anhthu") === false, "CASE 6b: Leading spaces must be rejected");
  assert(isValidUsername("bs.anhthu ") === false, "CASE 6c: Trailing spaces must be rejected");

  // USERNAME-SCHEMA-7: Reject invalid symbols: bs@anhthu
  assert(isValidUsername("bs@anhthu") === false, "CASE 7: '@' symbol must be rejected");
  assert(isValidUsername("bs#anhthu") === false, "CASE 7b: '#' symbol must be rejected");
  assert(isValidUsername("bs$anhthu") === false, "CASE 7c: '$' symbol must be rejected");
  assert(isValidUsername("bs!anhthu") === false, "CASE 7d: '!' symbol must be rejected");
  assert(isValidUsername(".bs.anhthu") === false, "CASE 7e: Leading dot must be rejected");
  assert(isValidUsername("_bs.anhthu") === false, "CASE 7f: Leading underscore must be rejected");
  assert(isValidUsername("-bs.anhthu") === false, "CASE 7g: Leading hyphen must be rejected");

  // USERNAME-SCHEMA-8: Reject too-short username
  assert(isValidUsername("bs") === false, "CASE 8: 2-character username must be rejected (min 3)");
  assert(isValidUsername("a") === false, "CASE 8b: 1-character username must be rejected (min 3)");
  assert(isValidUsername("a".repeat(33)) === false, "CASE 8c: 33-character username must be rejected (max 32)");
  assert(isValidUsername("a".repeat(32)) === true, "CASE 8d: 32-character username must be accepted");
  assert(isValidUsername("abc") === true, "CASE 8e: 3-character username must be accepted");

  // USERNAME-SCHEMA-9 & 10: In-memory simulation of unique constraint and multiple NULLs
  interface MockStaffRecord {
    id: string;
    staff_code: string;
    email: string | null;
    user_id: string | null;
    auth_setup_required: boolean;
    auth_setup_completed_at: string | null;
    login_username: string | null;
  }

  const staffDb: MockStaffRecord[] = [
    {
      id: "s-1",
      staff_code: "BS-01",
      email: "bs01@thuanthien.vn",
      user_id: "u-1",
      auth_setup_required: false,
      auth_setup_completed_at: "2026-08-20T00:00:00Z",
      login_username: null,
    },
    {
      id: "s-2",
      staff_code: "BS-02",
      email: "bs02@thuanthien.vn",
      user_id: null,
      auth_setup_required: false,
      auth_setup_completed_at: null,
      login_username: null,
    },
  ];

  // USERNAME-SCHEMA-10: Allow multiple NULL values
  assert(
    staffDb.filter((s) => s.login_username === null).length === 2,
    "CASE 10: Multiple staff rows with login_username = NULL are valid"
  );

  // USERNAME-SCHEMA-9: Reject duplicate non-null login_username
  function assignUsername(staffId: string, username: string | null): { success: boolean; error?: string } {
    if (username !== null && !isValidUsername(username)) {
      return { success: false, error: "FORMAT_VIOLATION" };
    }
    if (username !== null) {
      const existing = staffDb.find((s) => s.login_username === username && s.id !== staffId);
      if (existing) {
        return { success: false, error: "UNIQUE_VIOLATION" };
      }
    }
    const staff = staffDb.find((s) => s.id === staffId);
    if (!staff) return { success: false, error: "NOT_FOUND" };
    staff.login_username = username;
    return { success: true };
  }

  const res1 = assignUsername("s-1", "bs.anhthu");
  assert(res1.success === true, "Assigning unique username must succeed");

  const res2 = assignUsername("s-2", "bs.anhthu");
  assert(res2.success === false && res2.error === "UNIQUE_VIOLATION", "CASE 9: Duplicate non-null login_username must be rejected");

  // USERNAME-SCHEMA-11, 12, 13, 14: Inspect static migration SQL for preservation
  const migrationPath = path.join(process.cwd(), "supabase", "migrations", "20260822000028_staff_login_username.sql");
  assert(fs.existsSync(migrationPath), "Migration 28 file must exist");

  const migrationSql = fs.readFileSync(migrationPath, "utf-8");

  // Verify migration ONLY touches login_username
  assert(migrationSql.includes("login_username TEXT NULL"), "CASE 11-14: Migration adds login_username TEXT NULL");
  assert(!migrationSql.includes("UPDATE public.staff"), "CASE 11-14: Migration must not update existing staff data");
  assert(!migrationSql.includes("staff.email"), "CASE 11: Migration must not modify staff.email");
  assert(!migrationSql.includes("auth.users"), "CASE 12: Migration must not touch auth.users");
  assert(!migrationSql.includes("auth_setup_required"), "CASE 13: Migration must not touch auth_setup_required");
  assert(!migrationSql.includes("auth_setup_completed_at"), "CASE 14: Migration must not touch auth_setup_completed_at");

  // USERNAME-SCHEMA-15: No anonymous directory lookup RLS policy
  assert(!migrationSql.includes("CREATE POLICY"), "CASE 15: Migration must not add anonymous RLS policies");
  assert(!migrationSql.toLowerCase().includes("to anon") && !migrationSql.toLowerCase().includes("grant"), "CASE 15b: Migration must not grant anon access");

  console.log("All Canonical Username Schema Unit Tests PASSED!");
}
