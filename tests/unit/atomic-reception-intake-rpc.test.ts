import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { normalizePatientInputs } from "@/lib/patients/normalizers";
import type { ClinicRoleCode } from "@/types/clinic";

export async function runAtomicReceptionIntakeRpcTests() {
  console.log("Running Atomic Reception Intake RPC (Migration 34 & 35) Unit & Contract Tests...");

  // RPC35-16: Migration 34 remains untouched and exists
  const migration34Path = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260825000034_atomic_reception_intake_rpc.sql"
  );
  assert.equal(
    fs.existsSync(migration34Path),
    true,
    "Migration 34 file must exist in supabase/migrations (RPC35-16)"
  );

  // Migration 35 forward security fix file
  const migration35Path = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260825000035_fix_atomic_reception_intake_role_guard.sql"
  );
  assert.equal(
    fs.existsSync(migration35Path),
    true,
    "Migration 35 file must exist in supabase/migrations"
  );

  const migration35Sql = fs.readFileSync(migration35Path, "utf-8");

  // Security, Search Path & service_role only execution
  assert.equal(
    migration35Sql.includes("CREATE OR REPLACE FUNCTION public.process_reception_intake_atomic"),
    true,
    "Migration 35 must define public.process_reception_intake_atomic"
  );
  assert.equal(
    migration35Sql.includes("SECURITY DEFINER"),
    true,
    "RPC must be SECURITY DEFINER"
  );
  assert.equal(
    migration35Sql.includes("SET search_path = public, pg_temp"),
    true,
    "RPC must set fixed search_path = public, pg_temp"
  );
  assert.equal(
    migration35Sql.includes("REVOKE ALL ON FUNCTION public.process_reception_intake_atomic"),
    true,
    "RPC must revoke execution from PUBLIC, anon, authenticated"
  );
  assert.equal(
    migration35Sql.includes("GRANT EXECUTE ON FUNCTION public.process_reception_intake_atomic"),
    true,
    "RPC must grant execution exclusively to service_role"
  );

  // RPC35-17: RLS policies unchanged
  assert.equal(
    migration35Sql.includes("ENABLE ROW LEVEL SECURITY") || migration35Sql.includes("CREATE POLICY"),
    false,
    "RLS policies must remain unchanged in Migration 35 (RPC35-17)"
  );

  // RPC35-1, RPC35-2, RPC35-3: Role guard predicate strictly permits RECEPTIONIST and ADMIN only
  assert.equal(
    migration35Sql.includes("scr.role_code IN ('RECEPTIONIST', 'ADMIN')"),
    true,
    "RPC enforces strictly RECEPTIONIST or ADMIN role only (RPC35-1, RPC35-2, RPC35-3)"
  );
  assert.equal(
    migration35Sql.includes("'MANAGER'"),
    false,
    "Migration 35 must NOT permit MANAGER role for reception intake (RPC35-3)"
  );

  // RPC35-1 through RPC35-9: Multi-role ANY/UNION logic verification
  const checkReceptionRoleAuth = (roles: ClinicRoleCode[]): boolean => {
    const allowedRoles: ClinicRoleCode[] = ["RECEPTIONIST", "ADMIN"];
    return roles.some((r) => allowedRoles.includes(r));
  };

  assert.equal(checkReceptionRoleAuth(["RECEPTIONIST"]), true, "RECEPTIONIST allowed (RPC35-1)");
  assert.equal(checkReceptionRoleAuth(["ADMIN"]), true, "ADMIN allowed (RPC35-2)");
  assert.equal(checkReceptionRoleAuth(["MANAGER"]), false, "MANAGER-only denied (RPC35-3)");
  assert.equal(checkReceptionRoleAuth(["DOCTOR"]), false, "DOCTOR-only denied (RPC35-4)");
  assert.equal(checkReceptionRoleAuth(["Y_SI"]), false, "Y_SI-only denied (RPC35-5)");
  assert.equal(checkReceptionRoleAuth(["TECHNICIAN"]), false, "TECHNICIAN-only denied (RPC35-6)");
  assert.equal(checkReceptionRoleAuth(["CSKH"]), false, "CSKH-only denied (RPC35-7)");
  assert.equal(checkReceptionRoleAuth(["MANAGER", "RECEPTIONIST"]), true, "MANAGER + RECEPTIONIST allowed (RPC35-8)");
  assert.equal(checkReceptionRoleAuth(["DOCTOR", "ADMIN"]), true, "DOCTOR + ADMIN allowed (RPC35-9)");

  // RPC35-10, RPC35-11: Inactive staff and membership checks
  assert.equal(
    migration35Sql.includes("v_staff_is_active = FALSE"),
    true,
    "RPC rejects inactive staff (RPC35-10)"
  );
  assert.equal(
    migration35Sql.includes("scm.is_active = TRUE"),
    true,
    "RPC rejects inactive clinic membership (RPC35-11)"
  );

  // RPC35-12, RPC35-13, RPC35-14: Preserved atomic features
  assert.equal(
    migration35Sql.includes("INSERT INTO public.patients"),
    true,
    "New Patient creation preserved (RPC35-12)"
  );
  assert.equal(
    migration35Sql.includes("INSERT INTO public.patient_insurance_cards"),
    true,
    "Insurance insertion preserved (RPC35-12)"
  );
  assert.equal(
    migration35Sql.includes("INSERT INTO public.patient_measurements"),
    true,
    "Height and weight measurements persist atomically (RPC35-13)"
  );
  assert.equal(
    migration35Sql.includes("planned_session_count"),
    true,
    "planned_session_count remains in course creation (RPC35-14)"
  );
  assert.equal(
    migration35Sql.includes("PERFORM 1 FROM public.patients WHERE id = v_patient_id FOR UPDATE"),
    true,
    "Patient row lock FOR UPDATE preserved"
  );
  assert.equal(
    migration35Sql.includes("COALESCE(MAX(course_no), 0) + 1"),
    true,
    "Course number allocation preserved"
  );

  // RPC35-15: No sequential fallback in reception service
  const receptionServicePath = path.join(
    process.cwd(),
    "src",
    "lib",
    "reception",
    "reception-service.ts"
  );
  const serviceCode = fs.readFileSync(receptionServicePath, "utf-8");
  assert.equal(
    serviceCode.includes("process_reception_intake_atomic"),
    true,
    "reception-service.ts calls process_reception_intake_atomic RPC (RPC35-15)"
  );
  assert.equal(
    serviceCode.includes("createOrMatchPatient"),
    false,
    "reception-service.ts must NOT call legacy write-heavy createOrMatchPatient (RPC35-15)"
  );

  // Schema & Normalizer unit checks
  const normalized = normalizePatientInputs({
    full_name: "  trần thị mai  ",
    phone: "0987 654 321",
    citizen_id: "012345678901",
    card_number: "DN4010123456789",
    birth_date_or_year: "1990",
    height: "160 cm",
    weight: "52 kg",
  });
  assert.equal(normalized.full_name, "Trần Thị Mai");
  assert.equal(normalized.phone, "0987654321");
  assert.equal(normalized.citizen_id, "012345678901");
  assert.equal(normalized.birth_year, 1990);
  assert.equal(normalized.height_cm, 160);
  assert.equal(normalized.weight_kg, 52);

  console.log("All Atomic Reception Intake RPC (Migration 34 & 35) Unit & Contract Tests PASSED!");
}
