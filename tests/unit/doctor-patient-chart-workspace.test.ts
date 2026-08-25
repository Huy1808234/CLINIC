import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";

export function runDoctorPatientChartWorkspaceTests() {
  console.log("Running DOCTOR-PATIENT-CHART-WORKSPACE-REDESIGN1 Tests...");

  const pagePath = path.join(process.cwd(), "src", "app", "patients", "[id]", "page.tsx");
  const chartWorkspacePath = path.join(process.cwd(), "src", "components", "clinical", "PatientChartWorkspace.tsx");
  const patientSummaryPath = path.join(process.cwd(), "src", "components", "clinical", "PatientSummaryCard.tsx");
  const currentVisitPath = path.join(process.cwd(), "src", "components", "clinical", "CurrentVisitSummaryCard.tsx");
  const historyAccordionPath = path.join(process.cwd(), "src", "components", "clinical", "TreatmentHistoryAccordion.tsx");
  const currentExamPath = path.join(process.cwd(), "src", "components", "clinical", "DoctorCurrentExamWorkspace.tsx");

  assert.ok(fs.existsSync(pagePath), "Patient detail page exists");
  assert.ok(fs.existsSync(chartWorkspacePath), "PatientChartWorkspace component exists");
  assert.ok(fs.existsSync(patientSummaryPath), "PatientSummaryCard component exists");
  assert.ok(fs.existsSync(currentVisitPath), "CurrentVisitSummaryCard component exists");
  assert.ok(fs.existsSync(historyAccordionPath), "TreatmentHistoryAccordion component exists");
  assert.ok(fs.existsSync(currentExamPath), "DoctorCurrentExamWorkspace component exists");

  const pageSql = fs.readFileSync(pagePath, "utf-8");
  const chartWorkspaceSql = fs.readFileSync(chartWorkspacePath, "utf-8");
  const currentVisitSql = fs.readFileSync(currentVisitPath, "utf-8");
  const historyAccordionSql = fs.readFileSync(historyAccordionPath, "utf-8");

  // DOC-CHART-9: Old parallel grid of DoctorClinicalCourseCard removed from page
  assert.equal(
    pageSql.includes("grid-cols-1 md:grid-cols-2 gap-5"),
    false,
    "No parallel course card grid in page.tsx (DOC-CHART-9)"
  );
  assert.ok(
    pageSql.includes("<PatientChartWorkspace"),
    "Page uses PatientChartWorkspace (DOC-CHART-9)"
  );

  // DOC-CHART-22: No max-w-7xl gutter constraint
  assert.equal(
    pageSql.includes("max-w-7xl"),
    false,
    "No restrictive max-w-7xl container causing gutters (DOC-CHART-22)"
  );

  // DOC-CHART-4 & DOC-CHART-5: Bắt đầu khám CTA exists and checks isDoctor
  assert.ok(
    currentVisitSql.includes("Bắt đầu khám"),
    "Bắt đầu khám button present (DOC-CHART-4)"
  );
  assert.ok(
    currentVisitSql.includes("isDoctor ?"),
    "Bắt đầu khám restricted to isDoctor (DOC-CHART-5)"
  );

  // DOC-CHART-3 & DOC-CHART-6: Progressive disclosure managed in workspace
  assert.ok(
    chartWorkspaceSql.includes("const [isExamStarted, setIsExamStarted] = useState<boolean>(false);"),
    "isExamStarted state manages progressive disclosure (DOC-CHART-3)"
  );
  assert.ok(
    chartWorkspaceSql.includes("!isExamStarted ?"),
    "Pre-exam shows CurrentVisitSummaryCard (DOC-CHART-3)"
  );
  assert.ok(
    chartWorkspaceSql.includes("DoctorCurrentExamWorkspace"),
    "Exam started reveals DoctorCurrentExamWorkspace (DOC-CHART-6)"
  );

  const currentCoursePath = path.join(process.cwd(), "src", "components", "clinical", "CurrentCourseSummaryCard.tsx");
  const recentApptsPath = path.join(process.cwd(), "src", "components", "clinical", "RecentAppointmentsCard.tsx");

  assert.ok(fs.existsSync(currentCoursePath), "CurrentCourseSummaryCard component exists");
  assert.ok(fs.existsSync(recentApptsPath), "RecentAppointmentsCard component exists");

  const currentCourseSql = fs.readFileSync(currentCoursePath, "utf-8");
  const recentApptsSql = fs.readFileSync(recentApptsPath, "utf-8");

  // VIS-POLISH-6: Right rail has CurrentCourseSummaryCard, TreatmentHistoryAccordion, and RecentAppointmentsCard
  assert.ok(
    currentCourseSql.includes("Thông tin trong liệu trình hiện tại"),
    "CurrentCourseSummaryCard renders header (VIS-POLISH-6)"
  );
  assert.ok(
    chartWorkspaceSql.includes("<CurrentCourseSummaryCard"),
    "Right rail contains CurrentCourseSummaryCard (VIS-POLISH-6)"
  );
  assert.ok(
    chartWorkspaceSql.includes("<TreatmentHistoryAccordion"),
    "Right rail contains TreatmentHistoryAccordion (VIS-POLISH-6)"
  );
  assert.ok(
    chartWorkspaceSql.includes("<RecentAppointmentsCard"),
    "Right rail contains RecentAppointmentsCard (VIS-POLISH-6)"
  );

  // VIS-POLISH-14: Compact empty state for appointments
  assert.ok(
    recentApptsSql.includes("Chưa có lịch hẹn gần đây."),
    "Recent appointments provides compact empty state (VIS-POLISH-14)"
  );

  // VIS-POLISH-7: Timeline dot styling in history accordion
  assert.ok(
    historyAccordionSql.includes("rounded-full"),
    "Treatment history contains timeline dot indicators (VIS-POLISH-7)"
  );

  console.log("All DOCTOR-PATIENT-CHART-WORKSPACE-REDESIGN1 Tests PASSED!");
}
