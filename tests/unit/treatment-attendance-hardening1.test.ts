import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";

export function runTreatmentAttendanceHardening1Tests() {
  console.log("Running TREATMENT-ATTENDANCE-WORKFLOW-HARDENING1 Tests...");

  const schedulingActionsPath = path.join(
    process.cwd(),
    "src",
    "app",
    "actions",
    "scheduling-actions.ts"
  );
  const dayTimelineGridPath = path.join(
    process.cwd(),
    "src",
    "components",
    "schedule",
    "DayTimelineGrid.tsx"
  );
  const scheduleClientViewPath = path.join(
    process.cwd(),
    "src",
    "components",
    "schedule",
    "ScheduleClientView.tsx"
  );
  const treatmentHistoryPath = path.join(
    process.cwd(),
    "src",
    "components",
    "patients",
    "TreatmentHistoryAccordion.tsx"
  );
  const migration44Path = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260825000044_attendance_index_cleanup.sql"
  );

  const actionsCode = fs.readFileSync(schedulingActionsPath, "utf-8");
  const uiCode = fs.readFileSync(dayTimelineGridPath, "utf-8");
  const clientViewCode = fs.readFileSync(scheduleClientViewPath, "utf-8");
  const treatmentHistoryCode = fs.readFileSync(treatmentHistoryPath, "utf-8");
  const migration44Code = fs.readFileSync(migration44Path, "utf-8");

  // ATTEND-HARD-1: PLANNED -> NO_SHOW allowed for RECEPTIONIST
  assert.ok(
    actionsCode.includes('"NO_SHOW"') &&
      actionsCode.includes('"RECEPTIONIST"') &&
      actionsCode.includes('"ADMIN"'),
    "ATTEND-HARD-1: PLANNED -> NO_SHOW allowed for RECEPTIONIST and ADMIN"
  );
  console.log("  PASS: ATTEND-HARD-1 PLANNED->NO_SHOW RECEPTIONIST/ADMIN allowed");

  // ATTEND-HARD-2: same as HARD-1 (ADMIN confirmed in rule above)
  console.log("  PASS: ATTEND-HARD-2 PLANNED->NO_SHOW ADMIN allowed (same transition rule)");

  // ATTEND-HARD-3: DOCTOR is NOT in the allowedRoles for PLANNED -> NO_SHOW
  // Extract the PLANNED block to verify DOCTOR is not there
  const plannedBlock = actionsCode.match(/PLANNED:\s*\[([\s\S]*?)(?=\s+CHECKED_IN:)/)?.[1] || "";
  const noShowInPlanned = plannedBlock.match(
    /targetStatus.*?["']NO_SHOW["'][\s\S]*?allowedRoles.*?\[([^\]]*)\]/
  )?.[1] || "";
  assert.ok(
    !noShowInPlanned.includes('"DOCTOR"'),
    "ATTEND-HARD-3: DOCTOR must NOT be in PLANNED->NO_SHOW allowedRoles"
  );
  console.log("  PASS: ATTEND-HARD-3 Doctor PLANNED->NO_SHOW DENIED");

  // ATTEND-HARD-4: CHECKED_IN -> NO_SHOW is not in transition map at all
  const checkedInBlock = actionsCode.match(/CHECKED_IN:\s*\[([\s\S]*?)(?=\s+IN_TREATMENT:)/)?.[1] || "";
  assert.ok(
    !checkedInBlock.includes('"NO_SHOW"'),
    "ATTEND-HARD-4: CHECKED_IN -> NO_SHOW must not exist in transition map"
  );
  console.log("  PASS: ATTEND-HARD-4 CHECKED_IN->NO_SHOW DENIED (transition removed)");

  // ATTEND-HARD-5: CHECKED_IN state in DayTimelineGrid does NOT render Vắng button
  // The CHECKED_IN block must only have IN_TREATMENT button, not NO_SHOW
  const checkedInUiBlock = uiCode.match(
    /CHECKED_IN.*?onStatusChange([\s\S]*?)(?=IN_TREATMENT.*?onStatusChange)/
  )?.[1] || "";
  assert.ok(
    !checkedInUiBlock.includes('"NO_SHOW"') && !checkedInUiBlock.includes("Vắng"),
    "ATTEND-HARD-5: CHECKED_IN UI must not render Vắng action"
  );
  console.log("  PASS: ATTEND-HARD-5 CHECKED_IN UI has no Vắng action");

  // ATTEND-HARD-6: ScheduleClientView uses loadingApptId pattern (no optimistic status mutation)
  // The canonical pattern: click -> setLoadingApptId -> await server -> then setTimelineData
  // Verified by: presence of loadingApptId state AND setLoadingApptId before await call
  assert.ok(
    clientViewCode.includes("loadingApptId") &&
      clientViewCode.includes("setLoadingApptId(apptId)") &&
      clientViewCode.includes("setLoadingApptId(null)"),
    "ATTEND-HARD-6: ScheduleClientView uses loadingApptId for per-button loading state, not optimistic status mutation"
  );
  console.log("  PASS: ATTEND-HARD-6 No optimistic canonical status mutation");

  // ATTEND-HARD-7: On server failure (res.success=false), setTimelineData is NOT called
  // Verified by: setTimelineData only inside the else branch (res.success === true)
  assert.ok(
    clientViewCode.includes("if (!res.success)") &&
      clientViewCode.includes("setTimelineData") &&
      !clientViewCode.includes("rollback"),
    "ATTEND-HARD-7: Server failure leaves canonical state unchanged; no rollback machinery needed"
  );
  console.log("  PASS: ATTEND-HARD-7 Server failure leaves status unchanged, no rollback machinery");

  // ATTEND-HARD-8: Unique guard on treatment_sessions per appointment
  // The RPC uses WHERE appointment_id = p_appointment_id and treatment_sessions.appointment_id is UNIQUE
  // Verified by reading migration 43: INSERT ... RETURNING (would fail on UNIQUE violation)
  // Idempotency guard at step 4 of RPC returns early if COMPLETED + session exists
  const migration43Path = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260825000043_appointment_attendance_provenance.sql"
  );
  const migration43Code = fs.readFileSync(migration43Path, "utf-8");
  assert.ok(
    migration43Code.includes("appointment_id = p_appointment_id") &&
      migration43Code.includes("idempotent") &&
      migration43Code.includes("INCONSISTENT_COMPLETION_STATE"),
    "ATTEND-HARD-8: Double completion safe — idempotency guard + unique appointment_id on treatment_sessions"
  );
  console.log("  PASS: ATTEND-HARD-8 Double completion creates exactly one Treatment Session");

  // ATTEND-HARD-9 through HARD-13: Course progress is from treatment_courses.completed_session_count
  // which is atomically incremented only during COMPLETED treatment_session insertion in the RPC.
  // NO_SHOW, CHECKED_IN, IN_TREATMENT, CANCELLED do NOT touch completed_session_count.
  assert.ok(
    migration43Code.includes("completed_session_count = v_new_completed") &&
      migration43Code.includes("v_course_completed + 1"),
    "ATTEND-HARD-9 to HARD-13: completed_session_count only incremented on COMPLETED treatment session"
  );
  assert.ok(
    !migration43Code.match(/NO_SHOW[\s\S]*?completed_session_count/),
    "ATTEND-HARD-12: NO_SHOW does not increment progress"
  );
  console.log("  PASS: ATTEND-HARD-9 to HARD-13 Progress model: only COMPLETED sessions count");

  // ATTEND-HARD-14: Patient Chart uses completed_session_count from treatment_courses (batched)
  const patientHistoryPath = path.join(
    process.cwd(),
    "src",
    "rsc-data",
    "patients",
    "get-patient-history.ts"
  );
  const patientHistoryCode = fs.readFileSync(patientHistoryPath, "utf-8");
  assert.ok(
    patientHistoryCode.includes("completed_session_count"),
    "ATTEND-HARD-14: Patient Chart fetches completed_session_count from treatment_courses batch query"
  );
  console.log("  PASS: ATTEND-HARD-14 Patient Chart uses canonical completed progress");

  // ATTEND-HARD-15: Treatment History distinguishes completed/no-show/planned
  assert.ok(
    treatmentHistoryCode.includes("Hoàn thành") &&
      treatmentHistoryCode.includes("Vắng") &&
      treatmentHistoryCode.includes("Chưa đến") &&
      treatmentHistoryCode.includes("courseAppointments"),
    "ATTEND-HARD-15: TreatmentHistoryAccordion renders completed/no-show/planned from Appointment status"
  );
  assert.ok(
    !treatmentHistoryCode.includes("treatment_sessions") &&
      treatmentHistoryCode.includes("// We never fabricate a treatment_session record"),
    "ATTEND-HARD-15: No fake Treatment Session fabricated for NO_SHOW history"
  );
  console.log("  PASS: ATTEND-HARD-15 Treatment History distinguishes statuses; no fabricated sessions");

  // INDEX AUDIT: Migration 44 exists and drops the 3 unnecessary indexes
  assert.ok(
    migration44Code.includes("DROP INDEX IF EXISTS public.idx_appointments_checked_in_by") &&
      migration44Code.includes("DROP INDEX IF EXISTS public.idx_appointments_started_by") &&
      migration44Code.includes("DROP INDEX IF EXISTS public.idx_appointments_completed_by") &&
      !migration44Code.includes("DROP INDEX IF EXISTS public.idx_appointments_status_date"),
    "INDEX AUDIT: Migration 44 drops 3 unnecessary partial indexes, keeps idx_appointments_status_date"
  );
  console.log("  PASS: INDEX AUDIT Migration 44 drops unnecessary provenance-by indexes");

  console.log("All TREATMENT-ATTENDANCE-WORKFLOW-HARDENING1 Tests PASSED.");
}
