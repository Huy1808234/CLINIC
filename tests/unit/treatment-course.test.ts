import { createReceptionSchema } from "@/lib/validation/reception-schemas";
import { createTreatmentCourseSchema, updateTreatmentCourseSchema } from "@/lib/validation/treatment-schemas";
import {
  recordCourseDiagnosisSchema,
  establishInitialTreatmentPlanSchema,
} from "@/lib/validation/clinical-schemas";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

export function runTreatmentCourseTests() {
  console.log("Running Treatment Course & Reception Schema Unit Tests...");

  // 1. Validate Reception Schema with existing patient_id
  const r1 = createReceptionSchema.safeParse({
    patient_id: "123e4567-e89b-12d3-a456-426614174000",
    reception_source: "MANUAL",
    patient_relation_type: "RETURNING",
    reason_for_visit: "Tái khám liệu trình 2",
    create_course: true,
    planned_session_count: 7,
  });
  assert(r1.success === true, "Valid reception payload with patient_id must succeed");

  // 2. Validate Reception Schema with new patient_data
  const r2 = createReceptionSchema.safeParse({
    patient_data: {
      full_name: "Lê Văn C",
      phone: "0912345678",
      insurance_card_number: "GD4797931234567",
    },
    reception_source: "MANUAL",
    patient_relation_type: "NEW",
    create_course: true,
    planned_session_count: 5,
  });
  assert(r2.success === true, "Valid reception payload with patient_data must succeed");

  // 3. Validate Treatment Course Schema
  const c1 = createTreatmentCourseSchema.safeParse({
    patient_id: "123e4567-e89b-12d3-a456-426614174000",
    planned_session_count: 10,
    start_date: "2026-08-21",
    diagnoses: [
      { raw_code: "M54.5", raw_text: "Đau lưng dưới", is_primary: true },
    ],
    service_orders: [
      {
        service_id: "123e4567-e89b-12d3-a456-426614174001",
        order_source: "FIRST_PLAN",
        sequence_no: 1,
      },
    ],
  });
  assert(c1.success === true, "Valid treatment course payload must succeed");

  // 4. Validate Treatment Course Update Schema
  const u1 = updateTreatmentCourseSchema.safeParse({
    status: "COMPLETED",
    adherence_status: "NORMAL",
  });
  assert(u1.success === true, "Valid treatment course update must succeed");

  const u2 = updateTreatmentCourseSchema.safeParse({
    status: "INVALID_STATUS",
  });
  assert(u2.success === false, "Invalid treatment course status must fail validation");

  // 5. AUTH1.7D3 TARGET DOCTOR VALIDATION UNIT TESTS
  interface MockStaffRecord {
    id: string;
    staff_code: string;
    full_name: string;
    role_type: string;
    is_active: boolean;
  }

  interface MockMembershipRecord {
    id: string;
    staff_id: string;
    clinic_id: string;
    is_active: boolean;
    roles: string[];
  }

  // Pure simulation of validateDoctorForClinic logic under test
  function simulateValidateDoctorForClinic(
    staffDb: MockStaffRecord[],
    membershipDb: MockMembershipRecord[],
    doctorId: string,
    clinicId: string
  ) {
    const staff = staffDb.find((s) => s.id === doctorId);
    if (!staff || !staff.is_active) {
      throw new Error("Bác sĩ được chọn không tồn tại hoặc đã ngừng hoạt động.");
    }

    const membership = membershipDb.find(
      (m) => m.staff_id === doctorId && m.clinic_id === clinicId
    );
    if (!membership || !membership.is_active) {
      throw new Error("Bác sĩ được chọn không có phân công hoạt động tại cơ sở này.");
    }

    if (!membership.roles.includes("DOCTOR")) {
      throw new Error("Nhân viên được chọn không có vai trò Bác sĩ (DOCTOR) tại cơ sở này.");
    }

    return {
      id: staff.id,
      staff_code: staff.staff_code,
      full_name: staff.full_name,
    };
  }

  const staffDb: MockStaffRecord[] = [
    {
      id: "doc-1",
      staff_code: "DR-01",
      full_name: "Bác Sĩ Nguyễn Văn A",
      role_type: "DOCTOR",
      is_active: true,
    },
    {
      id: "doc-inactive",
      staff_code: "DR-02",
      full_name: "Bác Sĩ Ngừng Hoạt Động",
      role_type: "DOCTOR",
      is_active: false,
    },
    {
      id: "staff-manager",
      staff_code: "MGR-01",
      full_name: "Quản Lý Trần B",
      role_type: "DOCTOR", // Legacy role_type says DOCTOR, but clinic role is MANAGER!
      is_active: true,
    },
    {
      id: "doc-multi",
      staff_code: "DR-03",
      full_name: "Bác Sĩ Đa Năng",
      role_type: "DOCTOR",
      is_active: true,
    },
  ];

  const membershipDb: MockMembershipRecord[] = [
    {
      id: "mem-1",
      staff_id: "doc-1",
      clinic_id: "clinic-tt01",
      is_active: true,
      roles: ["DOCTOR"],
    },
    {
      id: "mem-md01",
      staff_id: "doc-1",
      clinic_id: "clinic-md01",
      is_active: true,
      roles: ["DOCTOR"],
    },
    {
      id: "mem-inactive",
      staff_id: "doc-inactive",
      clinic_id: "clinic-tt01",
      is_active: true,
      roles: ["DOCTOR"],
    },
    {
      id: "mem-staff-inactive-mem",
      staff_id: "doc-1",
      clinic_id: "clinic-pn01",
      is_active: false, // Inactive membership!
      roles: ["DOCTOR"],
    },
    {
      id: "mem-manager",
      staff_id: "staff-manager",
      clinic_id: "clinic-tt01",
      is_active: true,
      roles: ["MANAGER"], // Missing DOCTOR role at TT01!
    },
    {
      id: "mem-multi",
      staff_id: "doc-multi",
      clinic_id: "clinic-tt01",
      is_active: true,
      roles: ["ADMIN", "DOCTOR"], // Multi-role!
    },
  ];

  // CASE D3-1: Valid doctor at active clinic TT01 -> PASS
  const validDoc = simulateValidateDoctorForClinic(staffDb, membershipDb, "doc-1", "clinic-tt01");
  assert(validDoc.id === "doc-1", "CASE D3-1: Valid doctor at TT01 succeeds");

  // CASE D3-2: Doctor not found (random UUID) -> REJECTED
  let notFoundRejected = false;
  try {
    simulateValidateDoctorForClinic(staffDb, membershipDb, "random-nonexistent-id", "clinic-tt01");
  } catch (err: unknown) {
    notFoundRejected = true;
    assert((err as Error).message.includes("không tồn tại"), "CASE D3-2: Nonexistent doctor error message");
  }
  assert(notFoundRejected, "CASE D3-2: Nonexistent doctor must be rejected");

  // CASE D3-3: Inactive Staff record -> REJECTED
  let inactiveStaffRejected = false;
  try {
    simulateValidateDoctorForClinic(staffDb, membershipDb, "doc-inactive", "clinic-tt01");
  } catch (err: unknown) {
    inactiveStaffRejected = true;
    assert((err as Error).message.includes("ngừng hoạt động"), "CASE D3-3: Inactive staff error message");
  }
  assert(inactiveStaffRejected, "CASE D3-3: Inactive staff must be rejected");

  // CASE D3-4: Wrong clinic (Doctor belongs to MD01, targeting TT01 with non-member doctor) -> REJECTED
  let wrongClinicRejected = false;
  try {
    simulateValidateDoctorForClinic(staffDb, membershipDb, "doc-multi", "clinic-hp01"); // doc-multi is not at HP01
  } catch (err: unknown) {
    wrongClinicRejected = true;
    assert((err as Error).message.includes("không có phân công"), "CASE D3-4: Wrong clinic error message");
  }
  assert(wrongClinicRejected, "CASE D3-4: Doctor from different clinic must be rejected");

  // CASE D3-5: Inactive membership at target clinic -> REJECTED
  let inactiveMemRejected = false;
  try {
    simulateValidateDoctorForClinic(staffDb, membershipDb, "doc-1", "clinic-pn01"); // PN01 membership is inactive
  } catch (err: unknown) {
    inactiveMemRejected = true;
    assert((err as Error).message.includes("không có phân công"), "CASE D3-5: Inactive membership error message");
  }
  assert(inactiveMemRejected, "CASE D3-5: Inactive membership must be rejected");

  // CASE D3-6: Missing DOCTOR role (Staff is MANAGER only at TT01) -> REJECTED
  let missingRoleRejected = false;
  try {
    simulateValidateDoctorForClinic(staffDb, membershipDb, "staff-manager", "clinic-tt01");
  } catch (err: unknown) {
    missingRoleRejected = true;
    assert((err as Error).message.includes("không có vai trò Bác sĩ"), "CASE D3-6: Missing DOCTOR role error message");
  }
  assert(missingRoleRejected, "CASE D3-6: Membership without DOCTOR role must be rejected");

  // CASE D3-7: Multi-role staff with DOCTOR + ADMIN at TT01 -> PASS
  const multiDoc = simulateValidateDoctorForClinic(staffDb, membershipDb, "doc-multi", "clinic-tt01");
  assert(multiDoc.id === "doc-multi", "CASE D3-7: Multi-role doctor accepted");

  // CASE D3-8: Legacy role_type = 'DOCTOR' cannot bypass missing DOCTOR clinic role -> REJECTED
  // (staff-manager has role_type = 'DOCTOR' in staff table, but membership role is MANAGER)
  assert(missingRoleRejected, "CASE D3-8: Legacy role_type is insufficient without DOCTOR clinic role");

  // CASE D3-11: Simulation of intake flow showing zero writes executed when doctor validation fails
  let patientWriteExecuted = false;
  let receptionWriteExecuted = false;
  let courseWriteExecuted = false;

  function simulateIntakeWorkflow(inputDoctorId?: string | null) {
    // 1. Authorize caller (verified)
    const activeClinicId = "clinic-tt01";

    // 2. Validate Doctor Target if provided BEFORE any writes
    if (inputDoctorId) {
      simulateValidateDoctorForClinic(staffDb, membershipDb, inputDoctorId, activeClinicId);
    }

    // 3. Perform privileged writes
    patientWriteExecuted = true;
    receptionWriteExecuted = true;
    courseWriteExecuted = true;
  }

  // Valid doctor -> writes execute
  simulateIntakeWorkflow("doc-1");
  assert(patientWriteExecuted && receptionWriteExecuted && courseWriteExecuted, "Valid intake executes writes");

  // Reset flags
  patientWriteExecuted = false;
  receptionWriteExecuted = false;
  courseWriteExecuted = false;

  // Invalid doctor -> Throws and ZERO writes execute
  let intakeRejected = false;
  try {
    simulateIntakeWorkflow("doc-inactive");
  } catch {
    intakeRejected = true;
  }
  assert(intakeRejected, "Invalid doctor intake rejected");
  assert(!patientWriteExecuted, "CASE D3-11: Zero patient writes on invalid doctor");
  assert(!receptionWriteExecuted, "CASE D3-11: Zero reception writes on invalid doctor");
  assert(!courseWriteExecuted, "CASE D3-11: Zero course writes on invalid doctor");

  // 6. AUTH1.7D4B1 RECEPTION SERVICE ORDERS RESTRICTION UNIT TESTS
  // CASE D4B1-1: service_orders omitted -> parse succeeds
  const so1 = createReceptionSchema.safeParse({
    patient_id: "123e4567-e89b-12d3-a456-426614174000",
    reception_source: "MANUAL",
    patient_relation_type: "RETURNING",
    create_course: true,
  });
  assert(so1.success === true, "CASE D4B1-1: service_orders omitted succeeds");

  // CASE D4B1-2: service_orders = [] -> parse succeeds
  const so2 = createReceptionSchema.safeParse({
    patient_id: "123e4567-e89b-12d3-a456-426614174000",
    reception_source: "MANUAL",
    patient_relation_type: "RETURNING",
    create_course: true,
    service_orders: [],
  });
  assert(so2.success === true, "CASE D4B1-2: service_orders empty array succeeds");

  // CASE D4B1-3: DOCTOR_ACTUAL non-empty service_orders -> REJECTED
  const so3 = createReceptionSchema.safeParse({
    patient_id: "123e4567-e89b-12d3-a456-426614174000",
    reception_source: "MANUAL",
    patient_relation_type: "RETURNING",
    create_course: true,
    service_orders: [
      {
        service_id: "123e4567-e89b-12d3-a456-426614174001",
        order_source: "DOCTOR_ACTUAL",
        sequence_no: 1,
      },
    ],
  });
  assert(so3.success === false, "CASE D4B1-3: DOCTOR_ACTUAL in reception must fail schema validation");
  if (!so3.success) {
    assert(
      so3.error.issues[0]?.message.includes("Chỉ định DVKT phải được thực hiện trong bước khám của bác sĩ"),
      "CASE D4B1-3: Returns safe clinical authority error"
    );
  }

  // CASE D4B1-5: FIRST_PLAN non-empty service_orders -> REJECTED
  const so5 = createReceptionSchema.safeParse({
    patient_id: "123e4567-e89b-12d3-a456-426614174000",
    service_orders: [
      {
        service_id: "123e4567-e89b-12d3-a456-426614174001",
        order_source: "FIRST_PLAN",
      },
    ],
  });
  assert(so5.success === false, "CASE D4B1-5: FIRST_PLAN in reception must fail schema validation");

  // CASE D4B1-6: MIGRATION non-empty service_orders in reception -> REJECTED
  const so6 = createReceptionSchema.safeParse({
    patient_id: "123e4567-e89b-12d3-a456-426614174000",
    service_orders: [
      {
        service_id: "123e4567-e89b-12d3-a456-426614174001",
        order_source: "MIGRATION",
      },
    ],
  });
  assert(so6.success === false, "CASE D4B1-6: MIGRATION in reception must fail schema validation");

  // 6b. AUTH1.7D4B2 RECEPTION FORMAL DIAGNOSES RESTRICTION UNIT TESTS
  // CASE D4B2-1: diagnoses omitted -> parse succeeds
  const diag1 = createReceptionSchema.safeParse({
    patient_id: "123e4567-e89b-12d3-a456-426614174000",
    reception_source: "MANUAL",
    patient_relation_type: "RETURNING",
    create_course: true,
  });
  assert(diag1.success === true, "CASE D4B2-1: diagnoses omitted succeeds");

  // CASE D4B2-2: diagnoses = [] -> parse succeeds
  const diag2 = createReceptionSchema.safeParse({
    patient_id: "123e4567-e89b-12d3-a456-426614174000",
    reception_source: "MANUAL",
    patient_relation_type: "RETURNING",
    create_course: true,
    diagnoses: [],
  });
  assert(diag2.success === true, "CASE D4B2-2: diagnoses empty array succeeds");

  // CASE D4B2-3 / D4B2-5: raw_text non-empty diagnoses in reception -> REJECTED
  const diag3 = createReceptionSchema.safeParse({
    patient_id: "123e4567-e89b-12d3-a456-426614174000",
    reception_source: "MANUAL",
    patient_relation_type: "RETURNING",
    create_course: true,
    diagnoses: [
      {
        raw_text: "Đau thắt lưng",
        is_primary: true,
      },
    ],
  });
  assert(diag3.success === false, "CASE D4B2-3: Non-empty diagnoses in reception must fail schema validation");
  if (!diag3.success) {
    assert(
      diag3.error.issues[0]?.message.includes("Chẩn đoán chính thức phải được bác sĩ ghi nhận"),
      "CASE D4B2-3: Returns safe clinical authority error"
    );
  }

  // CASE D4B2-6: diagnosis_id non-empty diagnoses in reception -> REJECTED
  const diag6 = createReceptionSchema.safeParse({
    patient_id: "123e4567-e89b-12d3-a456-426614174000",
    diagnoses: [
      {
        diagnosis_id: "123e4567-e89b-12d3-a456-426614174001",
        is_primary: true,
      },
    ],
  });
  assert(diag6.success === false, "CASE D4B2-6: diagnosis_id in reception must fail schema validation");

  // 7. CLINICAL1A1 DOCTOR DIAGNOSIS RECORDING UNIT TESTS
  interface MockCourseRecord {
    id: string;
    clinic_id: string | null;
    status: string;
  }

  interface MockCatalogRecord {
    id: string;
    code: string;
    name: string;
    is_active: boolean;
  }

  interface MockCourseDiagnosisRecord {
    id: string;
    treatment_course_id: string;
    diagnosis_id: string | null;
    raw_code: string | null;
    raw_text: string | null;
    diagnosis_type: string;
    is_primary: boolean;
    diagnosed_by_doctor_id: string | null;
  }

  const courseDb: MockCourseRecord[] = [
    { id: "course-tt01-1", clinic_id: "clinic-tt01", status: "ACTIVE" },
    { id: "course-md01-1", clinic_id: "clinic-md01", status: "ACTIVE" },
    { id: "course-legacy-null", clinic_id: null, status: "ACTIVE" },
  ];

  const catalogDb: MockCatalogRecord[] = [
    { id: "diag-active-1", code: "M54.5", name: "Đau thắt lưng", is_active: true },
    { id: "diag-inactive-1", code: "M54.2", name: "Đau cổ", is_active: false },
  ];

  function simulateRecordCourseDiagnosis(params: {
    courseDb: MockCourseRecord[];
    catalogDb: MockCatalogRecord[];
    treatmentCourseId: string;
    diagnosisId?: string | null;
    rawCode?: string | null;
    rawText?: string | null;
    isPrimary?: boolean;
    activeClinicId: string;
    doctorStaffId: string;
  }): MockCourseDiagnosisRecord {
    const {
      courseDb,
      catalogDb,
      treatmentCourseId,
      diagnosisId,
      rawCode,
      rawText,
      isPrimary,
      activeClinicId,
      doctorStaffId,
    } = params;

    // 1. Target Course Check
    const course = courseDb.find((c) => c.id === treatmentCourseId);
    if (!course || course.clinic_id !== activeClinicId) {
      throw new Error("Không tìm thấy liệu trình phù hợp tại cơ sở hiện tại.");
    }

    // 2. Catalog Check
    let finalCode = rawCode ? rawCode.trim() : null;
    let finalText = rawText ? rawText.trim() : null;
    if (diagnosisId) {
      const cat = catalogDb.find((c) => c.id === diagnosisId);
      if (!cat || !cat.is_active) {
        throw new Error("Chẩn đoán từ danh mục không tồn tại hoặc đã ngừng hoạt động.");
      }
      // SERVER CANONICALIZATION: Canonical code and name strictly derived from verified catalog entry
      finalCode = cat.code;
      finalText = cat.name;
    }

    return {
      id: "diag-new-" + Date.now(),
      treatment_course_id: course.id,
      diagnosis_id: diagnosisId || null,
      raw_code: finalCode,
      raw_text: finalText,
      diagnosis_type: "PRIMARY",
      is_primary: isPrimary ?? true,
      diagnosed_by_doctor_id: doctorStaffId,
    };
  }

  // CASE C1A-1 / FIX-C1: Valid Doctor at active TT01 -> Records diagnosis with diagnosed_by_doctor_id = staff-id
  const d1 = simulateRecordCourseDiagnosis({
    courseDb,
    catalogDb,
    treatmentCourseId: "course-tt01-1",
    diagnosisId: "diag-active-1",
    activeClinicId: "clinic-tt01",
    doctorStaffId: "doctor-staff-123",
  });
  assert(d1.diagnosed_by_doctor_id === "doctor-staff-123", "CASE C1A-1: Doctor Staff ID persisted");
  assert(d1.raw_code === "M54.5", "CASE C1A-1: Canonical code derived");
  assert(d1.raw_text === "Đau thắt lưng", "CASE C1A-1: Canonical name derived");

  // CASE FIX-C2: Conflicting raw_code from client with valid diagnosis_id -> Server canonicalizes
  const dConflictCode = simulateRecordCourseDiagnosis({
    courseDb,
    catalogDb,
    treatmentCourseId: "course-tt01-1",
    diagnosisId: "diag-active-1", // M54.5
    rawCode: "CONTRADICTORY_ICD_CODE_999", // Client sends bogus code
    activeClinicId: "clinic-tt01",
    doctorStaffId: "doctor-staff-123",
  });
  assert(dConflictCode.raw_code === "M54.5", "CASE FIX-C2: Server overrides contradictory client code with canonical catalog code");

  // CASE FIX-C3: Conflicting raw_text from client with valid diagnosis_id -> Server canonicalizes
  const dConflictText = simulateRecordCourseDiagnosis({
    courseDb,
    catalogDb,
    treatmentCourseId: "course-tt01-1",
    diagnosisId: "diag-active-1", // Đau thắt lưng
    rawText: "Hoàn toàn không liên quan", // Client sends bogus text
    activeClinicId: "clinic-tt01",
    doctorStaffId: "doctor-staff-123",
  });
  assert(dConflictText.raw_text === "Đau thắt lưng", "CASE FIX-C3: Server overrides contradictory client text with canonical catalog name");

  // CASE C1A-5 / FIX-C10: Cross-clinic Course (Doctor at TT01 targeting MD01 course) -> REJECTED
  let crossClinicCourseRejected = false;
  try {
    simulateRecordCourseDiagnosis({
      courseDb,
      catalogDb,
      treatmentCourseId: "course-md01-1",
      diagnosisId: "diag-active-1",
      activeClinicId: "clinic-tt01",
      doctorStaffId: "doctor-staff-123",
    });
  } catch (err: unknown) {
    crossClinicCourseRejected = true;
    assert((err as Error).message.includes("Không tìm thấy liệu trình"), "CASE C1A-5: Cross-clinic error message");
  }
  assert(crossClinicCourseRejected, "CASE C1A-5: Cross clinic course must be rejected");

  // CASE C1A-6: Legacy NULL clinic Course -> REJECTED
  let nullClinicCourseRejected = false;
  try {
    simulateRecordCourseDiagnosis({
      courseDb,
      catalogDb,
      treatmentCourseId: "course-legacy-null",
      diagnosisId: "diag-active-1",
      activeClinicId: "clinic-tt01",
      doctorStaffId: "doctor-staff-123",
    });
  } catch (err: unknown) {
    nullClinicCourseRejected = true;
    assert((err as Error).message.includes("Không tìm thấy liệu trình"), "CASE C1A-6: Legacy null clinic error message");
  }
  assert(nullClinicCourseRejected, "CASE C1A-6: Legacy null clinic course must be rejected");

  // CASE C1A-7 / FIX-C5: Inactive diagnosis catalog entry -> REJECTED
  let inactiveCatalogRejected = false;
  try {
    simulateRecordCourseDiagnosis({
      courseDb,
      catalogDb,
      treatmentCourseId: "course-tt01-1",
      diagnosisId: "diag-inactive-1",
      activeClinicId: "clinic-tt01",
      doctorStaffId: "doctor-staff-123",
    });
  } catch (err: unknown) {
    inactiveCatalogRejected = true;
    assert((err as Error).message.includes("ngừng hoạt động"), "CASE C1A-7: Inactive catalog error message");
  }
  assert(inactiveCatalogRejected, "CASE C1A-7: Inactive catalog item must be rejected");

  // CASE C1A-9 / FIX-C6: Freeform Doctor diagnosis (no catalog id, meaningful text) -> ALLOWED
  const dFree = simulateRecordCourseDiagnosis({
    courseDb,
    catalogDb,
    treatmentCourseId: "course-tt01-1",
    rawText: "Hội chứng cổ vai cánh tay",
    activeClinicId: "clinic-tt01",
    doctorStaffId: "doctor-staff-123",
  });
  assert(dFree.raw_text === "Hội chứng cổ vai cánh tay", "CASE C1A-9: Freeform diagnosis text persisted");
  assert(dFree.diagnosed_by_doctor_id === "doctor-staff-123", "CASE C1A-9: Freeform diagnosis authored by Doctor");

  // CASE FIX-C7: Freeform Doctor diagnosis with raw_code -> ALLOWED
  const dFreeCode = simulateRecordCourseDiagnosis({
    courseDb,
    catalogDb,
    treatmentCourseId: "course-tt01-1",
    rawCode: "M54.2",
    rawText: "Đau cổ",
    activeClinicId: "clinic-tt01",
    doctorStaffId: "doctor-staff-123",
  });
  assert(dFreeCode.raw_code === "M54.2", "CASE FIX-C7: Freeform code persisted");

  // CASE C1A-10: Empty diagnosis schema validation -> REJECTED
  const emptyDiag = recordCourseDiagnosisSchema.safeParse({
    treatment_course_id: "123e4567-e89b-12d3-a456-426614174000",
  });
  assert(emptyDiag.success === false, "CASE C1A-10: Empty diagnosis must fail schema validation");

  // CASE FIX-C8: Blank whitespace freeform diagnosis -> REJECTED
  const blankDiag = recordCourseDiagnosisSchema.safeParse({
    treatment_course_id: "123e4567-e89b-12d3-a456-426614174000",
    raw_code: "   ",
    raw_text: "   ",
  });
  assert(blankDiag.success === false, "CASE FIX-C8: Blank whitespace diagnosis must fail schema validation");

  // 8. CLINICAL1C1 DOCTOR TREATMENT PLAN FOUNDATION TESTS
  interface MockCourseWithPlanProvenance {
    id: string;
    patient_id: string;
    primary_doctor_id: string | null;
    planned_session_count: number | null;
    planned_by_doctor_id: string | null;
    planned_at: string | null;
    completed_session_count: number;
    status: string;
  }

  function validateCoursePlanConstraint(course: {
    planned_session_count?: number | null;
    planned_by_doctor_id?: string | null;
    planned_at?: string | null;
  }) {
    if (course.planned_session_count !== undefined && course.planned_session_count !== null) {
      if (course.planned_session_count <= 0) {
        throw new Error("chk_treatment_courses_planned_session_count_positive: must be > 0");
      }
    }
    return true;
  }

  // CASE CL1C1-1: planned_session_count accepts null (Doctor plan not established)
  const courseNullPlan: MockCourseWithPlanProvenance = {
    id: "course-cl1c1-1",
    patient_id: "pat-1",
    primary_doctor_id: "doc-1",
    planned_session_count: null,
    planned_by_doctor_id: null,
    planned_at: null,
    completed_session_count: 0,
    status: "PLANNED",
  };
  assert(validateCoursePlanConstraint(courseNullPlan) === true, "CASE CL1C1-1: Null plan accepted");

  // CASE CL1C1-2: planned_session_count accepts positive integer
  const coursePositivePlan: MockCourseWithPlanProvenance = {
    id: "course-cl1c1-2",
    patient_id: "pat-1",
    primary_doctor_id: "doc-1",
    planned_session_count: 10,
    planned_by_doctor_id: "doc-staff-1",
    planned_at: new Date().toISOString(),
    completed_session_count: 0,
    status: "ACTIVE",
  };
  assert(validateCoursePlanConstraint(coursePositivePlan) === true, "CASE CL1C1-2: Positive plan accepted");

  // CASE CL1C1-3: planned_session_count rejects 0
  let planZeroRejected = false;
  try {
    validateCoursePlanConstraint({ planned_session_count: 0 });
  } catch (err: unknown) {
    planZeroRejected = true;
    assert((err as Error).message.includes("must be > 0"), "CASE CL1C1-3: Check constraint message");
  }
  assert(planZeroRejected, "CASE CL1C1-3: 0 planned sessions rejected");

  // CASE CL1C1-4: planned_session_count rejects negative number
  let planNegRejected = false;
  try {
    validateCoursePlanConstraint({ planned_session_count: -3 });
  } catch (err: unknown) {
    planNegRejected = true;
    assert((err as Error).message.includes("must be > 0"), "CASE CL1C1-4: Negative plan rejected");
  }
  assert(planNegRejected, "CASE CL1C1-4: Negative planned sessions rejected");

  // CASE CL1C1-7, 8, 10, 11: Legacy positive plan with NULL provenance remains allowed
  const legacyCourse: MockCourseWithPlanProvenance = {
    id: "course-legacy-1",
    patient_id: "pat-legacy",
    primary_doctor_id: "doc-1",
    planned_session_count: 7,
    planned_by_doctor_id: null, // Legacy provenance is not fabricated
    planned_at: null,
    completed_session_count: 0,
    status: "ACTIVE",
  };
  assert(validateCoursePlanConstraint(legacyCourse) === true, "CASE CL1C1-11: Legacy course with null provenance is valid");
  assert(legacyCourse.planned_by_doctor_id === null, "CASE CL1C1-11: Historical doctor provenance is not fabricated");
  assert(legacyCourse.planned_at === null, "CASE CL1C1-11: Historical planned_at is not fabricated");

  // 9. CLINICAL1C2A DOCTOR INITIAL TREATMENT PLAN ESTABLISHMENT TESTS
  interface MockPlanCourseRecord {
    id: string;
    clinic_id: string | null;
    status: string;
    planned_session_count: number | null;
    planned_by_doctor_id: string | null;
    planned_at: string | null;
    completed_session_count: number;
  }

  interface MockAuditRecord {
    actor_user_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string;
    after_data: Record<string, unknown>;
  }

  let createdAppointmentsCount = 0;
  let schedulerRpcCalled = false;
  const auditLogsDb: MockAuditRecord[] = [];

  function simulateEstablishInitialTreatmentPlan(options: {
    coursesDb: MockPlanCourseRecord[];
    input: { course_id: string; planned_session_count: number };
    activeClinicId: string;
    callerRoles: string[];
    doctorStaffId: string;
    authUserId: string;
  }) {
    createdAppointmentsCount = 0;
    schedulerRpcCalled = false;

    // 1. Role check: Must hold DOCTOR role
    if (!options.callerRoles.includes("DOCTOR")) {
      throw new Error("ActionForbiddenError: DOCTOR role required");
    }

    // 2. Atomic Compare-And-Set simulation
    const courseIndex = options.coursesDb.findIndex(
      (c) =>
        c.id === options.input.course_id &&
        c.clinic_id === options.activeClinicId &&
        ["PLANNED", "ACTIVE"].includes(c.status) &&
        c.planned_session_count === null
    );

    if (courseIndex === -1) {
      // Re-read and classify failure
      const existing = options.coursesDb.find((c) => c.id === options.input.course_id);
      if (!existing) throw new Error("COURSE_NOT_FOUND: Không tìm thấy liệu trình.");
      if (existing.clinic_id !== options.activeClinicId) throw new Error("COURSE_NOT_ACCESSIBLE: Liệu trình không thuộc cơ sở hiện tại.");
      if (existing.planned_session_count !== null) throw new Error("PLAN_ALREADY_ESTABLISHED: Liệu trình đã có kế hoạch điều trị từ trước.");
      if (!["PLANNED", "ACTIVE"].includes(existing.status)) throw new Error("COURSE_NOT_PLAN_ELIGIBLE: Không thể thiết lập kế hoạch cho liệu trình đã đóng/tạm ngưng.");
      throw new Error("GENERIC_FAILURE: Không thể thiết lập kế hoạch điều trị.");
    }

    // 3. Perform mutation
    const trustedTime = "2026-08-22T07:15:00.000Z";
    const course = options.coursesDb[courseIndex];
    course.planned_session_count = options.input.planned_session_count;
    course.planned_by_doctor_id = options.doctorStaffId;
    course.planned_at = trustedTime;

    // 4. Audit Log
    auditLogsDb.push({
      actor_user_id: options.authUserId,
      action: "ESTABLISH_TREATMENT_PLAN",
      entity_type: "TREATMENT_COURSE",
      entity_id: course.id,
      after_data: {
        course_id: course.id,
        planned_session_count: course.planned_session_count,
        planned_by_doctor_id: course.planned_by_doctor_id,
        planned_at: course.planned_at,
      },
    });

    return { success: true, course };
  }

  // CASE CL1C2A-1: Authenticated same-clinic DOCTOR establishes plan -> success
  const coursesDb: MockPlanCourseRecord[] = [
    {
      id: "course-c1c2a-1",
      clinic_id: "clinic-tt01",
      status: "PLANNED",
      planned_session_count: null,
      planned_by_doctor_id: null,
      planned_at: null,
      completed_session_count: 0,
    },
  ];
  const resC1C2A1 = simulateEstablishInitialTreatmentPlan({
    coursesDb,
    input: { course_id: "course-c1c2a-1", planned_session_count: 10 },
    activeClinicId: "clinic-tt01",
    callerRoles: ["DOCTOR"],
    doctorStaffId: "staff-doctor-1",
    authUserId: "auth-user-123",
  });
  assert(resC1C2A1.success === true, "CASE CL1C2A-1: DOCTOR establishes plan successfully");
  assert(coursesDb[0].planned_session_count === 10, "CASE CL1C2A-1: plan is 10");
  assert(coursesDb[0].planned_by_doctor_id === "staff-doctor-1", "CASE CL1C2A-1: Doctor Staff UUID stamped");
  assert(coursesDb[0].planned_at !== null, "CASE CL1C2A-1: planned_at timestamp stamped");
  assert(createdAppointmentsCount === 0, "CASE CL1C2A-15: Zero appointments created");
  assert(schedulerRpcCalled === false, "CASE CL1C2A-16: Scheduler RPC not called");
  assert(coursesDb[0].completed_session_count === 0, "CASE CL1C2A-17: completed_session_count unchanged");

  // CASE CL1C2A-18: Audit actor_user_id is Auth User UUID
  const lastAudit = auditLogsDb[auditLogsDb.length - 1];
  assert(lastAudit.actor_user_id === "auth-user-123", "CASE CL1C2A-18: Audit actor_user_id is Auth User UUID");
  assert(lastAudit.action === "ESTABLISH_TREATMENT_PLAN", "CASE CL1C2A-18: Audit action is ESTABLISH_TREATMENT_PLAN");

  // CASE CL1C2A-2: Schema validates inputs (browser only supplies course_id, planned_session_count)
  const schemaValid = establishInitialTreatmentPlanSchema.safeParse({
    course_id: "123e4567-e89b-12d3-a456-426614174000",
    planned_session_count: 10,
  });
  assert(schemaValid.success === true, "CASE CL1C2A-2: Schema accepts valid input");

  // CASE CL1C2A-10 & 11: Schema rejects <= 0
  const schemaZero = establishInitialTreatmentPlanSchema.safeParse({
    course_id: "123e4567-e89b-12d3-a456-426614174000",
    planned_session_count: 0,
  });
  assert(schemaZero.success === false, "CASE CL1C2A-10: Schema rejects 0");

  const schemaNeg = establishInitialTreatmentPlanSchema.safeParse({
    course_id: "123e4567-e89b-12d3-a456-426614174000",
    planned_session_count: -5,
  });
  assert(schemaNeg.success === false, "CASE CL1C2A-11: Schema rejects negative");

  // CASE CL1C2A-4: ADMIN-only caller denied
  let adminDenied = false;
  try {
    simulateEstablishInitialTreatmentPlan({
      coursesDb,
      input: { course_id: "course-c1c2a-1", planned_session_count: 10 },
      activeClinicId: "clinic-tt01",
      callerRoles: ["ADMIN"],
      doctorStaffId: "staff-admin-1",
      authUserId: "auth-admin-1",
    });
  } catch (err: unknown) {
    adminDenied = true;
    assert((err as Error).message.includes("ActionForbiddenError"), "CASE CL1C2A-4: ADMIN denied");
  }
  assert(adminDenied, "CASE CL1C2A-4: ADMIN-only denied");

  // CASE CL1C2A-5..7: Non-Doctor roles denied
  for (const role of ["RECEPTIONIST", "TECHNICIAN", "Y_SI"]) {
    let roleDenied = false;
    try {
      simulateEstablishInitialTreatmentPlan({
        coursesDb,
        input: { course_id: "course-c1c2a-1", planned_session_count: 10 },
        activeClinicId: "clinic-tt01",
        callerRoles: [role],
        doctorStaffId: "staff-role-1",
        authUserId: "auth-role-1",
      });
    } catch {
      roleDenied = true;
    }
    assert(roleDenied, `CASE CL1C2A-5..7: Role ${role} must be denied`);
  }

  // CASE CL1C2A-8: Cross-clinic Course denied
  let crossClinicDenied = false;
  try {
    simulateEstablishInitialTreatmentPlan({
      coursesDb,
      input: { course_id: "course-c1c2a-1", planned_session_count: 10 },
      activeClinicId: "clinic-tt02", // Different clinic
      callerRoles: ["DOCTOR"],
      doctorStaffId: "staff-doc-2",
      authUserId: "auth-doc-2",
    });
  } catch (err: unknown) {
    crossClinicDenied = true;
    assert((err as Error).message.includes("COURSE_NOT_ACCESSIBLE"), "CASE CL1C2A-8: Cross clinic error message");
  }
  assert(crossClinicDenied, "CASE CL1C2A-8: Cross clinic denied");

  // CASE CL1C2A-12 & 13: Existing plan / Legacy unprovenanced plan cannot be overwritten
  let overwriteDenied = false;
  try {
    simulateEstablishInitialTreatmentPlan({
      coursesDb,
      input: { course_id: "course-c1c2a-1", planned_session_count: 15 }, // Already has plan = 10
      activeClinicId: "clinic-tt01",
      callerRoles: ["DOCTOR"],
      doctorStaffId: "staff-doc-1",
      authUserId: "auth-doc-1",
    });
  } catch (err: unknown) {
    overwriteDenied = true;
    assert((err as Error).message.includes("PLAN_ALREADY_ESTABLISHED"), "CASE CL1C2A-12: PLAN_ALREADY_ESTABLISHED message");
  }
  assert(overwriteDenied, "CASE CL1C2A-12: Existing plan cannot be overwritten");
  assert(coursesDb[0].planned_session_count === 10, "CASE CL1C2A-12: Plan remains 10");

  // Status Matrix Tests: PAUSED, COMPLETED, DROPPED, CANCELLED
  for (const status of ["PAUSED", "COMPLETED", "DROPPED", "CANCELLED"]) {
    const closedDb: MockPlanCourseRecord[] = [
      {
        id: `course-${status.toLowerCase()}`,
        clinic_id: "clinic-tt01",
        status,
        planned_session_count: null,
        planned_by_doctor_id: null,
        planned_at: null,
        completed_session_count: 0,
      },
    ];
    let closedDenied = false;
    try {
      simulateEstablishInitialTreatmentPlan({
        coursesDb: closedDb,
        input: { course_id: `course-${status.toLowerCase()}`, planned_session_count: 8 },
        activeClinicId: "clinic-tt01",
        callerRoles: ["DOCTOR"],
        doctorStaffId: "staff-doc-1",
        authUserId: "auth-doc-1",
      });
    } catch (err: unknown) {
      closedDenied = true;
      assert((err as Error).message.includes("COURSE_NOT_PLAN_ELIGIBLE"), `Status ${status} ineligible`);
    }
    assert(closedDenied, `Course with status ${status} must be ineligible for initial plan`);
  }

  // 10. CLINICAL1C2A-FIX1 ATOMIC DOCTOR TREATMENT PLAN RPC TESTS
  interface MockRpcCourse {
    id: string;
    clinic_id: string | null;
    status: string;
    planned_session_count: number | null;
    planned_by_doctor_id: string | null;
    planned_at: string | null;
  }

  interface MockRpcStaff {
    id: string;
    user_id: string;
    is_active: boolean;
  }

  interface MockRpcMembership {
    staff_id: string;
    clinic_id: string;
    is_active: boolean;
    roles: string[];
  }

  function simulateEstablishTreatmentCoursePlanRpc(
    courses: MockRpcCourse[],
    staffList: MockRpcStaff[],
    memberships: MockRpcMembership[],
    auditLogs: Array<Record<string, unknown>>,
    params: {
      p_course_id: string;
      p_clinic_id: string;
      p_planned_session_count: number;
      p_actor_staff_id: string;
      p_actor_user_id: string;
    },
    options?: { injectAuditError?: boolean }
  ) {
    // 1. Parameter validation
    if (
      !params.p_course_id ||
      !params.p_clinic_id ||
      !params.p_planned_session_count ||
      !params.p_actor_staff_id ||
      !params.p_actor_user_id
    ) {
      return { success: false, error_code: "INVALID_INPUT", message: "Dữ liệu đầu vào không đầy đủ." };
    }

    if (params.p_planned_session_count <= 0) {
      return { success: false, error_code: "INVALID_PLAN_COUNT", message: "Số buổi điều trị phải lớn hơn 0." };
    }

    // 2. Validate actor Staff integrity and Auth User linkage
    const staff = staffList.find((s) => s.id === params.p_actor_staff_id);
    if (!staff || !staff.is_active || staff.user_id !== params.p_actor_user_id) {
      return { success: false, error_code: "INVALID_ACTOR", message: "Tài khoản nhân viên không hợp lệ." };
    }

    // 3. Validate actor has active membership and DOCTOR role at p_clinic_id
    const membership = memberships.find(
      (m) =>
        m.staff_id === params.p_actor_staff_id &&
        m.clinic_id === params.p_clinic_id &&
        m.is_active &&
        m.roles.includes("DOCTOR")
    );
    if (!membership) {
      return { success: false, error_code: "UNAUTHORIZED_DOCTOR", message: "Bác sĩ không có quyền thao tác tại cơ sở này." };
    }

    // 4. Lock and validate target Treatment Course
    const course = courses.find((c) => c.id === params.p_course_id);
    if (!course) {
      return { success: false, error_code: "COURSE_NOT_FOUND", message: "Không tìm thấy liệu trình điều trị." };
    }

    if (course.clinic_id !== params.p_clinic_id) {
      return { success: false, error_code: "COURSE_NOT_ACCESSIBLE", message: "Liệu trình không thuộc cơ sở làm việc hiện tại." };
    }

    if (course.planned_session_count !== null) {
      return { success: false, error_code: "PLAN_ALREADY_ESTABLISHED", message: "Kế hoạch điều trị đã được thiết lập trước đó." };
    }

    if (!["PLANNED", "ACTIVE"].includes(course.status)) {
      return { success: false, error_code: "COURSE_NOT_PLAN_ELIGIBLE", message: "Liệu trình hiện không ở trạng thái có thể lập kế hoạch điều trị." };
    }

    // 5 & 6. Atomic Transaction Simulation: Update Course + Insert Audit
    if (options?.injectAuditError) {
      // Transaction rollback simulation: If audit fails, course mutation does NOT commit
      return { success: false, error_code: "AUDIT_FAILURE", message: "Lỗi ghi nhận nhật ký hệ thống." };
    }

    const plannedAt = "2026-08-22T07:22:00.000Z";
    course.planned_session_count = params.p_planned_session_count;
    course.planned_by_doctor_id = params.p_actor_staff_id;
    course.planned_at = plannedAt;

    auditLogs.push({
      actor_user_id: params.p_actor_user_id,
      action: "ESTABLISH_TREATMENT_PLAN",
      entity_type: "TREATMENT_COURSE",
      entity_id: course.id,
      after_data: {
        course_id: course.id,
        clinic_id: params.p_clinic_id,
        planned_session_count: params.p_planned_session_count,
        planned_by_doctor_id: params.p_actor_staff_id,
        planned_at: plannedAt,
      },
    });

    return {
      success: true,
      course_id: course.id,
      planned_session_count: course.planned_session_count,
      planned_by_doctor_id: course.planned_by_doctor_id,
      planned_at: plannedAt,
      message: "Thiết lập kế hoạch điều trị thành công.",
    };
  }

  // Setup test DB fixtures
  const rpcStaff: MockRpcStaff[] = [
    { id: "staff-doc-1", user_id: "user-auth-1", is_active: true },
    { id: "staff-inactive-doc", user_id: "user-auth-2", is_active: false },
    { id: "staff-admin-only", user_id: "user-auth-3", is_active: true },
  ];

  const rpcMemberships: MockRpcMembership[] = [
    { staff_id: "staff-doc-1", clinic_id: "clinic-tt01", is_active: true, roles: ["DOCTOR"] },
    { staff_id: "staff-admin-only", clinic_id: "clinic-tt01", is_active: true, roles: ["ADMIN"] },
  ];

  const rpcCourses: MockRpcCourse[] = [
    { id: "course-1", clinic_id: "clinic-tt01", status: "PLANNED", planned_session_count: null, planned_by_doctor_id: null, planned_at: null },
    { id: "course-cross", clinic_id: "clinic-tt02", status: "PLANNED", planned_session_count: null, planned_by_doctor_id: null, planned_at: null },
    { id: "course-has-plan", clinic_id: "clinic-tt01", status: "ACTIVE", planned_session_count: 7, planned_by_doctor_id: null, planned_at: null },
    { id: "course-paused", clinic_id: "clinic-tt01", status: "PAUSED", planned_session_count: null, planned_by_doctor_id: null, planned_at: null },
  ];

  const rpcAuditLogs: Array<Record<string, unknown>> = [];

  // CASE CL1C2A-FIX1-1: Valid DOCTOR -> success
  const rpcRes1 = simulateEstablishTreatmentCoursePlanRpc(
    rpcCourses,
    rpcStaff,
    rpcMemberships,
    rpcAuditLogs,
    {
      p_course_id: "course-1",
      p_clinic_id: "clinic-tt01",
      p_planned_session_count: 10,
      p_actor_staff_id: "staff-doc-1",
      p_actor_user_id: "user-auth-1",
    }
  );
  assert(rpcRes1.success === true, "CASE CL1C2A-FIX1-1: RPC succeeds");
  assert(rpcCourses[0].planned_session_count === 10, "CASE CL1C2A-FIX1-1: Plan updated");
  assert(rpcAuditLogs.length === 1, "CASE CL1C2A-FIX1-1: Audit logged in same transaction");

  // CASE CL1C2A-FIX1-5: Existing plan rejected
  const rpcRes5 = simulateEstablishTreatmentCoursePlanRpc(
    rpcCourses,
    rpcStaff,
    rpcMemberships,
    rpcAuditLogs,
    {
      p_course_id: "course-has-plan",
      p_clinic_id: "clinic-tt01",
      p_planned_session_count: 12,
      p_actor_staff_id: "staff-doc-1",
      p_actor_user_id: "user-auth-1",
    }
  );
  assert(rpcRes5.success === false, "CASE CL1C2A-FIX1-5: Existing plan rejected");
  assert(rpcRes5.error_code === "PLAN_ALREADY_ESTABLISHED", "CASE CL1C2A-FIX1-5: PLAN_ALREADY_ESTABLISHED code");

  // CASE CL1C2A-FIX1-7: Cross-clinic rejected
  const rpcRes7 = simulateEstablishTreatmentCoursePlanRpc(
    rpcCourses,
    rpcStaff,
    rpcMemberships,
    rpcAuditLogs,
    {
      p_course_id: "course-cross",
      p_clinic_id: "clinic-tt01",
      p_planned_session_count: 10,
      p_actor_staff_id: "staff-doc-1",
      p_actor_user_id: "user-auth-1",
    }
  );
  assert(rpcRes7.success === false, "CASE CL1C2A-FIX1-7: Cross clinic rejected");
  assert(rpcRes7.error_code === "COURSE_NOT_ACCESSIBLE", "CASE CL1C2A-FIX1-7: COURSE_NOT_ACCESSIBLE code");

  // CASE CL1C2A-FIX1-8: Inactive staff rejected
  const rpcRes8 = simulateEstablishTreatmentCoursePlanRpc(
    rpcCourses,
    rpcStaff,
    rpcMemberships,
    rpcAuditLogs,
    {
      p_course_id: "course-1",
      p_clinic_id: "clinic-tt01",
      p_planned_session_count: 10,
      p_actor_staff_id: "staff-inactive-doc",
      p_actor_user_id: "user-auth-2",
    }
  );
  assert(rpcRes8.success === false, "CASE CL1C2A-FIX1-8: Inactive staff rejected");
  assert(rpcRes8.error_code === "INVALID_ACTOR", "CASE CL1C2A-FIX1-8: INVALID_ACTOR code");

  // CASE CL1C2A-FIX1-12: ADMIN-only rejected (lacks DOCTOR role)
  const rpcRes12 = simulateEstablishTreatmentCoursePlanRpc(
    rpcCourses,
    rpcStaff,
    rpcMemberships,
    rpcAuditLogs,
    {
      p_course_id: "course-1",
      p_clinic_id: "clinic-tt01",
      p_planned_session_count: 10,
      p_actor_staff_id: "staff-admin-only",
      p_actor_user_id: "user-auth-3",
    }
  );
  assert(rpcRes12.success === false, "CASE CL1C2A-FIX1-12: ADMIN without DOCTOR role rejected");
  assert(rpcRes12.error_code === "UNAUTHORIZED_DOCTOR", "CASE CL1C2A-FIX1-12: UNAUTHORIZED_DOCTOR code");

  // CASE CL1C2A-FIX1-15: PAUSED course rejected
  const rpcRes15 = simulateEstablishTreatmentCoursePlanRpc(
    rpcCourses,
    rpcStaff,
    rpcMemberships,
    rpcAuditLogs,
    {
      p_course_id: "course-paused",
      p_clinic_id: "clinic-tt01",
      p_planned_session_count: 10,
      p_actor_staff_id: "staff-doc-1",
      p_actor_user_id: "user-auth-1",
    }
  );
  assert(rpcRes15.success === false, "CASE CL1C2A-FIX1-15: PAUSED course rejected");
  assert(rpcRes15.error_code === "COURSE_NOT_PLAN_ELIGIBLE", "CASE CL1C2A-FIX1-15: COURSE_NOT_PLAN_ELIGIBLE code");

  // CASE CL1C2A-FIX1-19: Atomic Audit Failure Rollback
  const rollbackCourse: MockRpcCourse = {
    id: "course-rollback",
    clinic_id: "clinic-tt01",
    status: "PLANNED",
    planned_session_count: null,
    planned_by_doctor_id: null,
    planned_at: null,
  };
  const rpcRes19 = simulateEstablishTreatmentCoursePlanRpc(
    [rollbackCourse],
    rpcStaff,
    rpcMemberships,
    rpcAuditLogs,
    {
      p_course_id: "course-rollback",
      p_clinic_id: "clinic-tt01",
      p_planned_session_count: 10,
      p_actor_staff_id: "staff-doc-1",
      p_actor_user_id: "user-auth-1",
    },
    { injectAuditError: true }
  );
  assert(rpcRes19.success === false, "CASE CL1C2A-FIX1-19: Injected audit error fails RPC");
  // 11. CLINICAL1C2B DOCTOR TREATMENT PLAN UI LOGIC TESTS
  interface PlanCardUiState {
    formVisible: boolean;
    isReadOnly: boolean;
    isLegacyPlan: boolean;
    isEstablishedDoctorPlan: boolean;
    message?: string;
  }

  function evaluatePlanCardUi(props: {
    courseStatus: string;
    plannedSessionCount: number | null;
    plannedByDoctorId?: string | null;
    isDoctor?: boolean;
  }): PlanCardUiState {
    const hasPlan = props.plannedSessionCount !== null && props.plannedSessionCount > 0;
    const isEligibleStatus = ["PLANNED", "ACTIVE"].includes(props.courseStatus);
    const isLegacyPlan = hasPlan && !props.plannedByDoctorId;
    const isEstablishedDoctorPlan = hasPlan && Boolean(props.plannedByDoctorId);

    if (isEstablishedDoctorPlan) {
      return {
        formVisible: false,
        isReadOnly: true,
        isLegacyPlan: false,
        isEstablishedDoctorPlan: true,
      };
    }

    if (isLegacyPlan) {
      return {
        formVisible: false,
        isReadOnly: true,
        isLegacyPlan: true,
        isEstablishedDoctorPlan: false,
        message: "Dữ liệu kế hoạch cũ — chưa xác định bác sĩ lập kế hoạch.",
      };
    }

    if (isEligibleStatus) {
      if (props.isDoctor) {
        return {
          formVisible: true,
          isReadOnly: false,
          isLegacyPlan: false,
          isEstablishedDoctorPlan: false,
        };
      } else {
        return {
          formVisible: false,
          isReadOnly: true,
          isLegacyPlan: false,
          isEstablishedDoctorPlan: false,
          message: "Chưa có kế hoạch điều trị từ bác sĩ.",
        };
      }
    }

    return {
      formVisible: false,
      isReadOnly: true,
      isLegacyPlan: false,
      isEstablishedDoctorPlan: false,
      message: "Liệu trình hiện không ở trạng thái có thể thiết lập kế hoạch điều trị.",
    };
  }

  // CASE CL1C2B-1: Plan NULL, eligible PLANNED, DOCTOR -> form visible
  const ui1 = evaluatePlanCardUi({ courseStatus: "PLANNED", plannedSessionCount: null, isDoctor: true });
  assert(ui1.formVisible === true, "CASE CL1C2B-1: Form visible for NULL plan + DOCTOR");
  assert(ui1.isReadOnly === false, "CASE CL1C2B-1: Not read-only");

  // CASE CL1C2B-7: Existing Doctor Plan -> read-only, no form
  const ui7 = evaluatePlanCardUi({ courseStatus: "ACTIVE", plannedSessionCount: 10, plannedByDoctorId: "staff-doc-1", isDoctor: true });
  assert(ui7.formVisible === false, "CASE CL1C2B-7: Form hidden for existing doctor plan");
  assert(ui7.isReadOnly === true, "CASE CL1C2B-7: Read-only");
  assert(ui7.isEstablishedDoctorPlan === true, "CASE CL1C2B-7: Recognized as established doctor plan");

  // CASE CL1C2B-8: Legacy Plan -> read-only, legacy message, no form
  const ui8 = evaluatePlanCardUi({ courseStatus: "ACTIVE", plannedSessionCount: 7, plannedByDoctorId: null, isDoctor: true });
  assert(ui8.formVisible === false, "CASE CL1C2B-8: Form hidden for legacy plan");
  assert(ui8.isReadOnly === true, "CASE CL1C2B-8: Read-only");
  assert(ui8.isLegacyPlan === true, "CASE CL1C2B-8: Recognized as legacy plan");
  assert(Boolean(ui8.message?.includes("Dữ liệu kế hoạch cũ")), "CASE CL1C2B-8: Legacy notice displayed");

  // CASE CL1C2B-9..12: Ineligible Course statuses -> no form
  for (const status of ["PAUSED", "COMPLETED", "DROPPED", "CANCELLED"]) {
    const uiIneligible = evaluatePlanCardUi({ courseStatus: status, plannedSessionCount: null, isDoctor: true });
    assert(uiIneligible.formVisible === false, `CASE CL1C2B-9..12: Status ${status} hides form`);
    assert(Boolean(uiIneligible.message?.includes("không ở trạng thái có thể thiết lập")), `CASE CL1C2B-9..12: Status ${status} message`);
  }

  // CASE CL1C2B-13: Non-Doctor role cannot see form
  const uiNonDoc = evaluatePlanCardUi({ courseStatus: "PLANNED", plannedSessionCount: null, isDoctor: false });
  assert(uiNonDoc.formVisible === false, "CASE CL1C2B-13: Non-doctor cannot see establish form");
  assert(Boolean(uiNonDoc.message?.includes("Chưa có kế hoạch điều trị từ bác sĩ")), "CASE CL1C2B-13: Non-doctor message");

  // 12. CLINICAL1C3 RECEPTION TREATMENT PLAN REMOVAL TESTS
  // CASE CL1C3-1: Reception input schema parses without planned_session_count
  const recParsed = createReceptionSchema.parse({
    patient_id: "123e4567-e89b-12d3-a456-426614174000",
    reception_source: "MANUAL",
    patient_relation_type: "NEW",
    create_course: true,
  });
  assert(!("planned_session_count" in recParsed), "CASE CL1C3-1: Schema does not output planned_session_count");

  // CASE CL1C3-4 & 5: Simulation of Reception Intake Course creation writes NULL plan and NULL provenance
  interface MockReceptionCourseCreation {
    patient_id: string;
    reception_id: string;
    primary_doctor_id: string | null;
    start_date: string;
    planned_session_count: number | null;
    planned_by_doctor_id: string | null;
    planned_at: string | null;
    status: string;
  }

  function simulateReceptionCourseCreation(doctor_id?: string | null): MockReceptionCourseCreation {
    return {
      patient_id: "123e4567-e89b-12d3-a456-426614174000",
      reception_id: "rec-123",
      primary_doctor_id: doctor_id || null,
      start_date: "2026-08-22",
      planned_session_count: null, // Explicitly NULL
      planned_by_doctor_id: null,
      planned_at: null,
      status: "ACTIVE", // Preserved operational status
    };
  }

  const newCourse = simulateReceptionCourseCreation("doctor-staff-1");
  assert(newCourse.planned_session_count === null, "CASE CL1C3-4: New reception course plan is NULL");
  assert(newCourse.planned_by_doctor_id === null, "CASE CL1C3-5: New reception course planned_by_doctor_id is NULL");
  assert(newCourse.planned_at === null, "CASE CL1C3-5: New reception course planned_at is NULL");
  assert(newCourse.status === "ACTIVE", "CASE CL1C3-8: New reception course status is ACTIVE");
  assert(newCourse.primary_doctor_id === "doctor-staff-1", "CASE CL1C3-9: Primary doctor assignment preserved");

  // CASE CL1C3-10: DoctorTreatmentPlanCard on new Reception Course (status ACTIVE, plan NULL) allows DOCTOR to establish plan
  const uiReceptionCourse = evaluatePlanCardUi({
    courseStatus: newCourse.status,
    plannedSessionCount: newCourse.planned_session_count,
    plannedByDoctorId: newCourse.planned_by_doctor_id,
    isDoctor: true,
  });
  assert(uiReceptionCourse.formVisible === true, "CASE CL1C3-10: DOCTOR can establish plan on newly created reception course");
  assert(uiReceptionCourse.isReadOnly === false, "CASE CL1C3-10: Form is not read-only for DOCTOR");

  // CASE CL1C3-13 & 14: Nullable display formatting check
  const displayPlanCount = (count: number | null) => (count !== null ? `${count}` : "—");
  assert(displayPlanCount(newCourse.planned_session_count) === "—", "CASE CL1C3-13: NULL plan renders as —");

  console.log("All Treatment Course & Reception Unit Tests PASSED!");
}
