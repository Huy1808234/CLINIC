import { getTestSupabaseAdminClient } from "./test-client";

async function inspectTables() {
  const supabase = getTestSupabaseAdminClient();

  const testColsAppt = [
    "id", "patient_id", "treatment_course_id", "doctor_id", "appointment_date",
    "scheduled_start_at", "scheduled_end_at", "status", "schedule_source",
    "sequence_in_day", "priority", "manual_override", "notes", "treatment_session_plan_id",
    "created_at", "updated_at",
    "checked_in_at", "checked_in_by", "started_at", "started_by",
    "completed_at", "completed_by", "cancelled_at", "cancelled_by", "no_show_at", "no_show_by"
  ];

  console.log("=== CHECKING APPOINTMENTS COLUMNS ===");
  for (const col of testColsAppt) {
    const { error } = await supabase.from("appointments").select(col).limit(0);
    console.log(`appointments.${col}:`, error ? "MISSING (" + error.message + ")" : "EXISTS");
  }

  const testColsSession = [
    "id", "treatment_course_id", "appointment_id", "service_date", "status",
    "checked_in_at", "started_at", "completed_at", "clinical_note",
    "created_by", "created_at", "performed_by_staff_id"
  ];

  console.log("=== CHECKING TREATMENT_SESSIONS COLUMNS ===");
  for (const col of testColsSession) {
    const { error } = await supabase.from("treatment_sessions").select(col).limit(0);
    console.log(`treatment_sessions.${col}:`, error ? "MISSING (" + error.message + ")" : "EXISTS");
  }

  const testColsPlan = [
    "id", "treatment_course_id", "session_number", "planned_by_doctor_id",
    "notes", "created_at", "updated_at"
  ];

  console.log("=== CHECKING TREATMENT_SESSION_PLANS COLUMNS ===");
  for (const col of testColsPlan) {
    const { error } = await supabase.from("treatment_session_plans").select(col).limit(0);
    console.log(`treatment_session_plans.${col}:`, error ? "MISSING (" + error.message + ")" : "EXISTS");
  }
}

inspectTables();
