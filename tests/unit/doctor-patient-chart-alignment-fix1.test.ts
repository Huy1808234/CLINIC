import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";

export function runDoctorPatientChartAlignmentFix1Tests() {
  console.log("Running DOCTOR-PATIENT-CHART-ALIGNMENT-FIX1 Tests...");

  const sectionCardPath = path.join(process.cwd(), "src", "components", "patients", "SectionCard.tsx");
  const clientViewPath = path.join(process.cwd(), "src", "components", "patients", "PatientChartClientView.tsx");
  const statsCardPath = path.join(process.cwd(), "src", "components", "patients", "PatientStatsSummaryCard.tsx");
  const latestDiagPath = path.join(process.cwd(), "src", "components", "patients", "LatestDiagnosisCard.tsx");
  const notesPath = path.join(process.cwd(), "src", "components", "patients", "PatientNotesCard.tsx");
  const recentApptsPath = path.join(process.cwd(), "src", "components", "clinical", "RecentAppointmentsCard.tsx");

  assert.ok(fs.existsSync(sectionCardPath), "SectionCard.tsx exists");
  assert.ok(fs.existsSync(clientViewPath), "PatientChartClientView.tsx exists");
  assert.ok(fs.existsSync(statsCardPath), "PatientStatsSummaryCard.tsx exists");
  assert.ok(fs.existsSync(latestDiagPath), "LatestDiagnosisCard.tsx exists");
  assert.ok(fs.existsSync(notesPath), "PatientNotesCard.tsx exists");
  assert.ok(fs.existsSync(recentApptsPath), "RecentAppointmentsCard.tsx exists");

  const sectionCardCode = fs.readFileSync(sectionCardPath, "utf-8");
  const clientViewCode = fs.readFileSync(clientViewPath, "utf-8");
  const statsCardCode = fs.readFileSync(statsCardPath, "utf-8");
  const latestDiagCode = fs.readFileSync(latestDiagPath, "utf-8");
  const notesCode = fs.readFileSync(notesPath, "utf-8");
  const recentApptsCode = fs.readFileSync(recentApptsPath, "utf-8");

  // 1. Shared Card Shell
  assert.ok(
    sectionCardCode.includes("export const SectionCard") &&
      sectionCardCode.includes("export const SectionCardHeader") &&
      sectionCardCode.includes("export const EmptyStatePanel"),
    "SectionCard exports SectionCard, SectionCardHeader, and EmptyStatePanel"
  );

  // 2. Standardized Card Implementations
  assert.ok(
    statsCardCode.includes("SectionCard") && statsCardCode.includes("SectionCardHeader"),
    "PatientStatsSummaryCard uses SectionCard and SectionCardHeader"
  );
  assert.ok(
    notesCode.includes("SectionCard") &&
      notesCode.includes("SectionCardHeader") &&
      notesCode.includes("EmptyStatePanel"),
    "PatientNotesCard uses SectionCard, SectionCardHeader, and EmptyStatePanel"
  );
  assert.ok(
    latestDiagCode.includes("SectionCard") &&
      latestDiagCode.includes("SectionCardHeader") &&
      latestDiagCode.includes("EmptyStatePanel"),
    "LatestDiagnosisCard uses SectionCard, SectionCardHeader, and EmptyStatePanel"
  );
  assert.ok(
    recentApptsCode.includes("SectionCard") &&
      recentApptsCode.includes("SectionCardHeader") &&
      recentApptsCode.includes("EmptyStatePanel"),
    "RecentAppointmentsCard uses SectionCard, SectionCardHeader, and EmptyStatePanel"
  );

  // 3. Synchronized Lower 2-Column Grid Rows
  assert.ok(
    clientViewCode.includes("items-stretch"),
    "Lower section uses synchronized items-stretch grid"
  );
  assert.ok(
    (clientViewCode.includes("<CombinedClinicalSummaryCard") ||
      (clientViewCode.includes("<PatientStatsSummaryCard") && clientViewCode.includes("<LatestDiagnosisCard"))) &&
      clientViewCode.includes("<PatientNotesCard"),
    "Lower section contains clinical summary and notes in synchronized pairs"
  );

  // 4. Normalized Empty State Messages
  assert.ok(
    notesCode.includes("Chưa có ghi chú lâm sàng bổ sung."),
    "PatientNotesCard contains normalized empty message"
  );
  assert.ok(
    latestDiagCode.includes("Chưa có chẩn đoán chính"),
    "LatestDiagnosisCard contains normalized empty message"
  );
  assert.ok(
    recentApptsCode.includes("Chưa có lịch hẹn gần đây."),
    "RecentAppointmentsCard contains normalized empty message"
  );

  // 5. 3 Balanced KPI Metrics
  assert.ok(
    statsCardCode.includes("grid-cols-1 sm:grid-cols-3") &&
      statsCardCode.includes("Tổng số liệu trình") &&
      statsCardCode.includes("Tổng số buổi điều trị") &&
      statsCardCode.includes("Buổi đã hoàn tất"),
    "PatientStatsSummaryCard displays 3 balanced KPI metric cards"
  );

  console.log("All DOCTOR-PATIENT-CHART-ALIGNMENT-FIX1 Tests PASSED!");
}
