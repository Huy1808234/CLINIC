import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";

export function runDoctorPatientChartReferenceUi2Tests() {
  console.log("Running DOCTOR-PATIENT-CHART-REFERENCE-UI2 Tests...");

  const pagePath = path.join(process.cwd(), "src", "app", "patients", "[id]", "page.tsx");
  const clientViewPath = path.join(process.cwd(), "src", "components", "patients", "PatientChartClientView.tsx");
  const heroCardPath = path.join(process.cwd(), "src", "components", "patients", "PatientHeroSummaryCard.tsx");
  const currentVisitPath = path.join(process.cwd(), "src", "components", "patients", "CurrentVisitCard.tsx");
  const startExamPath = path.join(process.cwd(), "src", "components", "patients", "StartExaminationPanel.tsx");
  const statsCardPath = path.join(process.cwd(), "src", "components", "patients", "PatientStatsSummaryCard.tsx");
  const latestDiagPath = path.join(process.cwd(), "src", "components", "patients", "LatestDiagnosisCard.tsx");
  const currentCoursePath = path.join(process.cwd(), "src", "components", "patients", "CurrentCourseSummaryCard.tsx");
  const historyPath = path.join(process.cwd(), "src", "components", "patients", "TreatmentHistoryAccordion.tsx");
  const notesPath = path.join(process.cwd(), "src", "components", "patients", "PatientNotesCard.tsx");

  assert.ok(fs.existsSync(pagePath), "page.tsx exists");
  assert.ok(fs.existsSync(clientViewPath), "PatientChartClientView.tsx exists");
  assert.ok(fs.existsSync(heroCardPath), "PatientHeroSummaryCard.tsx exists");
  assert.ok(fs.existsSync(currentVisitPath), "CurrentVisitCard.tsx exists");
  assert.ok(fs.existsSync(startExamPath), "StartExaminationPanel.tsx exists");
  assert.ok(fs.existsSync(statsCardPath), "PatientStatsSummaryCard.tsx exists");
  assert.ok(fs.existsSync(latestDiagPath), "LatestDiagnosisCard.tsx exists");
  assert.ok(fs.existsSync(currentCoursePath), "CurrentCourseSummaryCard.tsx exists");
  assert.ok(fs.existsSync(historyPath), "TreatmentHistoryAccordion.tsx exists");
  assert.ok(fs.existsSync(notesPath), "PatientNotesCard.tsx exists");

  const pageCode = fs.readFileSync(pagePath, "utf-8");
  const clientViewCode = fs.readFileSync(clientViewPath, "utf-8");
  const heroCardCode = fs.readFileSync(heroCardPath, "utf-8");
  const currentVisitCode = fs.readFileSync(currentVisitPath, "utf-8");
  const startExamCode = fs.readFileSync(startExamPath, "utf-8");
  const statsCardCode = fs.readFileSync(statsCardPath, "utf-8");
  const latestDiagCode = fs.readFileSync(latestDiagPath, "utf-8");
  const currentCourseCode = fs.readFileSync(currentCoursePath, "utf-8");
  const historyCode = fs.readFileSync(historyPath, "utf-8");
  const notesCode = fs.readFileSync(notesPath, "utf-8");

  // 1. Page Header & Breadcrumb
  assert.ok(
    pageCode.includes('title="Bác sĩ / Hồ sơ bệnh nhân"'),
    "Page uses 'Bác sĩ / Hồ sơ bệnh nhân' breadcrumb title"
  );
  assert.ok(
    pageCode.includes("requireApplicationPageAccessContext"),
    "Page enforces canonical page access context boundary"
  );
  assert.ok(
    pageCode.includes("<PatientChartWorkspace") || pageCode.includes("<PatientChartClientView"),
    "Page renders PatientChartWorkspace / PatientChartClientView"
  );

  // 2. 2-Column Grid Layout
  assert.ok(
    clientViewCode.includes("grid-cols-1 xl:grid-cols-") ||
      (clientViewCode.includes("lg:col-span-8") && clientViewCode.includes("lg:col-span-4")),
    "PatientChartClientView has 2-column layout"
  );

  // 3. Patient Hero Summary Card Fields
  assert.ok(
    heroCardCode.includes("initials") && heroCardCode.includes("patient.full_name"),
    "Hero summary renders initials and full name"
  );
  assert.ok(
    heroCardCode.includes("calculateAge") && heroCardCode.includes("patient.patient_code"),
    "Hero summary computes age and shows patient code"
  );
  assert.ok(
    (heroCardCode.includes("patient.phone") || heroCardCode.includes("patient.phone_number")) &&
      heroCardCode.includes("patient.address"),
    "Hero summary shows phone and address"
  );
  assert.ok(
    heroCardCode.includes("Ngày sinh") &&
      heroCardCode.includes("Chiều cao / Cân nặng") &&
      heroCardCode.includes("CCCD / CMND") &&
      heroCardCode.includes("Mã thẻ BHYT"),
    "Hero summary includes 2x2 grid of admin/clinical details"
  );

  // 4. Current Visit Card
  assert.ok(
    currentVisitCode.includes("Buổi khám hiện tại"),
    "CurrentVisitCard has 'Buổi khám hiện tại' title"
  );
  assert.ok(
    currentVisitCode.includes("Thời gian tiếp nhận") &&
      currentVisitCode.includes("Nguồn tiếp nhận") &&
      currentVisitCode.includes("Tiếp nhận bởi"),
    "CurrentVisitCard includes reception metadata"
  );
  assert.ok(
    currentVisitCode.includes("Lý do đến khám"),
    "CurrentVisitCard includes reason for visit panel"
  );

  // 5. Start Examination CTA & Progressive Disclosure
  assert.ok(
    startExamCode.includes("Bắt đầu khám") &&
      startExamCode.includes("Bệnh nhân đã được tiếp nhận"),
    "StartExaminationPanel renders CTA with 'Bắt đầu khám' button"
  );
  assert.ok(
    startExamCode.includes("isDoctor ? (") || startExamCode.includes("isDoctor"),
    "StartExaminationPanel restricts start exam action to doctor"
  );
  assert.ok(
    startExamCode.includes("DoctorCurrentExamWorkspace"),
    "StartExaminationPanel mounts DoctorCurrentExamWorkspace upon starting exam"
  );

  // 6. Patient Stats Summary (Thông tin tóm tắt)
  assert.ok(
    statsCardCode.includes("Thông tin tóm tắt"),
    "PatientStatsSummaryCard has 'Thông tin tóm tắt' title"
  );
  assert.ok(
    statsCardCode.includes("Tổng số liệu trình") &&
      statsCardCode.includes("Tổng số buổi điều trị") &&
      statsCardCode.includes("Buổi đã hoàn tất"),
    "PatientStatsSummaryCard computes 3 derived KPI metrics"
  );

  // 7. Latest Diagnosis Card (Chẩn đoán chính gần nhất)
  assert.ok(
    latestDiagCode.includes("Chẩn đoán chính gần nhất"),
    "LatestDiagnosisCard has 'Chẩn đoán chính gần nhất' title"
  );
  assert.ok(
    latestDiagCode.includes("Chưa có chẩn đoán chính"),
    "LatestDiagnosisCard handles empty state cleanly"
  );

  // 8. Current Course Summary (Thông tin liệu trình hiện tại)
  assert.ok(
    currentCourseCode.includes("Liệu trình hiện tại") ||
      currentCourseCode.includes("Thông tin liệu trình hiện tại"),
    "CurrentCourseSummaryCard renders current course summary"
  );
  assert.ok(
    currentCourseCode.includes("Tiến độ buổi điều trị"),
    "CurrentCourseSummaryCard shows session progress"
  );

  // 9. Treatment History Accordion (Lịch sử điều trị)
  assert.ok(
    historyCode.includes("Lịch sử điều trị"),
    "TreatmentHistoryAccordion has 'Lịch sử điều trị' title"
  );
  assert.ok(
    historyCode.includes("accordion") && historyCode.includes("<Collapse"),
    "TreatmentHistoryAccordion uses Ant Design Collapse in accordion mode"
  );
  assert.ok(
    historyCode.includes("course_no - a.course_no"),
    "TreatmentHistoryAccordion sorts newest first (LT3 -> LT2 -> LT1)"
  );

  // 10. Patient Notes Card (Ghi chú)
  assert.ok(
    notesCode.includes("Ghi chú"),
    "PatientNotesCard has 'Ghi chú' title"
  );
  assert.ok(
    notesCode.includes("Chưa có ghi chú lâm sàng bổ sung."),
    "PatientNotesCard handles empty state cleanly"
  );

  console.log("All DOCTOR-PATIENT-CHART-REFERENCE-UI2 Tests PASSED!");
}
