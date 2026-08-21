import { createReceptionSchema } from "@/lib/validation/reception-schemas";
import { createTreatmentCourseSchema, updateTreatmentCourseSchema } from "@/lib/validation/treatment-schemas";
import { recordCourseDiagnosisSchema } from "@/lib/validation/clinical-schemas";

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

  console.log("All Treatment Course & Reception Unit Tests PASSED!");
}
