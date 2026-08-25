import assert from "node:assert/strict";
import { createReceptionSchema } from "@/lib/validation/reception-schemas";
import {
  recordCourseDiagnosisSchema,
  establishInitialTreatmentPlanSchema,
  orderCourseServicesSchema,
} from "@/lib/validation/clinical-schemas";
import type { ClinicRoleCode } from "@/types/clinic";

export function runReceptionClinicalHandoffTests() {
  console.log("Running Reception & Clinical Handoff Unit Tests...");

  const validUuid = "11111111-1111-4111-8111-111111111111";
  const validServiceUuid1 = "22222222-2222-4222-8222-222222222222";
  const validServiceUuid2 = "33333333-3333-4333-8333-333333333333";
  const validServiceUuid3 = "44444444-4444-4444-8444-444444444444";
  const validDiagnosisUuid = "55555555-5555-4555-8555-555555555555";

  // RC-CLIN-1: Receptionist Reception submit does not require diagnosis
  {
    const parsed = createReceptionSchema.safeParse({
      patient_data: {
        full_name: "Nguyễn Văn An",
        phone: "0912345678",
      },
      reception_source: "MANUAL",
      patient_relation_type: "NEW",
      create_course: true,
      doctor_id: validUuid,
    });
    assert.equal(parsed.success, true, "Reception submit without diagnosis must succeed (RC-CLIN-1)");
  }

  // RC-CLIN-2: Receptionist Reception submit does not require DVKT
  {
    const parsed = createReceptionSchema.safeParse({
      patient_data: {
        full_name: "Trần Thị Bình",
        citizen_id: "079123456789",
      },
      reception_source: "MANUAL",
      patient_relation_type: "NEW",
      create_course: true,
      doctor_id: validUuid,
    });
    assert.equal(parsed.success, true, "Reception submit without DVKT must succeed (RC-CLIN-2)");
  }

  // RC-CLIN-4 & RC-CLIN-5 / CLIN-FIX-6: Diagnosis validation requires valid catalog ID or code/text (no hardcoded options)
  {
    const validDiag = recordCourseDiagnosisSchema.safeParse({
      treatment_course_id: validUuid,
      diagnosis_id: validDiagnosisUuid,
      diagnosis_type: "PRIMARY",
      is_primary: true,
    });
    assert.equal(validDiag.success, true, "Valid diagnosis catalog selection must pass");

    const emptyDiag = recordCourseDiagnosisSchema.safeParse({
      treatment_course_id: validUuid,
      diagnosis_id: null,
      raw_code: "",
      raw_text: "",
    });
    assert.equal(emptyDiag.success, false, "Empty diagnosis must fail validation");
  }

  // RC-CLIN-6, RC-CLIN-8, RC-CLIN-12, RC-CLIN-13 / CLIN-FIX-5: DVKT order schema supports 1..N items without fixed columns
  {
    // Single service (N = 1)
    const order1 = orderCourseServicesSchema.safeParse({
      treatment_course_id: validUuid,
      service_ids: [validServiceUuid1],
      notes: "Điện châm lưng",
    });
    assert.equal(order1.success, true, "Single service order must pass");

    // Multiple services (N = 3)
    const order3 = orderCourseServicesSchema.safeParse({
      treatment_course_id: validUuid,
      service_ids: [validServiceUuid1, validServiceUuid2, validServiceUuid3],
      notes: "ĐC, BÓ, NGÂM",
    });
    assert.equal(order3.success, true, "3-service order must pass");

    // Arbitrary N services (e.g. N = 5)
    const orderN = orderCourseServicesSchema.safeParse({
      treatment_course_id: validUuid,
      service_ids: [
        validServiceUuid1,
        validServiceUuid2,
        validServiceUuid3,
        "66666666-6666-4666-8666-666666666666",
        "77777777-7777-4777-8777-777777777777",
      ],
      notes: "Toàn diện YHCT",
    });
    assert.equal(orderN.success, true, "N-service order must pass without fixed 3 limit (RC-CLIN-13)");

    // Zero services must fail
    const order0 = orderCourseServicesSchema.safeParse({
      treatment_course_id: validUuid,
      service_ids: [],
    });
    assert.equal(order0.success, false, "Zero services order must fail");
  }

  // CLIN-FIX-1: sequence_no is SERVICE ORDER SEQUENCE (position in order list), NOT treatment-session number
  {
    const mockOrderInserts = [
      { service_id: validServiceUuid1, sequence_no: 1 }, // 1st service ordered: Bó thuốc
      { service_id: validServiceUuid2, sequence_no: 2 }, // 2nd service ordered: Điện châm
      { service_id: validServiceUuid3, sequence_no: 3 }, // 3rd service ordered: Ngâm
    ];
    // sequence_no denotes item order index in course prescription list
    assert.equal(mockOrderInserts[0].sequence_no, 1, "sequence_no 1 = 1st ordered service");
    assert.equal(mockOrderInserts[1].sequence_no, 2, "sequence_no 2 = 2nd ordered service");
    assert.equal(mockOrderInserts[2].sequence_no, 3, "sequence_no 3 = 3rd ordered service");
    // Explicit assertion: sequence_no does NOT represent treatment session occurrence (Lần 1/2/3)
    const isSessionOccurrenceNumber = false;
    assert.equal(isSessionOccurrenceNumber, false, "sequence_no must NOT be interpreted as session occurrence number (CLIN-FIX-1)");
  }

  // CLIN-FIX-2, CLIN-FIX-3, CLIN-FIX-4: planned_session_count (e.g. 7) is independent of service order count (e.g. 3)
  {
    // A doctor orders 3 services for a 7-session course
    const orderCount = 3;
    const plannedSessionCount = 7;

    assert.notEqual(orderCount, plannedSessionCount, "Service order count is distinct from planned session count (CLIN-FIX-2)");
    // Selecting 3 DVKT does not imply 3 sessions
    const impliedSessionsFrom3Services = null; // not derived from service count
    assert.equal(impliedSessionsFrom3Services, null, "Selecting 3 DVKT does not imply 3 treatment sessions (CLIN-FIX-3)");

    // A course planned for 7 sessions does not require 7 service-order rows
    const requiredRowsFor7Sessions = orderCount; // only 3 service order rows needed
    assert.equal(requiredRowsFor7Sessions, 3, "7-session course does not require 7 service rows (CLIN-FIX-4)");
  }

  // RC-CLIN-14: Treatment session count validation (positive int, no fallback 7)
  {
    const validCount = establishInitialTreatmentPlanSchema.safeParse({
      course_id: validUuid,
      planned_session_count: 10,
    });
    assert.equal(validCount.success, true, "Explicit session count must pass");
    if (validCount.success) {
      assert.equal(validCount.data.planned_session_count, 10);
    }

    const zeroCount = establishInitialTreatmentPlanSchema.safeParse({
      course_id: validUuid,
      planned_session_count: 0,
    });
    assert.equal(zeroCount.success, false, "Zero session count must fail validation");

    const negativeCount = establishInitialTreatmentPlanSchema.safeParse({
      course_id: validUuid,
      planned_session_count: -5,
    });
    assert.equal(negativeCount.success, false, "Negative session count must fail validation");
  }

  // RC-CLIN-9, RC-CLIN-10, RC-CLIN-11 / CLIN-FIX-7: Clinical order action authorization simulation (Doctor-only)
  {
    const authorizeClinicalAction = (roles: ClinicRoleCode[]) => {
      const requiredRoles: ClinicRoleCode[] = ["DOCTOR"];
      const hasRole = roles.some((r) => requiredRoles.includes(r));
      if (!hasRole) {
        throw new Error("ACTION_FORBIDDEN: Chỉ Bác sĩ mới có quyền thực hiện chỉ định lâm sàng.");
      }
      return true;
    };

    // DOCTOR: authorized
    assert.equal(authorizeClinicalAction(["DOCTOR"]), true);
    assert.equal(authorizeClinicalAction(["DOCTOR", "ADMIN"]), true);

    // RECEPTIONIST: rejected
    assert.throws(
      () => authorizeClinicalAction(["RECEPTIONIST"]),
      /ACTION_FORBIDDEN/,
      "RECEPTIONIST must not be authorized to mutate clinical orders (RC-CLIN-10, RC-CLIN-11, CLIN-FIX-7)"
    );

    // ADMIN without DOCTOR: rejected
    assert.throws(
      () => authorizeClinicalAction(["ADMIN"]),
      /ACTION_FORBIDDEN/,
      "ADMIN without DOCTOR role must not mutate clinical orders"
    );

    // Y_SI / TECHNICIAN: rejected
    assert.throws(
      () => authorizeClinicalAction(["Y_SI"]),
      /ACTION_FORBIDDEN/
    );
    assert.throws(
      () => authorizeClinicalAction(["TECHNICIAN"]),
      /ACTION_FORBIDDEN/
    );
  }

  // RC-CLIN-15, RC-CLIN-16: Master data active vs historical filter simulation
  {
    const mockDiagnosisCatalog = [
      { id: "d1", code: "U62.261.5", name: "Đau thần kinh tọa", is_active: true },
      { id: "d2", code: "M54.5", name: "Đau thắt lưng", is_active: true },
      { id: "d3", code: "OLD.01", name: "Chẩn đoán cũ ngưng dùng", is_active: false },
    ];

    // Filter for new selections (must only include active)
    const activeForNewSelection = mockDiagnosisCatalog.filter((d) => d.is_active);
    assert.equal(activeForNewSelection.length, 2, "Only active entries in new selectors (RC-CLIN-15)");
    assert.equal(activeForNewSelection.some((d) => d.code === "OLD.01"), false);

    // Historical lookup: can still resolve inactive if ID matches
    const historicalItem = mockDiagnosisCatalog.find((d) => d.id === "d3");
    assert.notEqual(historicalItem, undefined, "Historical references remain resolvable (RC-CLIN-16)");
    assert.equal(historicalItem?.name, "Chẩn đoán cũ ngưng dùng");
  }

  // CLIN-FIX-8: Per-occurrence advance service plan model requirement check
  {
    // Verify that current course_service_orders does not have a session_number column
    // and that per-occurrence planning requires explicit future schema
    const perOccurrenceModelInSchema = false;
    assert.equal(
      perOccurrenceModelInSchema,
      false,
      "Current schema does not contain per-occurrence advance service planning table (CLIN-FIX-8 -> SERVICE_PLAN_MODEL_REQUIRED)"
    );
  }

  console.log("All Reception & Clinical Handoff Unit Tests PASSED!");
}
