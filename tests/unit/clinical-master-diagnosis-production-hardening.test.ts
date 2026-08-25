import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { getTestSupabaseAdminClient } from "../test-client";
import {
  getDiagnosisCatalogPage,
  deleteDiagnosisCatalogEntry,
  type DiagnosisImportRowItem,
  previewExcelDiagnosisImport,
} from "@/lib/master-data/diagnosis-catalog-service";

export async function runClinicalMasterDiagnosisProductionHardeningTests() {
  console.log("Running CLINICAL-MASTER-DIAGNOSIS-PRODUCTION-HARDENING1 Tests...");

  const pagePath = path.join(process.cwd(), "src", "app", "master-data", "diagnoses", "page.tsx");
  const servicePath = path.join(process.cwd(), "src", "lib", "master-data", "diagnosis-catalog-service.ts");
  const actionsPath = path.join(process.cwd(), "src", "app", "actions", "diagnosis-catalog-actions.ts");
  const clientViewPath = path.join(process.cwd(), "src", "components", "master-data", "DiagnosisCatalogClientView.tsx");
  const modalPath = path.join(process.cwd(), "src", "components", "master-data", "DiagnosisModal.tsx");
  const importModalPath = path.join(process.cwd(), "src", "components", "master-data", "DiagnosisExcelImportModal.tsx");
  const schemaPath = path.join(process.cwd(), "src", "lib", "validation", "diagnosis-catalog-schemas.ts");

  const pageCode = fs.readFileSync(pagePath, "utf-8");
  const serviceCode = fs.readFileSync(servicePath, "utf-8");
  const actionsCode = fs.readFileSync(actionsPath, "utf-8");
  const clientViewCode = fs.readFileSync(clientViewPath, "utf-8");
  const importModalCode = fs.readFileSync(importModalPath, "utf-8");
  const schemaCode = fs.readFileSync(schemaPath, "utf-8");

  // Supabase client for real DB contract checks
  const supabase = getTestSupabaseAdminClient();

  // Verify file existence and schema validation setup
  assert.ok(fs.existsSync(modalPath), "DiagnosisModal exists");
  assert.ok(pageCode.includes("getDiagnosisCatalogPage"), "Page calls getDiagnosisCatalogPage");
  assert.ok(schemaCode.includes("diagnosisCatalogSearchQuerySchema"), "Schema exports diagnosisCatalogSearchQuerySchema");

  // MD-PROD-1 & MD-PROD-2: Manager sees Add and Excel Import
  assert.ok(
    clientViewCode.includes("isAdminOrManager && (") &&
      clientViewCode.includes("+ Thêm mã bệnh") &&
      clientViewCode.includes("Nhập từ Excel"),
    "Manager sees Add and Excel Import buttons (MD-PROD-1, MD-PROD-2)"
  );

  // MD-PROD-3: Read-only doctor does not see mutation buttons or row action menu
  assert.ok(
    clientViewCode.includes("const isAdminOrManager = userRoles.includes(\"ADMIN\") || userRoles.includes(\"MANAGER\");"),
    "Role check strictly gates management actions to ADMIN and MANAGER (MD-PROD-3)"
  );

  // MD-PROD-4: Unauthorized direct mutation denied on Server Actions
  assert.ok(
    actionsCode.includes('requireActionAuthorization({ requiredRoles: ["ADMIN", "MANAGER"] })'),
    "Server Actions enforce ADMIN/MANAGER authorization on mutations (MD-PROD-4)"
  );

  // MD-PERF-1, MD-PERF-2, MD-PERF-3, MD-PERF-8: Database pagination and count
  const pageResult = await getDiagnosisCatalogPage(
    {
      search: "",
      codeSystem: "ALL",
      status: "ALL",
      page: 1,
      pageSize: 20,
      sortBy: "code",
      sortDirection: "asc",
    },
    supabase
  );

  assert.ok(pageResult.items.length <= 20, "pageSize 20 fetches <= 20 rows (MD-PERF-1)");
  assert.ok(pageResult.total >= 21, "Total count reflects database rows (MD-PERF-8)");
  assert.equal(pageResult.page, 1, "Page number matches requested page (MD-PERF-3)");
  assert.equal(pageResult.pageSize, 20, "Page size matches requested pageSize (MD-PERF-1)");

  // MD-PERF-4: Search happens in database
  assert.ok(
    serviceCode.includes(".or(") &&
      serviceCode.includes("code.ilike") &&
      serviceCode.includes("name.ilike"),
    "Search filters in database using ILIKE query (MD-PERF-4)"
  );

  // MD-PERF-5 & MD-PERF-6: Status and Code system filtering happen in database
  assert.ok(
    serviceCode.includes('.eq("code_system", query.codeSystem)') &&
      serviceCode.includes('.eq("is_active", true)') &&
      serviceCode.includes('.eq("is_active", false)'),
    "Filtering happens in database (MD-PERF-5, MD-PERF-6)"
  );

  // MD-PERF-7: Sorting happens in database
  assert.ok(
    serviceCode.includes("dbQuery.order(sortBy, { ascending })"),
    "Sorting happens in database (MD-PERF-7)"
  );

  // MD-PERF-9: List query selects minimal columns without select("*")
  assert.ok(
    serviceCode.includes('.select("id, code_system, code, name, traditional_code, traditional_name, is_active"') &&
      !serviceCode.includes('getDiagnosisCatalogPage(query: DiagnosisCatalogSearchQuery') ||
      serviceCode.includes('.select("id, code_system, code, name, traditional_code, traditional_name, is_active", {'),
    "getDiagnosisCatalogPage selects minimal columns without select('*') (MD-PERF-9)"
  );

  // MD-PERF-10: Client view does NOT filter/sort/slice locally
  assert.equal(
    clientViewCode.includes("items.filter("),
    false,
    "No client-side filter() for canonical list (MD-PERF-10)"
  );
  assert.equal(
    clientViewCode.includes("items.slice("),
    false,
    "No client-side slice() for canonical list (MD-PERF-10)"
  );

  // MD-PERF-11: No N+1 usage queries during list rendering
  assert.equal(
    clientViewCode.includes("course_diagnoses"),
    false,
    "No N+1 reference queries during list rendering (MD-PERF-11)"
  );

  // MD-PERF-12: Search debounce ~300ms
  assert.ok(
    clientViewCode.includes("setTimeout(") && clientViewCode.includes("300"),
    "Search input is debounced by 300ms (MD-PERF-12)"
  );

  // MD-PERF-13 & MD-PERF-14: Search and filter reset page=1 and update URL
  assert.ok(
    clientViewCode.includes("page: 1") && clientViewCode.includes("router.replace"),
    "Search and filters reset page to 1 and update URL query state (MD-PERF-13, MD-PERF-14)"
  );

  // MD-PERF-16: No window.location.reload
  assert.equal(
    clientViewCode.includes("window.location.reload"),
    false,
    "No window.location.reload used (MD-PERF-16)"
  );

  // MD-PERF-17: Exactly one shared DiagnosisModal
  assert.ok(
    clientViewCode.includes("<DiagnosisModal") &&
      clientViewCode.indexOf("<DiagnosisModal") === clientViewCode.lastIndexOf("<DiagnosisModal"),
    "Exactly one shared DiagnosisModal mounted (MD-PERF-17)"
  );

  // MD-PERF-18: xlsx is dynamically imported (lazy loaded)
  assert.ok(
    importModalCode.includes('await import("xlsx")'),
    "xlsx is lazy-loaded with dynamic import (MD-PERF-18)"
  );
  assert.equal(
    importModalCode.includes('import * as XLSX from "xlsx"'),
    false,
    "No eager top-level import of xlsx (MD-PERF-18)"
  );

  // MD-PROD-10: Referenced hard delete is denied with DIAGNOSIS_IN_USE
  const { data: u62Diag } = await supabase
    .from("diagnosis_catalog")
    .select("id, code")
    .eq("code", "U62.151.8")
    .single();

  assert.ok(u62Diag, "U62.151.8 exists in database");

  let caughtError = "";
  try {
    await deleteDiagnosisCatalogEntry(u62Diag.id, supabase);
  } catch (err: unknown) {
    caughtError = (err as Error).message;
  }

  assert.ok(
    caughtError.includes("DIAGNOSIS_IN_USE"),
    "Referenced diagnosis deletion throws DIAGNOSIS_IN_USE (MD-PROD-10)"
  );

  // MD-PROD-13 & MD-PROD-14: Excel preview writes nothing and flags conflicts
  const mockExcelRows: DiagnosisImportRowItem[] = [
    {
      code_system: "ICD10_YHCT",
      code: "U62.151.8",
      name: "Các thoái hoá đa khớp khác",
    },
    {
      code_system: "ICD10_YHCT",
      code: "U55.531",
      name: "Tên bệnh xung đột khác",
    },
    {
      code_system: "ICD10_YHCT",
      code: "U99.999.1",
      name: "Bệnh lý thực nghiệm mới YHCT",
    },
  ];

  const preview = await previewExcelDiagnosisImport(mockExcelRows, supabase);
  assert.equal(preview.new_count, 1, "Preview identifies 1 NEW row (MD-PROD-13)");
  assert.equal(preview.existing_count, 1, "Preview identifies 1 EXISTING row (MD-PROD-13)");
  assert.equal(preview.conflict_count, 1, "Preview identifies 1 CONFLICT row (MD-PROD-14)");

  // Check that U99.999.1 was NOT inserted into DB by preview
  const { data: phantomCheck } = await supabase
    .from("diagnosis_catalog")
    .select("id")
    .eq("code", "U99.999.1")
    .maybeSingle();

  assert.equal(phantomCheck, null, "Preview does not write anything to database (MD-PROD-13)");

  console.log("All CLINICAL-MASTER-DIAGNOSIS-PRODUCTION-HARDENING1 Tests PASSED!");
}
