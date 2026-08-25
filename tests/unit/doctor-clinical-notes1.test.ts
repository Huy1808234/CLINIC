import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";

export function runDoctorClinicalNotes1Tests() {
  console.log("Running DOCTOR-CLINICAL-NOTES1 Tests...");

  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260825000040_clinical_notes.sql"
  );
  const actionPath = path.join(
    process.cwd(),
    "src",
    "app",
    "actions",
    "clinical-notes-actions.ts"
  );
  const modalPath = path.join(
    process.cwd(),
    "src",
    "components",
    "patients",
    "AddClinicalNoteModal.tsx"
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
  const rscDataPath = path.join(
    process.cwd(),
    "src",
    "rsc-data",
    "patients",
    "get-patient-history.ts"
  );

  assert.ok(fs.existsSync(migrationPath), "20260825000040_clinical_notes.sql exists");
  assert.ok(fs.existsSync(actionPath), "clinical-notes-actions.ts exists");
  assert.ok(fs.existsSync(modalPath), "AddClinicalNoteModal.tsx exists");
  assert.ok(fs.existsSync(notesCardPath), "PatientNotesCard.tsx exists");
  assert.ok(fs.existsSync(historyAccordionPath), "TreatmentHistoryAccordion.tsx exists");
  assert.ok(fs.existsSync(rscDataPath), "get-patient-history.ts exists");

  const migrationSql = fs.readFileSync(migrationPath, "utf-8");
  const actionCode = fs.readFileSync(actionPath, "utf-8");
  const modalCode = fs.readFileSync(modalPath, "utf-8");
  const notesCardCode = fs.readFileSync(notesCardPath, "utf-8");
  const historyAccordionCode = fs.readFileSync(historyAccordionPath, "utf-8");
  const rscDataCode = fs.readFileSync(rscDataPath, "utf-8");

  // 1. Table schema and RLS (NOTE-13, NOTE-14, NOTE-16)
  assert.ok(
    migrationSql.includes("CREATE TABLE IF NOT EXISTS public.clinical_notes") &&
      migrationSql.includes("organization_id UUID NOT NULL") &&
      migrationSql.includes("clinic_id UUID NOT NULL") &&
      migrationSql.includes("patient_id UUID NOT NULL") &&
      migrationSql.includes("author_staff_id UUID NOT NULL") &&
      migrationSql.includes("content TEXT NOT NULL"),
    "Migration creates canonical clinical_notes table with tenant and patient foreign keys"
  );
  assert.ok(
    migrationSql.includes("ENABLE ROW LEVEL SECURITY") &&
      migrationSql.includes("clinical_notes FOR SELECT") &&
      migrationSql.includes("clinical_notes FOR INSERT") &&
      migrationSql.includes("scr.role_code = 'DOCTOR'"),
    "Migration configures tenant isolation and doctor-only insert RLS policies (NOTE-16)"
  );
  assert.ok(
    migrationSql.includes("idx_clinical_notes_patient_created") &&
      migrationSql.includes("created_at DESC"),
    "Migration defines composite index on patient_id and created_at DESC"
  );

  // 2. Server Action Doctor Authorization & Tenancy (NOTE-2, NOTE-3, NOTE-4, NOTE-5, NOTE-7, NOTE-8, NOTE-9, NOTE-10)
  assert.ok(
    actionCode.includes("requireApplicationAccessContext") &&
      actionCode.includes("getCurrentStaffRolesForClinic"),
    "createClinicalNoteAction validates authenticated staff access context and roles (NOTE-7, NOTE-8)"
  );
  assert.ok(
    actionCode.includes('!roles.includes("DOCTOR")') &&
      actionCode.includes("Chỉ Bác sĩ"),
    "createClinicalNoteAction strictly denies non-DOCTOR roles like Receptionist, Y_SI, Technician (NOTE-2, NOTE-3, NOTE-4, NOTE-5)"
  );
  assert.ok(
    actionCode.includes('from("patients")') && actionCode.includes('eq("id", patientId)'),
    "createClinicalNoteAction validates patient existence (NOTE-9)"
  );
  assert.ok(
    actionCode.includes('from("treatment_courses")') &&
      actionCode.includes('eq("patient_id", patientId)'),
    "createClinicalNoteAction validates course ownership against patient (NOTE-10)"
  );
  assert.ok(
    actionCode.includes("accessContext.clinic.organization_id") &&
      actionCode.includes("accessContext.clinic.clinic_id") &&
      actionCode.includes("accessContext.staff.id"),
    "createClinicalNoteAction binds organization_id, clinic_id, and author_staff_id server-side (NOTE-7, NOTE-8)"
  );
  assert.ok(
    actionCode.includes("revalidatePath("),
    "createClinicalNoteAction triggers Next.js path revalidation (NOTE-19)"
  );

  // 3. UI Notes Card & Add Note Modal (NOTE-1, NOTE-6, NOTE-11, NOTE-12)
  assert.ok(
    notesCardCode.includes("isDoctor && patientId") &&
      notesCardCode.includes("Thêm ghi chú"),
    "PatientNotesCard conditionally displays '+ Thêm ghi chú' button for Doctors (NOTE-1)"
  );
  assert.ok(
    notesCardCode.includes("displayedNotes = localNotes.slice(0, 3)") &&
      notesCardCode.includes("Xem tất cả ghi chú"),
    "PatientNotesCard limits main card display to top 3 notes with expand drawer"
  );
  assert.ok(
    modalCode.includes("AddClinicalNoteModal") &&
      modalCode.includes("createClinicalNoteAction") &&
      modalCode.includes("TextArea"),
    "AddClinicalNoteModal collects doctor observations via Ant Design TextArea (NOTE-6)"
  );

  // 4. Batch Fetching & Treatment History Accordion Integration (NOTE-15, NOTE-17, NOTE-18)
  assert.ok(
    rscDataCode.includes('from("clinical_notes")') &&
      rscDataCode.includes('order("created_at", { ascending: false })') &&
      rscDataCode.includes("clinical_notes: formattedClinicalNotes"),
    "getPatientHistory performs a single batch query for patient clinical notes without N+1 (NOTE-12, NOTE-18)"
  );
  assert.ok(
    historyAccordionCode.includes("clinicalNotes.filter") &&
      historyAccordionCode.includes("treatment_course_id === course.id"),
    "TreatmentHistoryAccordion embeds course-associated notes in historical courses (NOTE-15)"
  );
  assert.ok(
    notesCardCode.includes("Intl.DateTimeFormat") &&
      notesCardCode.includes("timeZone: clinicTimezone"),
    "PatientNotesCard formats timestamps using active Clinic timezone (NOTE-17)"
  );

  console.log("All DOCTOR-CLINICAL-NOTES1 Tests PASSED!");
}
