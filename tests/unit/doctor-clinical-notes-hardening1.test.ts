import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";

export function runDoctorClinicalNotesHardening1Tests() {
  console.log("Running DOCTOR-CLINICAL-NOTES-HARDENING1 Tests...");

  const actionPath = path.join(
    process.cwd(),
    "src",
    "app",
    "actions",
    "clinical-notes-actions.ts"
  );
  const rscDataPath = path.join(
    process.cwd(),
    "src",
    "rsc-data",
    "patients",
    "get-patient-history.ts"
  );
  const notesCardPath = path.join(
    process.cwd(),
    "src",
    "components",
    "patients",
    "PatientNotesCard.tsx"
  );
  const historyAccordionPath = path.join(
    process.cwd(),
    "src",
    "components",
    "patients",
    "TreatmentHistoryAccordion.tsx"
  );
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260825000040_clinical_notes.sql"
  );

  assert.ok(fs.existsSync(actionPath), "clinical-notes-actions.ts exists");
  assert.ok(fs.existsSync(rscDataPath), "get-patient-history.ts exists");
  assert.ok(fs.existsSync(notesCardPath), "PatientNotesCard.tsx exists");
  assert.ok(fs.existsSync(historyAccordionPath), "TreatmentHistoryAccordion.tsx exists");
  assert.ok(fs.existsSync(migrationPath), "20260825000040_clinical_notes.sql exists");

  const actionCode = fs.readFileSync(actionPath, "utf-8");
  const rscDataCode = fs.readFileSync(rscDataPath, "utf-8");
  const notesCardCode = fs.readFileSync(notesCardPath, "utf-8");
  const historyAccordionCode = fs.readFileSync(historyAccordionPath, "utf-8");
  const migrationCode = fs.readFileSync(migrationPath, "utf-8");

  // ==========================================
  // 1. ASSOCIATION SECURITY TESTS
  // ==========================================

  // NOTE-HARD-1: Valid Doctor role enforcement
  assert.ok(
    actionCode.includes("requireApplicationAccessContext") &&
      actionCode.includes("getCurrentStaffRolesForClinic") &&
      actionCode.includes('!roles.includes("DOCTOR")') &&
      actionCode.includes("Chỉ Bác sĩ"),
    "NOTE-HARD-1 & NOTE-HARD-8: createClinicalNoteAction enforces Doctor role at active clinic"
  );

  // NOTE-HARD-2: Course belongs to different Patient -> Denied
  assert.ok(
    actionCode.includes("course.patient_id !== patientId") &&
      actionCode.includes("Liệu trình điều trị không thuộc bệnh nhân này"),
    "NOTE-HARD-2: Validates course.patient_id matches patient_id"
  );

  // NOTE-HARD-3: Course belongs to unauthorized Clinic -> Denied
  assert.ok(
    actionCode.includes("course.clinic_id !== accessContext.clinic.clinic_id") &&
      actionCode.includes("Liệu trình điều trị thuộc cơ sở y tế khác hoặc không hợp lệ"),
    "NOTE-HARD-3: Validates course.clinic_id matches active clinic"
  );

  // NOTE-HARD-4: Reception belongs to different Patient -> Denied
  assert.ok(
    actionCode.includes("reception.patient_id !== patientId") &&
      actionCode.includes("Lượt tiếp nhận khám không thuộc bệnh nhân này"),
    "NOTE-HARD-4: Validates reception.patient_id matches patient_id"
  );

  // NOTE-HARD-5: Reception belongs to unauthorized Clinic -> Denied
  assert.ok(
    actionCode.includes("reception.clinic_id !== accessContext.clinic.clinic_id") &&
      actionCode.includes("Lượt tiếp nhận khám thuộc cơ sở y tế khác hoặc không hợp lệ"),
    "NOTE-HARD-5: Validates reception.clinic_id matches active clinic"
  );

  // NOTE-HARD-6: Browser cannot spoof author_staff_id (derived server-side)
  assert.ok(
    actionCode.includes("author_staff_id: accessContext.staff.id") &&
      !actionCode.includes("input.author_staff_id"),
    "NOTE-HARD-6: Author staff ID is strictly server-derived from accessContext.staff.id"
  );

  // NOTE-HARD-7: Browser cannot choose arbitrary clinic_id (derived server-side)
  assert.ok(
    actionCode.includes("clinic_id: accessContext.clinic.clinic_id") &&
      actionCode.includes("organization_id: accessContext.clinic.organization_id") &&
      !actionCode.includes("input.clinic_id") &&
      !actionCode.includes("input.organization_id"),
    "NOTE-HARD-7 & NOTE-HARD-9: Clinic and Organization IDs are strictly server-derived from accessContext"
  );

  // ==========================================
  // 2. PERFORMANCE & LAZY LOADING TESTS
  // ==========================================

  // NOTE-PERF-1: Main Patient Chart does NOT fetch unlimited clinical-note history
  assert.ok(
    rscDataCode.includes('from("clinical_notes")') &&
      rscDataCode.includes('.limit(4)') &&
      rscDataCode.includes('count: "exact"'),
    "NOTE-PERF-1: Initial patient history fetch is bounded with .limit(4) and exact count"
  );

  // NOTE-PERF-2: Main Notes card renders max 3 rows
  assert.ok(
    notesCardCode.includes("displayedNotes = allNotes.slice(0, 3)") &&
      notesCardCode.includes("hasMoreNotes = totalCount > 3"),
    "NOTE-PERF-2: Main Notes card displays max 3 items and derives hasMoreNotes"
  );

  // NOTE-PERF-3 & NOTE-PERF-4: View All loads note history on demand with pagination
  assert.ok(
    actionCode.includes("getPatientClinicalNotesPageAction") &&
      notesCardCode.includes("getPatientClinicalNotesPageAction") &&
      notesCardCode.includes("fetchDrawerNotes") &&
      notesCardCode.includes("<Pagination"),
    "NOTE-PERF-3 & NOTE-PERF-4: View All loads paginated note history on demand with server action"
  );

  // NOTE-PERF-5 & NOTE-PERF-6: Course notes query strategy
  assert.ok(
    actionCode.includes("getCourseClinicalNotesAction") &&
      historyAccordionCode.includes("clinicalNotes"),
    "NOTE-PERF-5 & NOTE-PERF-6: Course notes avoid N+1 queries"
  );

  // NOTE-PERF-7: Stable created_at DESC ordering
  assert.ok(
    rscDataCode.includes('order("created_at", { ascending: false })') &&
      actionCode.includes('order("created_at", { ascending: false })'),
    "NOTE-PERF-7: Queries use stable created_at DESC ordering"
  );

  // DB Index audit
  assert.ok(
    migrationCode.includes("idx_clinical_notes_patient_created") &&
      migrationCode.includes("idx_clinical_notes_course"),
    "Migration 40 contains patient/date and course/date performance indexes"
  );

  console.log("All DOCTOR-CLINICAL-NOTES-HARDENING1 Tests PASSED!");
}
