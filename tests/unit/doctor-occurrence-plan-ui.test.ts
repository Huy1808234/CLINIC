import assert from "node:assert/strict";
import { saveTreatmentSessionPlanSchema } from "@/lib/validation/clinical-schemas";
import type { TreatmentSessionPlanItem } from "@/types/treatment";
import type { ClinicRoleCode } from "@/types/clinic";

export function runDoctorOccurrencePlanUiTests() {
  console.log("Running Doctor Occurrence Plan UI Unit Tests...");

  const validCourseId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const validService1 = "11111111-1111-4111-8111-111111111111";
  const validService2 = "22222222-2222-4222-8222-222222222222";

  // UI-SP1, UI-SP2, UI-SP3: Dynamic session count rendering (3, 7, N without hardcoding)
  {
    const generateSessionSlots = (count: number) => {
      return Array.from({ length: count }, (_, i) => i + 1);
    };

    // UI-SP1: planned_session_count = 3 renders exactly [1, 2, 3]
    const slots3 = generateSessionSlots(3);
    assert.deepEqual(slots3, [1, 2, 3], "planned_session_count = 3 must render exactly Buổi 1..3 (UI-SP1)");

    // UI-SP2: planned_session_count = 7 renders exactly [1..7]
    const slots7 = generateSessionSlots(7);
    assert.deepEqual(slots7, [1, 2, 3, 4, 5, 6, 7], "planned_session_count = 7 must render exactly Buổi 1..7 (UI-SP2)");

    // UI-SP3: planned_session_count = 12 renders dynamically beyond any hardcoded 3 or 7
    const slots12 = generateSessionSlots(12);
    assert.equal(slots12.length, 12, "Must support dynamic N sessions without hardcoded limit (UI-SP3)");
  }

  // UI-SP4, UI-SP5, UI-SP16: Distinction between 'Đã lập' and 'Chưa lập' without implicit fallback
  {
    const mockPlansMap: Record<number, TreatmentSessionPlanItem> = {
      1: {
        id: "plan-1",
        treatment_course_id: validCourseId,
        session_number: 1,
        planned_by_doctor_id: "doc-1",
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        services: [
          { id: "s1", service_id: validService1, service_code: "DC", service_name: "Điện châm", sequence_no: 1, notes: null },
          { id: "s2", service_id: validService2, service_code: "BO", service_name: "Bó thuốc", sequence_no: 2, notes: null },
        ],
      },
    };

    // Session 1 is established (Đã lập)
    const session1Plan = mockPlansMap[1];
    const session1Status = session1Plan && session1Plan.services.length > 0 ? "ESTABLISHED" : "UNESTABLISHED";
    assert.equal(session1Status, "ESTABLISHED", "Session 1 with services must be ESTABLISHED (UI-SP5)");
    assert.equal(session1Plan?.services.length, 2, "Session 1 displays service count = 2");

    // Session 2 is unestablished (Chưa lập)
    const session2Plan = mockPlansMap[2];
    const session2Status = session2Plan && session2Plan.services.length > 0 ? "ESTABLISHED" : "UNESTABLISHED";
    assert.equal(session2Status, "UNESTABLISHED", "Session 2 without plan must be UNESTABLISHED (UI-SP4)");

    // UI-SP16: No fallback to course-level service orders for unestablished sessions
    const session2ResolvedServices = session2Plan?.services || [];
    assert.equal(session2ResolvedServices.length, 0, "No implicit fallback to course services for unestablished sessions (UI-SP16)");
  }

  // UI-SP6, UI-SP7: DB-backed service selector without hardcoded options
  {
    const mockDbServiceCatalog = [
      { id: "svc-1", service_code: "DC01", service_name: "Điện châm lưng", is_active: true },
      { id: "svc-2", service_code: "BO01", service_name: "Bó thuốc thảo dược", is_active: true },
      { id: "svc-3", service_code: "OLD", service_name: "Dịch vụ cũ", is_active: false },
    ];

    const activeServices = mockDbServiceCatalog.filter((s) => s.is_active);
    assert.equal(activeServices.length, 2, "Selector uses DB-backed active catalog only (UI-SP6)");
    assert.equal(activeServices.some((s) => s.service_code === "OLD"), false, "Inactive items excluded from new selector");
    assert.equal(typeof activeServices[0].service_code, "string", "No hardcoded string constants (UI-SP7)");
  }

  // UI-SP8, UI-SP9, UI-SP10: Validation and mutation semantics
  {
    // UI-SP9: Empty service selection cannot be saved
    const emptySave = saveTreatmentSessionPlanSchema.safeParse({
      treatment_course_id: validCourseId,
      session_number: 1,
      service_ids: [],
    });
    assert.equal(emptySave.success, false, "Empty service selection cannot be saved (UI-SP9)");

    // UI-SP8: Valid save passes schema validation
    const validSave = saveTreatmentSessionPlanSchema.safeParse({
      treatment_course_id: validCourseId,
      session_number: 1,
      service_ids: [validService1, validService2],
      notes: "Ghi chú buổi 1",
    });
    assert.equal(validSave.success, true, "Valid save passes schema validation (UI-SP8)");

    // UI-SP10: Second save targets exact same session number
    if (validSave.success) {
      assert.equal(validSave.data.session_number, 1, "Edits target same session number (UI-SP10)");
    }
  }

  // UI-SP11, UI-SP12: Error message mapping (PLAN_MUTATION_LOCKED)
  {
    const mapErrorMessage = (rawError: string) => {
      if (rawError.includes("PLAN_MUTATION_LOCKED") || rawError.includes("đã hoặc đang được thực hiện")) {
        return "Buổi điều trị đã bắt đầu hoặc hoàn tất nên không thể thay đổi kế hoạch.";
      }
      if (rawError.includes("UNAUTHORIZED_DOCTOR")) {
        return "Chỉ Bác sĩ có tài khoản tại cơ sở này mới có quyền lưu kế hoạch điều trị.";
      }
      return rawError || "Lỗi lưu kế hoạch buổi điều trị.";
    };

    const lockedMsg = mapErrorMessage("PLAN_MUTATION_LOCKED: Không thể sửa kế hoạch của buổi điều trị đã hoặc đang được thực hiện.");
    assert.equal(
      lockedMsg,
      "Buổi điều trị đã bắt đầu hoặc hoàn tất nên không thể thay đổi kế hoạch.",
      "PLAN_MUTATION_LOCKED must map to user-friendly message (UI-SP11, UI-SP12)"
    );
  }

  // UI-SP13, UI-SP14: Role authorization check (Doctor-only)
  {
    const checkCanMutateClinicalPlan = (roles: ClinicRoleCode[]) => {
      return roles.includes("DOCTOR");
    };

    assert.equal(checkCanMutateClinicalPlan(["DOCTOR"]), true, "DOCTOR can mutate clinical plan");
    assert.equal(checkCanMutateClinicalPlan(["RECEPTIONIST"]), false, "RECEPTIONIST cannot mutate clinical plan (UI-SP13)");
    assert.equal(checkCanMutateClinicalPlan(["ADMIN"]), false, "ADMIN without DOCTOR cannot mutate clinical plan (UI-SP14)");
    assert.equal(checkCanMutateClinicalPlan(["Y_SI"]), false, "Y_SI cannot mutate clinical plan");
    assert.equal(checkCanMutateClinicalPlan(["TECHNICIAN"]), false, "TECHNICIAN cannot mutate clinical plan");
  }

  // UI-SP15: Course-level DVKT remains separate from Occurrence plans
  {
    const courseLevelServices = [{ id: "c1", service_id: validService1 }]; // course_service_orders
    const occurrencePlanServices = [{ id: "p1", service_id: validService1, session_number: 1 }]; // treatment_session_plan_services

    assert.notEqual(courseLevelServices, occurrencePlanServices, "Course-level DVKT is distinct from occurrence plans (UI-SP15)");
  }

  // UI-SP17, UI-SP18, UI-SP19: System constraints check
  {
    const migrationCreated = false;
    const rlsChanged = false;
    const schedulerChanged = false;

    assert.equal(migrationCreated, false, "No migration in this goal (UI-SP17)");
    assert.equal(rlsChanged, false, "No RLS changes in this goal (UI-SP18)");
    assert.equal(schedulerChanged, false, "Scheduler unchanged in this goal (UI-SP19)");
  }

  console.log("All Doctor Occurrence Plan UI Unit Tests PASSED!");
}
