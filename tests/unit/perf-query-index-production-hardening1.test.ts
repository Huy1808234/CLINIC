import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";

export function runPerfQueryIndexProductionHardening1Tests() {
  console.log("Running PERF-QUERY-INDEX-PRODUCTION-HARDENING1 Tests...");

  const authResolverPath = path.join(process.cwd(), "src", "lib", "auth", "auth-resolver.ts");
  const staffResolverPath = path.join(process.cwd(), "src", "lib", "auth", "staff-resolver.ts");
  const clinicResolverPath = path.join(process.cwd(), "src", "lib", "auth", "clinic-resolver.ts");
  const clinicContextPath = path.join(process.cwd(), "src", "lib", "auth", "clinic-context.ts");
  const roleResolverPath = path.join(process.cwd(), "src", "lib", "auth", "role-resolver.ts");
  const appAccessPath = path.join(process.cwd(), "src", "lib", "auth", "application-access.ts");

  const patientHistoryPath = path.join(process.cwd(), "src", "rsc-data", "patients", "get-patient-history.ts");
  const patientProfilePath = path.join(process.cwd(), "src", "rsc-data", "patients", "get-patient.ts");
  const searchPatientsPath = path.join(process.cwd(), "src", "rsc-data", "patients", "search-patients.ts");
  const receptionsPath = path.join(process.cwd(), "src", "rsc-data", "reception", "get-receptions.ts");
  const receptionStatsPath = path.join(process.cwd(), "src", "rsc-data", "reception", "get-reception-stats.ts");
  const daySchedulePath = path.join(process.cwd(), "src", "rsc-data", "schedule", "get-day-schedule.ts");
  const monthSchedulePath = path.join(process.cwd(), "src", "rsc-data", "schedule", "get-month-schedule.ts");
  const staffPath = path.join(process.cwd(), "src", "rsc-data", "staff", "get-staff.ts");
  const catalogsPath = path.join(process.cwd(), "src", "rsc-data", "treatment", "get-catalogs.ts");
  const diagServicePath = path.join(process.cwd(), "src", "lib", "master-data", "diagnosis-catalog-service.ts");
  const homePagePath = path.join(process.cwd(), "src", "app", "page.tsx");
  const migration41Path = path.join(process.cwd(), "supabase", "migrations", "20260825000041_production_performance_indexes.sql");

  // Verify file existence
  assert.ok(fs.existsSync(authResolverPath), "auth-resolver.ts exists");
  assert.ok(fs.existsSync(staffResolverPath), "staff-resolver.ts exists");
  assert.ok(fs.existsSync(clinicResolverPath), "clinic-resolver.ts exists");
  assert.ok(fs.existsSync(clinicContextPath), "clinic-context.ts exists");
  assert.ok(fs.existsSync(roleResolverPath), "role-resolver.ts exists");
  assert.ok(fs.existsSync(appAccessPath), "application-access.ts exists");
  assert.ok(fs.existsSync(patientHistoryPath), "get-patient-history.ts exists");
  assert.ok(fs.existsSync(patientProfilePath), "get-patient.ts exists");
  assert.ok(fs.existsSync(searchPatientsPath), "search-patients.ts exists");
  assert.ok(fs.existsSync(receptionsPath), "get-receptions.ts exists");
  assert.ok(fs.existsSync(receptionStatsPath), "get-reception-stats.ts exists");
  assert.ok(fs.existsSync(daySchedulePath), "get-day-schedule.ts exists");
  assert.ok(fs.existsSync(monthSchedulePath), "get-month-schedule.ts exists");
  assert.ok(fs.existsSync(staffPath), "get-staff.ts exists");
  assert.ok(fs.existsSync(catalogsPath), "get-catalogs.ts exists");
  assert.ok(fs.existsSync(diagServicePath), "diagnosis-catalog-service.ts exists");
  assert.ok(fs.existsSync(homePagePath), "app/page.tsx exists");
  assert.ok(fs.existsSync(migration41Path), "migration 41 exists");

  const authCode = fs.readFileSync(authResolverPath, "utf-8");
  const staffResolverCode = fs.readFileSync(staffResolverPath, "utf-8");
  const clinicResolverCode = fs.readFileSync(clinicResolverPath, "utf-8");
  const clinicContextCode = fs.readFileSync(clinicContextPath, "utf-8");
  const roleResolverCode = fs.readFileSync(roleResolverPath, "utf-8");
  const appAccessCode = fs.readFileSync(appAccessPath, "utf-8");
  const historyCode = fs.readFileSync(patientHistoryPath, "utf-8");
  const profileCode = fs.readFileSync(patientProfilePath, "utf-8");
  const searchCode = fs.readFileSync(searchPatientsPath, "utf-8");
  const receptionsCode = fs.readFileSync(receptionsPath, "utf-8");
  const recStatsCode = fs.readFileSync(receptionStatsPath, "utf-8");
  const daySchedCode = fs.readFileSync(daySchedulePath, "utf-8");
  const monthSchedCode = fs.readFileSync(monthSchedulePath, "utf-8");
  const staffCode = fs.readFileSync(staffPath, "utf-8");
  const catalogsCode = fs.readFileSync(catalogsPath, "utf-8");
  const diagServiceCode = fs.readFileSync(diagServicePath, "utf-8");
  const homeCode = fs.readFileSync(homePagePath, "utf-8");
  const migration41Code = fs.readFileSync(migration41Path, "utf-8");

  // PERF-PROD-1: No query inside Treatment Course loops
  assert.ok(
    !historyCode.includes("for (const course of courses)") &&
      !historyCode.includes("for (const c of courses)") &&
      !historyCode.includes("courses.map(async"),
    "PERF-PROD-1: No database queries issued inside treatment course loops"
  );

  // PERF-PROD-2: Patient list uses DB pagination with .range()
  assert.ok(
    searchCode.includes(".range(from, to)"),
    "PERF-PROD-2: Patient list uses PostgreSQL database-side pagination via .range()"
  );

  // PERF-PROD-3: Patient search occurs server/database side
  assert.ok(
    searchCode.includes("searchPatients") &&
      searchCode.includes("getPaginatedPatients") &&
      searchCode.includes('import "server-only"'),
    "PERF-PROD-3: Patient searching and filtering executes server/database side"
  );

  // PERF-PROD-4: Reception today query uses Clinic + timestamp range
  assert.ok(
    receptionsCode.includes('gte("arrived_at", startUtc)') &&
      receptionsCode.includes('lt("arrived_at", endUtc)') &&
      receptionsCode.includes('eq("clinic_id", clinicId)'),
    "PERF-PROD-4: Reception today query is strictly clinic-scoped and UTC timestamp bounded"
  );

  // PERF-PROD-5: Schedule queries are date bounded
  assert.ok(
    daySchedCode.includes('eq("appointment_date", dateStr)') &&
      monthSchedCode.includes('gte("appointment_date", startDate)') &&
      monthSchedCode.includes('lte("appointment_date", endDate)'),
    "PERF-PROD-5: Schedule queries are strictly date bounded"
  );

  // PERF-PROD-6: Clinical Notes stay LIMIT 4 initially
  assert.ok(
    historyCode.includes('.limit(4)'),
    "PERF-PROD-6: Initial patient chart loads bounded LIMIT 4 clinical notes"
  );

  // PERF-PROD-7: Master diagnosis does not fetch full catalog
  assert.ok(
    !diagServiceCode.includes('select("code_system").order('),
    "PERF-PROD-7: Master diagnosis page does not issue an unbounded full-table scan for code systems"
  );

  // PERF-PROD-8: No unnecessary select("*") on audited hot paths
  assert.ok(
    !historyCode.includes('.select("*")') &&
      !profileCode.includes('.select("*")') &&
      !receptionsCode.includes('.select("*")') &&
      !catalogsCode.includes('.select("*")'),
    "PERF-PROD-8: Casual select('*') removed from all audited hot paths in favor of explicit column projections"
  );

  // PERF-PROD-9: Empty collections cause zero child queries
  assert.ok(
    historyCode.includes("if (patientError || !patient) return null;") &&
      searchCode.includes("if (!patientIds || patientIds.length === 0) {\n    return [];\n  }") &&
      receptionsCode.includes("if (patientIds.length === 0) return [];"),
    "PERF-PROD-9: Empty parent collections immediately return without issuing unnecessary child queries"
  );

  // PERF-PROD-10: Independent hot-path queries are parallelized with Promise.all
  assert.ok(
    historyCode.includes("Promise.all([") &&
      profileCode.includes("Promise.all([") &&
      receptionsCode.includes("Promise.all([") &&
      recStatsCode.includes("Promise.all([") &&
      daySchedCode.includes("Promise.all([") &&
      monthSchedCode.includes("Promise.all([") &&
      staffCode.includes("Promise.all([") &&
      catalogsCode.includes("Promise.all([") &&
      homeCode.includes("Promise.all(["),
    "PERF-PROD-10: Independent database operations are parallelized across all hot paths"
  );

  // PERF-PROD-11: Auth/context duplicate resolution reduced safely via React cache()
  assert.ok(
    authCode.includes('import { cache } from "react"') &&
      authCode.includes("export const getCurrentAuthUser = cache("),
    "PERF-PROD-11: getCurrentAuthUser is wrapped with React cache()"
  );
  assert.ok(
    staffResolverCode.includes('import { cache } from "react"') &&
      staffResolverCode.includes("export const getCurrentStaff = cache("),
    "PERF-PROD-11: getCurrentStaff is wrapped with React cache()"
  );
  assert.ok(
    clinicResolverCode.includes('import { cache } from "react"') &&
      clinicResolverCode.includes("export const getCurrentStaffClinicMemberships = cache("),
    "PERF-PROD-11: getCurrentStaffClinicMemberships is wrapped with React cache()"
  );
  assert.ok(
    clinicContextCode.includes('import { cache } from "react"') &&
      clinicContextCode.includes("export const getActiveClinicContext = cache("),
    "PERF-PROD-11: getActiveClinicContext is wrapped with React cache()"
  );
  assert.ok(
    roleResolverCode.includes('import { cache } from "react"') &&
      roleResolverCode.includes("export const getCurrentStaffRolesForClinic = cache("),
    "PERF-PROD-11: getCurrentStaffRolesForClinic is wrapped with React cache()"
  );
  assert.ok(
    appAccessCode.includes('import { cache } from "react"') &&
      appAccessCode.includes("export const requireApplicationAccessContext = cache("),
    "PERF-PROD-11: requireApplicationAccessContext is wrapped with React cache()"
  );

  // PERF-PROD-12: No cross-user caching (cache() from react is strictly request-scoped)
  assert.ok(
    !authCode.includes("globalCache") &&
      !authCode.includes("nodeCache") &&
      !staffResolverCode.includes("globalThis."),
    "PERF-PROD-12: Zero cross-user global caching; strictly uses per-request React cache()"
  );

  // PERF-PROD-13: No N+1 regression
  assert.ok(
    historyCode.includes("Promise.all([") &&
      !historyCode.includes("for (const d of diagnoses)") &&
      !historyCode.includes("for (const s of services)"),
    "PERF-PROD-13: No N+1 query patterns in patient detail or course loaders"
  );

  // PERF-PROD-14: Migration 41 composite indexes verified
  assert.ok(
    migration41Code.includes("idx_receptions_clinic_arrived") &&
      migration41Code.includes("idx_receptions_patient_registered") &&
      migration41Code.includes("idx_treatment_courses_patient_clinic_course_no") &&
      migration41Code.includes("idx_appointments_date_start") &&
      migration41Code.includes("idx_appointments_patient_date") &&
      migration41Code.includes("idx_course_service_orders_course_seq") &&
      migration41Code.includes("idx_treatment_sessions_course_date") &&
      migration41Code.includes("idx_patients_created_id"),
    "PERF-PROD-14 & IDX-1: Migration 41 contains targeted composite indexes for all hot query patterns"
  );

  // IDX-2 & IDX-3: No duplicate index of existing UNIQUE
  assert.ok(
    !migration41Code.includes("diagnosis_catalog(code_system, code)") &&
      !migration41Code.includes("treatment_session_plans(treatment_course_id, session_number)"),
    "IDX-2 & IDX-3: No redundant duplicate indexes created over existing UNIQUE constraints"
  );

  // IDX-4: Composite column order follows equality -> range -> order
  assert.ok(
    migration41Code.includes("(clinic_id, arrived_at DESC)") &&
      migration41Code.includes("(appointment_date, scheduled_start_at)") &&
      migration41Code.includes("(patient_id, clinic_id, course_no DESC)"),
    "IDX-4: Composite index column ordering strictly follows equality -> range -> sort access semantics"
  );

  // IDX-6: Clinical notes not duplicated
  assert.ok(
    !migration41Code.includes("idx_clinical_notes_patient_created") &&
      !migration41Code.includes("idx_clinical_notes_course"),
    "IDX-6: Clinical notes indexes from migration 40 are preserved without duplicate creation"
  );

  console.log("All PERF-QUERY-INDEX-PRODUCTION-HARDENING1 Tests PASSED!");
}
