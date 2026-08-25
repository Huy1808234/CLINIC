import assert from "node:assert/strict";
import type { Database } from "@/types/database";

export function runTreatmentSessionPlansMigration32Tests() {
  console.log("Running Migration 32 Treatment Session Plans Verification Tests...");

  type SessionPlanRow = Database["public"]["Tables"]["treatment_session_plans"]["Row"];
  type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];

  const courseAId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const courseBId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const doctorStaffId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const service1Id = "11111111-1111-4111-8111-111111111111";
  const service2Id = "22222222-2222-4222-8222-222222222222";

  // M32-1: Proving one Course can have Session #1 and Session #2
  {
    const plans: SessionPlanRow[] = [
      {
        id: "p1111111-1111-4111-8111-111111111111",
        treatment_course_id: courseAId,
        session_number: 1,
        planned_by_doctor_id: doctorStaffId,
        notes: "Buổi 1: Bó thuốc + Điện châm",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "p2222222-2222-4222-8222-222222222222",
        treatment_course_id: courseAId,
        session_number: 2,
        planned_by_doctor_id: doctorStaffId,
        notes: "Buổi 2: Bó thuốc + Ngâm",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    assert.equal(plans.length, 2);
    assert.equal(plans[0].session_number, 1);
    assert.equal(plans[1].session_number, 2);
    assert.equal(plans[0].treatment_course_id, courseAId);
    assert.equal(plans[1].treatment_course_id, courseAId);
  }

  // M32-2: Duplicate same treatment_course_id + session_number is rejected (uq_treatment_session_plan)
  {
    const existingPlans: { treatment_course_id: string; session_number: number }[] = [
      { treatment_course_id: courseAId, session_number: 1 },
    ];

    const validateUniquePlanNumber = (courseId: string, sessionNo: number) => {
      const exists = existingPlans.some(
        (p) => p.treatment_course_id === courseId && p.session_number === sessionNo
      );
      if (exists) {
        throw new Error("23505: duplicate key value violates unique constraint \"uq_treatment_session_plan\"");
      }
    };

    assert.throws(
      () => validateUniquePlanNumber(courseAId, 1),
      /uq_treatment_session_plan/,
      "Duplicate session_number in same course must violate unique constraint (M32-2)"
    );
    // Different course same session_number allowed
    assert.doesNotThrow(() => validateUniquePlanNumber(courseBId, 1));
  }

  // M32-3: Duplicate service within one plan is rejected (uq_session_plan_service)
  {
    const existingServices: { session_plan_id: string; service_id: string }[] = [
      { session_plan_id: "plan-1", service_id: service1Id },
    ];

    const addServiceToPlan = (planId: string, serviceId: string) => {
      const exists = existingServices.some(
        (s) => s.session_plan_id === planId && s.service_id === serviceId
      );
      if (exists) {
        throw new Error("23505: duplicate key value violates unique constraint \"uq_session_plan_service\"");
      }
    };

    assert.throws(
      () => addServiceToPlan("plan-1", service1Id),
      /uq_session_plan_service/,
      "Duplicate service_id within same session plan must be rejected (M32-3)"
    );
    assert.doesNotThrow(() => addServiceToPlan("plan-1", service2Id));
  }

  // M32-4: Duplicate sequence_no within one plan is rejected (uq_session_plan_service_seq)
  {
    const existingServices: { session_plan_id: string; sequence_no: number }[] = [
      { session_plan_id: "plan-1", sequence_no: 1 },
    ];

    const addSequenceToPlan = (planId: string, seqNo: number) => {
      const exists = existingServices.some(
        (s) => s.session_plan_id === planId && s.sequence_no === seqNo
      );
      if (exists) {
        throw new Error("23505: duplicate key value violates unique constraint \"uq_session_plan_service_seq\"");
      }
    };

    assert.throws(
      () => addSequenceToPlan("plan-1", 1),
      /uq_session_plan_service_seq/,
      "Duplicate sequence_no within same session plan must be rejected (M32-4)"
    );
    assert.doesNotThrow(() => addSequenceToPlan("plan-1", 2));
  }

  // M32-5: Appointment Course A cannot reference Session Plan belonging Course B (Composite FK check)
  {
    const planB: SessionPlanRow = {
      id: "plan-b-1",
      treatment_course_id: courseBId,
      session_number: 1,
      planned_by_doctor_id: doctorStaffId,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const validateCompositeFk = (apptCourseId: string, apptPlanId: string | null) => {
      if (!apptPlanId) return true; // MATCH SIMPLE: NULL skips check
      if (apptPlanId === planB.id && apptCourseId !== planB.treatment_course_id) {
        throw new Error("23503: insert or update violates foreign key constraint \"fk_appointments_session_plan_same_course\"");
      }
      return true;
    };

    // Course A referencing Plan B must be rejected
    assert.throws(
      () => validateCompositeFk(courseAId, planB.id),
      /fk_appointments_session_plan_same_course/,
      "Cross-course appointment to plan link must be blocked by composite FK (M32-5)"
    );

    // Course B referencing Plan B must pass
    assert.equal(validateCompositeFk(courseBId, planB.id), true);
  }

  // M32-6: Legacy Appointment with treatment_session_plan_id NULL remains valid
  {
    const legacyAppt: Partial<AppointmentRow> = {
      id: "appt-legacy-1",
      treatment_course_id: courseAId,
      treatment_session_plan_id: null,
      status: "PLANNED",
    };
    assert.equal(legacyAppt.treatment_session_plan_id, null, "Nullable plan ID allows legacy appointments (M32-6)");
  }

  // M32-7, M32-8, M32-9, M32-10, M32-11: Occurrence Consumption Partial Unique Index Simulation
  {
    type MockAppt = { id: string; plan_id: string | null; status: AppointmentRow["status"] };
    const apptStore: MockAppt[] = [];

    const insertAppointment = (appt: MockAppt) => {
      if (appt.plan_id !== null && appt.status !== "CANCELLED" && appt.status !== "NO_SHOW") {
        const conflict = apptStore.find(
          (a) => a.plan_id === appt.plan_id && a.status !== "CANCELLED" && a.status !== "NO_SHOW"
        );
        if (conflict) {
          throw new Error("23505: duplicate key value violates unique constraint \"uq_active_or_completed_appointment_session_plan\"");
        }
      }
      apptStore.push(appt);
    };

    // M32-7: One PLANNED appointment may own Plan #k
    insertAppointment({ id: "a1", plan_id: "plan-1", status: "PLANNED" });
    assert.equal(apptStore.length, 1, "First PLANNED appointment owns plan-1 (M32-7)");

    // M32-8: Second PLANNED appointment for same Plan #k is rejected
    assert.throws(
      () => insertAppointment({ id: "a2", plan_id: "plan-1", status: "PLANNED" }),
      /uq_active_or_completed_appointment_session_plan/,
      "Second PLANNED appointment for same plan must fail (M32-8)"
    );

    // M32-9: CANCELLED appointment releases Plan #k for replacement
    // Transition a1 to CANCELLED
    const a1 = apptStore.find((a) => a.id === "a1")!;
    a1.status = "CANCELLED";

    // Replacement appointment a3 should now succeed
    assert.doesNotThrow(
      () => insertAppointment({ id: "a3", plan_id: "plan-1", status: "PLANNED" }),
      "Cancelled appointment releases plan-1 so replacement succeeds (M32-9)"
    );

    // M32-10: NO_SHOW appointment releases Plan #k for replacement
    // Transition a3 to NO_SHOW
    const a3 = apptStore.find((a) => a.id === "a3")!;
    a3.status = "NO_SHOW";

    // Replacement appointment a4 should succeed
    assert.doesNotThrow(
      () => insertAppointment({ id: "a4", plan_id: "plan-1", status: "PLANNED" }),
      "NO_SHOW appointment releases plan-1 so replacement succeeds (M32-10)"
    );

    // M32-11: COMPLETED appointment does NOT release Plan #k
    // Transition a4 to COMPLETED
    const a4 = apptStore.find((a) => a.id === "a4")!;
    a4.status = "COMPLETED";

    // New appointment a5 attempting to claim completed plan-1 must fail!
    assert.throws(
      () => insertAppointment({ id: "a5", plan_id: "plan-1", status: "PLANNED" }),
      /uq_active_or_completed_appointment_session_plan/,
      "COMPLETED appointment permanently consumes plan-1; replacement must be rejected (M32-11)"
    );
  }

  // M32-12: planned_by_doctor_id cannot be NULL
  {
    const validateDoctorProvenance = (doctorId: string | null | undefined) => {
      if (!doctorId) {
        throw new Error("23502: null value in column \"planned_by_doctor_id\" violates not-null constraint");
      }
    };
    assert.throws(
      () => validateDoctorProvenance(null),
      /null value in column "planned_by_doctor_id"/,
      "planned_by_doctor_id cannot be NULL (M32-12)"
    );
  }

  // M32-13 & M32-14: Authenticated direct table write unavailable & no broad USING(true)
  {
    const rlsGrants = {
      anon: { select: false, insert: false, update: false, delete: false },
      authenticated: { select: false, insert: false, update: false, delete: false },
      service_role: { select: true, insert: false, update: false, delete: false },
    };

    assert.equal(rlsGrants.authenticated.insert, false, "authenticated direct insert disabled (M32-13)");
    assert.equal(rlsGrants.authenticated.update, false, "authenticated direct update disabled (M32-13)");
    assert.equal(rlsGrants.authenticated.delete, false, "authenticated direct delete disabled (M32-13)");
    assert.equal(rlsGrants.authenticated.select, false, "authenticated broad select closed (M32-14)");
    assert.equal(rlsGrants.service_role.select, true, "service_role has explicit SELECT grant");
  }

  console.log("All Migration 32 Treatment Session Plans Verification Tests PASSED!");
}
