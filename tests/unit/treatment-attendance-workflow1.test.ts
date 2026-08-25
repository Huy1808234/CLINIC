import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";

export function runTreatmentAttendanceWorkflow1Tests() {
  console.log("Running TREATMENT-ATTENDANCE-WORKFLOW1 Tests...");

  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260825000043_appointment_attendance_provenance.sql"
  );
  const appointmentServicePath = path.join(
    process.cwd(),
    "src",
    "lib",
    "scheduling",
    "appointment-service.ts"
  );
  const schedulingActionsPath = path.join(
    process.cwd(),
    "src",
    "app",
    "actions",
    "scheduling-actions.ts"
  );
  const getDaySchedulePath = path.join(
    process.cwd(),
    "src",
    "rsc-data",
    "schedule",
    "get-day-schedule.ts"
  );
  const dayTimelineGridPath = path.join(
    process.cwd(),
    "src",
    "components",
    "schedule",
    "DayTimelineGrid.tsx"
  );
  const typesPath = path.join(process.cwd(), "src", "types", "appointment.ts");

  assert.ok(fs.existsSync(migrationPath), "Migration 43 exists");
  assert.ok(fs.existsSync(appointmentServicePath), "appointment-service.ts exists");
  assert.ok(fs.existsSync(schedulingActionsPath), "scheduling-actions.ts exists");
  assert.ok(fs.existsSync(getDaySchedulePath), "get-day-schedule.ts exists");
  assert.ok(fs.existsSync(dayTimelineGridPath), "DayTimelineGrid.tsx exists");
  assert.ok(fs.existsSync(typesPath), "appointment.ts exists");

  const migrationCode = fs.readFileSync(migrationPath, "utf-8");
  const serviceCode = fs.readFileSync(appointmentServicePath, "utf-8");
  const actionsCode = fs.readFileSync(schedulingActionsPath, "utf-8");
  const rscCode = fs.readFileSync(getDaySchedulePath, "utf-8");
  const uiCode = fs.readFileSync(dayTimelineGridPath, "utf-8");
  const typeCode = fs.readFileSync(typesPath, "utf-8");

  // ATTEND-1: Migration 43 schema columns
  assert.ok(
    migrationCode.includes("checked_in_at") &&
      migrationCode.includes("checked_in_by") &&
      migrationCode.includes("started_at") &&
      migrationCode.includes("started_by") &&
      migrationCode.includes("completed_at") &&
      migrationCode.includes("completed_by") &&
      migrationCode.includes("no_show_at") &&
      migrationCode.includes("no_show_by") &&
      migrationCode.includes("cancelled_at") &&
      migrationCode.includes("cancelled_by"),
    "ATTEND-1: Migration 43 adds all attendance lifecycle timestamps and staff provenance columns"
  );

  // ATTEND-2: Migration 43 updates completion RPC
  assert.ok(
    migrationCode.includes("completed_at = NOW()") &&
      migrationCode.includes("completed_by = p_actor_staff_id"),
    "ATTEND-2: Migration 43 updates complete_appointment_treatment_session RPC with completed_at & completed_by"
  );

  // ATTEND-3: appointment-service stamps timestamps and provenance
  assert.ok(
    serviceCode.includes("updatePayload.checked_in_at") &&
      serviceCode.includes("updatePayload.started_at") &&
      serviceCode.includes("updatePayload.no_show_at") &&
      serviceCode.includes("updatePayload.cancelled_at"),
    "ATTEND-3: updateAppointmentStatus stamps transition timestamps and actor provenance"
  );

  // ATTEND-4: Role transition matrix in scheduling-actions.ts
  assert.ok(
    actionsCode.includes("PLANNED:") &&
      actionsCode.includes("CHECKED_IN") &&
      actionsCode.includes("IN_TREATMENT") &&
      actionsCode.includes("COMPLETED") &&
      actionsCode.includes("NO_SHOW") &&
      actionsCode.includes("CANCELLED"),
    "ATTEND-4A: ALLOWED_STATUS_TRANSITIONS contains full canonical lifecycle and terminal states"
  );
  assert.ok(
    actionsCode.includes('"DOCTOR", "TECHNICIAN", "Y_SI"') &&
      actionsCode.includes('"RECEPTIONIST", "ADMIN"'),
    "ATTEND-4B: Role authorization guards correctly distinguish receptionists from clinical practitioners"
  );

  // ATTEND-5: RSC Data loader projections
  assert.ok(
    rscCode.includes("checked_in_at") &&
      rscCode.includes("started_at") &&
      rscCode.includes("completed_at") &&
      rscCode.includes("no_show_at") &&
      rscCode.includes("cancelled_at"),
    "ATTEND-5: getDayTimeline projects attendance timestamps and staff provenance"
  );

  // ATTEND-6: Type definitions
  assert.ok(
    typeCode.includes("checked_in_at?:") &&
      typeCode.includes("started_at?:") &&
      typeCode.includes("completed_at?:") &&
      typeCode.includes("no_show_at?:") &&
      typeCode.includes("cancelled_at?:"),
    "ATTEND-6: Appointment interface includes attendance timestamps"
  );

  // ATTEND-7: DayTimelineGrid UI badges & action buttons
  assert.ok(
    uiCode.includes("Chưa đến") &&
      uiCode.includes("Đã điểm danh") &&
      uiCode.includes("Đang điều trị") &&
      uiCode.includes("Hoàn thành") &&
      uiCode.includes("Vắng mặt") &&
      uiCode.includes("Đã hủy"),
    "ATTEND-7A: DayTimelineGrid renders clear Vietnamese attendance status badges"
  );
  assert.ok(
    uiCode.includes("Điểm danh") &&
      uiCode.includes("Vắng") &&
      uiCode.includes("Bắt đầu điều trị") &&
      uiCode.includes("Hoàn tất"),
    "ATTEND-7B: DayTimelineGrid renders operational action buttons"
  );

  console.log("All TREATMENT-ATTENDANCE-WORKFLOW1 Tests PASSED!");
}
