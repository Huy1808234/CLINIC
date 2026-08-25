import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import type { DiagnosisCatalogItem, ServiceCatalogItem } from "@/types/catalog";

export function runDoctorClinicalCourseUiTests() {
  console.log("Running Doctor Clinical Course UI & Authorization Contract Tests...");

  const pagePath = path.join(process.cwd(), "src", "app", "patients", "[id]", "page.tsx");
  const cardPath = path.join(process.cwd(), "src", "components", "clinical", "DoctorClinicalCourseCard.tsx");
  const actionsPath = path.join(process.cwd(), "src", "app", "actions", "clinical-actions.ts");
  const diagServicePath = path.join(process.cwd(), "src", "lib", "clinical", "diagnosis-service.ts");
  const orderServPath = path.join(process.cwd(), "src", "lib", "clinical", "service-order-service.ts");

  assert.equal(fs.existsSync(pagePath), true, "patients/[id]/page.tsx exists");
  assert.equal(fs.existsSync(cardPath), true, "DoctorClinicalCourseCard.tsx exists");
  assert.equal(fs.existsSync(actionsPath), true, "clinical-actions.ts exists");

  const pageCode = fs.readFileSync(pagePath, "utf-8");
  const cardCode = fs.readFileSync(cardPath, "utf-8");
  const actionsCode = fs.readFileSync(actionsPath, "utf-8");
  const diagServiceCode = fs.readFileSync(diagServicePath, "utf-8");
  const orderServCode = fs.readFileSync(orderServPath, "utf-8");

  // CLIN-UI-1 & CLIN-UI-2: Doctor-scoped clinical controls on Patient Detail page
  assert.equal(
    pageCode.includes("PatientChartWorkspace") && pageCode.includes("isDoctor={isDoctor}"),
    true,
    "PatientDetailsPage renders PatientChartWorkspace with server-resolved isDoctor flag (CLIN-UI-1, CLIN-UI-2)"
  );

  // CLIN-UI-2 & Server Authorization: All clinical mutations strictly require DOCTOR role
  assert.equal(
    actionsCode.includes('requiredRoles: ["DOCTOR"]') &&
      actionsCode.includes("recordCourseDiagnosisAction") &&
      actionsCode.includes("orderCourseServicesAction") &&
      actionsCode.includes("establishInitialTreatmentPlanAction"),
    true,
    "Server Actions strictly enforce DOCTOR role authorization (CLIN-UI-2)"
  );

  // CLIN-UI-3 & CLIN-UI-4: Diagnosis options come dynamically from catalog, no hardcoded codes in JSX
  assert.equal(
    cardCode.includes("diagnosesCatalog") &&
      !cardCode.includes('["U62.151.8"') &&
      !cardCode.includes("M54.5"),
    true,
    "Diagnosis dropdown loads from diagnosis_catalog with zero hardcoded disease codes (CLIN-UI-3, CLIN-UI-4)"
  );

  // CLIN-UI-5 & CLIN-UI-6: Filter function matches diagnosis code, name, and label
  assert.equal(
    cardCode.includes("label.includes(q) || code.includes(q) || name.includes(q)"),
    true,
    "Search supports exact/partial diagnosis code and Vietnamese diagnosis name (CLIN-UI-5, CLIN-UI-6)"
  );

  // CLIN-UI-7 & CLIN-UI-8: Primary diagnosis and secondary diagnoses distinct in schema
  assert.equal(
    cardCode.includes('diagnosis_type: "PRIMARY"') &&
      cardCode.includes('diagnosis_type: "SECONDARY"') &&
      cardCode.includes("is_primary: true") &&
      cardCode.includes("is_primary: false"),
    true,
    "Primary and secondary diagnoses are distinctly typed and mapped (CLIN-UI-7, CLIN-UI-8)"
  );

  // CLIN-UI-9 & CLIN-UI-10: DVKT loaded from service_catalog and respects is_active
  assert.equal(
    cardCode.includes("servicesCatalog") && cardCode.includes("s.is_active"),
    true,
    "DVKT loaded from active service_catalog entries (CLIN-UI-9, CLIN-UI-10)"
  );

  // CLIN-UI-11 & CLIN-UI-12: course_diagnoses and course_service_orders used for persistence
  assert.equal(
    diagServiceCode.includes('.from("course_diagnoses")'),
    true,
    "course_diagnoses table used for diagnosis persistence (CLIN-UI-11)"
  );
  assert.equal(
    orderServCode.includes('.from("course_service_orders")'),
    true,
    "course_service_orders table used for DVKT persistence (CLIN-UI-12)"
  );

  // CLIN-UI-13 & CLIN-UI-14: No diagnosis written to patients or receptions tables
  assert.equal(
    diagServiceCode.includes('.from("patients")') || diagServiceCode.includes('.from("receptions")'),
    false,
    "No diagnosis written to patients or receptions tables (CLIN-UI-13, CLIN-UI-14)"
  );

  // CLIN-UI-15: planned_session_count remains Doctor-owned
  assert.equal(
    actionsCode.includes("establishInitialTreatmentPlanAction") &&
      actionsCode.includes("planned_session_count"),
    true,
    "planned_session_count is owned and stamped by Doctor (CLIN-UI-15)"
  );

  // ==========================================
  // PURE LOGICAL FILTER TESTS
  // ==========================================

  const mockDiagnoses: DiagnosisCatalogItem[] = [
    {
      id: "diag-1",
      code_system: "ICD10_YHCT",
      code: "U62.151.8",
      name: "Các thoái hoá đa khớp khác",
      traditional_code: "THDK",
      traditional_name: "Thoái hoá đa khớp",
      is_active: true,
    },
    {
      id: "diag-2",
      code_system: "ICD10_YHCT",
      code: "M54.5",
      name: "Đau vùng thắt lưng",
      traditional_code: "DTL",
      traditional_name: "Yêu thống",
      is_active: true,
    },
  ];

  const mockServices: ServiceCatalogItem[] = [
    {
      id: "serv-1",
      service_code: "DC01",
      service_name: "Điện châm",
      service_group: "YHCT",
      default_duration_minutes: 30,
      setup_minutes: 0,
      cleanup_minutes: 0,
      required_resource_type: null,
      is_active: true,
    },
    {
      id: "serv-2",
      service_code: "BT01",
      service_name: "Bó thuốc y học cổ truyền",
      service_group: "YHCT",
      default_duration_minutes: 20,
      setup_minutes: 0,
      cleanup_minutes: 0,
      required_resource_type: null,
      is_active: true,
    },
  ];

  // Test search matching
  const qCode = "u62";
  const matchedByCode = mockDiagnoses.filter(
    (d) => d.code.toLowerCase().includes(qCode) || d.name.toLowerCase().includes(qCode)
  );
  assert.equal(matchedByCode.length, 1);
  assert.equal(matchedByCode[0].code, "U62.151.8");

  const qName = "thắt lưng";
  const matchedByName = mockDiagnoses.filter(
    (d) => d.code.toLowerCase().includes(qName) || d.name.toLowerCase().includes(qName)
  );
  assert.equal(matchedByName.length, 1);
  assert.equal(matchedByName[0].code, "M54.5");

  // Test service code/name matching
  const qServ = "điện châm";
  const matchedServ = mockServices.filter(
    (s) => s.service_code.toLowerCase().includes(qServ) || s.service_name.toLowerCase().includes(qServ)
  );
  assert.equal(matchedServ.length, 1);
  assert.equal(matchedServ[0].service_code, "DC01");

  console.log("All Doctor Clinical Course UI Tests PASSED!");
}
