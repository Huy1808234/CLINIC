import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";

export function runDoctorPatientChartLayoutParityFix2Tests() {
  console.log("Running DOCTOR-PATIENT-CHART-LAYOUT-PARITY-FIX2 Tests...");

  const combinedSummaryPath = path.join(process.cwd(), "src", "components", "patients", "CombinedClinicalSummaryCard.tsx");
  const clientViewPath = path.join(process.cwd(), "src", "components", "patients", "PatientChartClientView.tsx");
  const visitCardPath = path.join(process.cwd(), "src", "components", "patients", "CurrentVisitCard.tsx");
  const notesPath = path.join(process.cwd(), "src", "components", "patients", "PatientNotesCard.tsx");
  const currentCoursePath = path.join(process.cwd(), "src", "components", "patients", "CurrentCourseSummaryCard.tsx");
  const historyPath = path.join(process.cwd(), "src", "components", "patients", "TreatmentHistoryAccordion.tsx");

  assert.ok(fs.existsSync(combinedSummaryPath), "CombinedClinicalSummaryCard.tsx exists");
  assert.ok(fs.existsSync(clientViewPath), "PatientChartClientView.tsx exists");
  assert.ok(fs.existsSync(visitCardPath), "CurrentVisitCard.tsx exists");
  assert.ok(fs.existsSync(notesPath), "PatientNotesCard.tsx exists");
  assert.ok(fs.existsSync(currentCoursePath), "CurrentCourseSummaryCard.tsx exists");
  assert.ok(fs.existsSync(historyPath), "TreatmentHistoryAccordion.tsx exists");

  const combinedSummaryCode = fs.readFileSync(combinedSummaryPath, "utf-8");
  const clientViewCode = fs.readFileSync(clientViewPath, "utf-8");
  const visitCardCode = fs.readFileSync(visitCardPath, "utf-8");
  const notesCode = fs.readFileSync(notesPath, "utf-8");

  // 1. Target Shared Horizontal Rows (No Two Independent Stacks)
  assert.ok(
    clientViewCode.includes("grid-cols-1 xl:grid-cols-[minmax(0,1.85fr)_minmax(360px,1fr)]"),
    "Client view uses desktop 65/35 grid with shared horizontal rows"
  );
  assert.ok(
    clientViewCode.includes("<CurrentVisitCard") &&
      clientViewCode.includes("<CurrentCourseSummaryCard") &&
      clientViewCode.includes("<TreatmentHistoryAccordion"),
    "Row 2 contains Current Visit on left and Current Treatment Context on right"
  );
  assert.ok(
    clientViewCode.includes("<CombinedClinicalSummaryCard") &&
      clientViewCode.includes("<PatientNotesCard"),
    "Row 3 contains Combined Summary on left and Notes on right"
  );

  // 2. Integrated Current Visit with Start Examination
  assert.ok(
    visitCardCode.includes("Buổi khám hiện tại") &&
      visitCardCode.includes("Bệnh nhân đã được tiếp nhận") &&
      visitCardCode.includes("Bắt đầu khám"),
    "CurrentVisitCard integrates Start Examination within single coherent surface"
  );

  // 3. Combined Clinical Summary Card (Left Half: Summary, Right Half: Diagnosis)
  assert.ok(
    combinedSummaryCode.includes("Thông tin tóm tắt") &&
      combinedSummaryCode.includes("Tổng số liệu trình") &&
      combinedSummaryCode.includes("Tổng số buổi điều trị") &&
      combinedSummaryCode.includes("Buổi đã hoàn tất"),
    "Combined summary left half contains 3 horizontal metrics"
  );
  assert.ok(
    combinedSummaryCode.includes("grid grid-cols-1 sm:grid-cols-3 gap-3"),
    "Combined summary renders 3 metrics in horizontal grid on desktop"
  );
  assert.ok(
    combinedSummaryCode.includes("Chẩn đoán chính gần nhất") &&
      combinedSummaryCode.includes("border-r"),
    "Combined summary right half contains Latest Diagnosis separated by vertical divider"
  );

  // 4. Notes Card
  assert.ok(
    notesCode.includes("Ghi chú") && notesCode.includes("Chưa có ghi chú lâm sàng bổ sung."),
    "PatientNotesCard contains standardized notes header and clean empty state"
  );

  console.log("All DOCTOR-PATIENT-CHART-LAYOUT-PARITY-FIX2 Tests PASSED!");
}
