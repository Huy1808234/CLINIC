import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { getTestSupabaseAdminClient } from "../test-client";
import {
  previewExcelDiagnosisImport,
  type DiagnosisImportRowItem,
} from "@/lib/master-data/diagnosis-catalog-service";

export async function runClinicalMasterDiagnosisManagementTests() {
  console.log("Running CLINICAL-MASTER-DIAGNOSIS-MANAGEMENT1 Tests...");

  const pagePath = path.join(process.cwd(), "src", "app", "master-data", "diagnoses", "page.tsx");
  const servicePath = path.join(process.cwd(), "src", "lib", "master-data", "diagnosis-catalog-service.ts");
  const actionsPath = path.join(process.cwd(), "src", "app", "actions", "diagnosis-catalog-actions.ts");
  const clientViewPath = path.join(process.cwd(), "src", "components", "master-data", "DiagnosisCatalogClientView.tsx");
  const modalPath = path.join(process.cwd(), "src", "components", "master-data", "DiagnosisModal.tsx");
  const importModalPath = path.join(process.cwd(), "src", "components", "master-data", "DiagnosisExcelImportModal.tsx");
  const shellIdentityPath = path.join(process.cwd(), "src", "lib", "auth", "shell-identity.ts");
  const getCatalogsPath = path.join(process.cwd(), "src", "rsc-data", "treatment", "get-catalogs.ts");

  assert.ok(fs.existsSync(pagePath), "Master data diagnoses page exists (DIAG-MD-1)");
  assert.ok(fs.existsSync(servicePath), "Diagnosis catalog service exists");
  assert.ok(fs.existsSync(actionsPath), "Diagnosis catalog actions exist (DIAG-MD-2)");
  assert.ok(fs.existsSync(clientViewPath), "DiagnosisCatalogClientView exists");
  assert.ok(fs.existsSync(modalPath), "DiagnosisModal exists (DIAG-MD-7, DIAG-MD-9)");
  assert.ok(fs.existsSync(importModalPath), "DiagnosisExcelImportModal exists (DIAG-MD-13)");

  const pageSql = fs.readFileSync(pagePath, "utf-8");
  const actionsSql = fs.readFileSync(actionsPath, "utf-8");
  const serviceSql = fs.readFileSync(servicePath, "utf-8");
  const clientViewSql = fs.readFileSync(clientViewPath, "utf-8");
  const shellIdentitySql = fs.readFileSync(shellIdentityPath, "utf-8");
  const getCatalogsSql = fs.readFileSync(getCatalogsPath, "utf-8");

  // DIAG-MD-1: Page renders DiagnosisCatalogClientView and shell-identity has route
  assert.ok(
    pageSql.includes("<DiagnosisCatalogClientView"),
    "Page renders DiagnosisCatalogClientView (DIAG-MD-1)"
  );
  assert.ok(
    clientViewSql.includes("Danh mục mã bệnh"),
    "ClientView renders Danh mục mã bệnh heading (DIAG-MD-1)"
  );
  assert.ok(
    shellIdentitySql.includes("/master-data/diagnoses"),
    "shell-identity includes /master-data/diagnoses route (DIAG-MD-1)"
  );
  assert.ok(
    shellIdentitySql.includes("Danh Mục Mã Bệnh"),
    "shell-identity includes Danh Mục Mã Bệnh label (DIAG-MD-1)"
  );

  // DIAG-MD-2: Server Actions enforce requireActionAuthorization with ADMIN / MANAGER
  assert.ok(
    actionsSql.includes('requireActionAuthorization({ requiredRoles: ["ADMIN", "MANAGER"] })'),
    "Server Actions enforce role authorization for mutations (DIAG-MD-2)"
  );

  // DIAG-MD-8: Duplicate code_system + code rejected with friendly error message
  assert.ok(
    serviceSql.includes("đã tồn tại trong hệ thống"),
    "Service rejects duplicate (code_system, code) with friendly message (DIAG-MD-8)"
  );

  // DIAG-MD-10 & DIAG-MD-11: Deactivate sets is_active = false, preserves historical records
  assert.ok(
    serviceSql.includes("setDiagnosisCatalogActiveStatus") &&
      serviceSql.includes("is_active: isActive"),
    "Deactivation sets is_active status without hard delete (DIAG-MD-10)"
  );
  assert.ok(
    serviceSql.includes("DIAGNOSIS_IN_USE") &&
      serviceSql.includes("course_diagnoses") &&
      serviceSql.includes("clinical_diagnosis_templates"),
    "Hard-delete strictly checks course_diagnoses and template references before deletion (DIAG-MD-10, DIAG-MD-22)"
  );

  // DIAG-MD-18 & DIAG-MD-21: getCatalogs queries database diagnosis_catalog WHERE is_active = true
  assert.ok(
    getCatalogsSql.includes('.from("diagnosis_catalog")') &&
      getCatalogsSql.includes('.eq("is_active", true)'),
    "getCatalogs dynamically queries database active diagnosis_catalog without hardcoded list (DIAG-MD-18, DIAG-MD-21)"
  );

  // DIAG-MD-13, DIAG-MD-14, DIAG-MD-15, DIAG-MD-16: Excel Preview & Validation logic
  const mockExcelRows: DiagnosisImportRowItem[] = [
    // 1. Existing identical row from TT06 seed
    {
      code_system: "ICD10_YHCT",
      code: "U62.151.8",
      name: "Các thoái hoá đa khớp khác",
    },
    // 2. Conflict row (same code in DB, different name)
    {
      code_system: "ICD10_YHCT",
      code: "U55.531",
      name: "Tên bệnh xung đột khác",
    },
    // 3. New valid row
    {
      code_system: "ICD10_YHCT",
      code: "U99.999.1",
      name: "Bệnh lý thực nghiệm mới YHCT",
    },
    // 4. Duplicate in file
    {
      code_system: "ICD10_YHCT",
      code: "U99.999.1",
      name: "Bệnh lý thực nghiệm mới YHCT (lặp lại)",
    },
    // 5. Error row (missing code)
    {
      code_system: "ICD10_YHCT",
      code: "",
      name: "Không có mã bệnh",
    },
    // 6. Error row (missing name)
    {
      code_system: "ICD10_YHCT",
      code: "U99.999.2",
      name: "",
    },
  ];

  const supabase = getTestSupabaseAdminClient();

  const preview = await previewExcelDiagnosisImport(mockExcelRows, supabase);
  assert.equal(preview.total_rows, 6, "Total preview rows match (DIAG-MD-13)");
  assert.equal(preview.new_count, 1, "Correctly identified 1 NEW row (DIAG-MD-13)");
  assert.equal(preview.existing_count, 1, "Correctly identified 1 EXISTING row (DIAG-MD-13)");
  assert.equal(preview.conflict_count, 1, "Correctly identified 1 CONFLICT row (DIAG-MD-15)");
  assert.equal(preview.error_count, 3, "Correctly identified 3 ERROR rows (DIAG-MD-14)");

  const newRow = preview.items.find((i) => i.code === "U99.999.1" && i.status === "NEW");
  assert.ok(newRow, "New valid row classified as NEW (DIAG-MD-13)");

  const conflictRow = preview.items.find(
    (i) => i.code === "U55.531" && i.status === "CONFLICT"
  );
  assert.ok(conflictRow, "Conflicting row classified as CONFLICT (DIAG-MD-15)");

  console.log("All CLINICAL-MASTER-DIAGNOSIS-MANAGEMENT1 Tests PASSED!");
}
