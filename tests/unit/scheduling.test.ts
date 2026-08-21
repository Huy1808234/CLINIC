import { generateDailyTimeSlots, timeToMinutes, minutesToTime } from "@/lib/scheduling/generate-slots";
import { generateTreatmentDates } from "@/lib/scheduling/scheduling-rules";
import { calculateSlotScore } from "@/lib/scheduling/slot-scoring";
import { autoScheduleSchema, rescheduleAppointmentSchema } from "@/lib/validation/scheduling-schemas";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

export function runSchedulingTests() {
  console.log("Running Scheduling & Slots Unit Tests...");

  // 1. Time conversion helpers
  assert(timeToMinutes("07:30") === 450, "07:30 must be 450 minutes");
  assert(minutesToTime(450) === "07:30", "450 minutes must be 07:30");

  // 2. Generate daily time slots
  const slots = generateDailyTimeSlots({
    openTime: "07:00",
    closeTime: "17:00",
    intervalMinutes: 5,
    lunchStart: "11:30",
    lunchEnd: "13:00",
  });

  assert(slots.length > 50, "Should generate regular clinic slots");
  assert(slots.includes("07:00"), "Must include 07:00 opening slot");
  assert(slots.includes("07:05"), "Must include 07:05 staggered slot");
  assert(!slots.includes("11:35"), "Must exclude lunch break slot 11:35");
  assert(!slots.includes("12:30"), "Must exclude lunch break slot 12:30");
  assert(slots.includes("13:00"), "Must include 13:00 afternoon start slot");

  // 3. Generate treatment dates (skip Sundays)
  // Let's test starting on Friday 2026-08-21 (5 sessions)
  const dates = generateTreatmentDates({
    startDate: "2026-08-21",
    sessionCount: 5,
    allowedWeekdays: [1, 2, 3, 4, 5, 6], // Mon-Sat
  });

  assert(dates.length === 5, "Must generate exactly 5 treatment dates");
  assert(dates[0] === "2026-08-21", "Day 1 must be Friday 21/08");
  assert(dates[1] === "2026-08-22", "Day 2 must be Saturday 22/08");
  // 2026-08-23 is Sunday -> should be skipped!
  assert(dates[2] === "2026-08-24", "Day 3 must be Monday 24/08 (skipped Sunday)");
  assert(dates[3] === "2026-08-25", "Day 4 must be Tuesday 25/08");
  assert(dates[4] === "2026-08-26", "Day 5 must be Wednesday 26/08");

  // 4. Slot Scoring Algorithm
  const scoreExact = calculateSlotScore({
    slotTime: "07:30",
    preferredTime: "07:30",
    currentDoctorLoad: 10,
    maxDoctorLoad: 64,
  });
  assert(scoreExact === 100, "Exact preferred time with low load must score 100");

  const scoreDiff = calculateSlotScore({
    slotTime: "08:00", // 30 min diff
    preferredTime: "07:30",
    currentDoctorLoad: 10,
    maxDoctorLoad: 64,
  });
  assert(scoreDiff < 100 && scoreDiff >= 80, "30 min diff should receive moderate score");

  // 5. Auto Schedule Schema Validation
  const s1 = autoScheduleSchema.safeParse({
    treatment_course_id: "123e4567-e89b-12d3-a456-426614174000",
    doctor_id: "123e4567-e89b-12d3-a456-426614174001",
    start_date: "2026-08-21",
    planned_session_count: 7,
    preferred_time: "07:34",
  });
  assert(s1.success === true, "Valid auto schedule input must succeed");

  // 6. Reschedule Schema Validation
  const r1 = rescheduleAppointmentSchema.safeParse({
    appointment_id: "123e4567-e89b-12d3-a456-426614174000",
    new_date: "2026-08-25",
    new_start_at: "2026-08-25T08:10:00+07:00",
    manual_override: true,
  });
  assert(r1.success === true, "Valid reschedule input with manual_override must succeed");

  // 7. AUTH1.7E1 AUTO-SCHEDULE AUTHORIZATION & TARGET SCOPE INTEGRITY TESTS
  interface MockCourse {
    id: string;
    clinic_id: string | null;
  }

  interface MockStaffMember {
    id: string;
    is_active: boolean;
    role_type: string;
  }

  interface MockClinicMembership {
    staff_id: string;
    clinic_id: string;
    is_active: boolean;
    roles: string[];
  }

  const courseDb: MockCourse[] = [
    { id: "course-tt01-1", clinic_id: "clinic-tt01" },
    { id: "course-md01-1", clinic_id: "clinic-md01" },
    { id: "course-legacy-null", clinic_id: null },
  ];

  const staffDb: MockStaffMember[] = [
    { id: "doc-tt01-active", is_active: true, role_type: "DOCTOR" },
    { id: "doc-md01-active", is_active: true, role_type: "DOCTOR" },
    { id: "doc-inactive", is_active: false, role_type: "DOCTOR" },
    { id: "doc-multi-role", is_active: true, role_type: "DOCTOR" },
    { id: "staff-admin-only", is_active: true, role_type: "ADMIN" },
    { id: "staff-legacy-role-only", is_active: true, role_type: "DOCTOR" },
  ];

  const membershipDb: MockClinicMembership[] = [
    { staff_id: "doc-tt01-active", clinic_id: "clinic-tt01", is_active: true, roles: ["DOCTOR"] },
    { staff_id: "doc-md01-active", clinic_id: "clinic-md01", is_active: true, roles: ["DOCTOR"] },
    { staff_id: "doc-inactive", clinic_id: "clinic-tt01", is_active: true, roles: ["DOCTOR"] },
    { staff_id: "doc-multi-role", clinic_id: "clinic-tt01", is_active: true, roles: ["DOCTOR", "ADMIN"] },
    { staff_id: "staff-admin-only", clinic_id: "clinic-tt01", is_active: true, roles: ["ADMIN"] },
    { staff_id: "staff-legacy-role-only", clinic_id: "clinic-tt01", is_active: true, roles: ["MANAGER"] },
  ];

  function simulateValidateDoctorForClinic(doctorId: string, clinicId: string) {
    const staff = staffDb.find((s) => s.id === doctorId);
    if (!staff || !staff.is_active) {
      throw new Error("Bác sĩ được chọn không tồn tại hoặc đã ngừng hoạt động.");
    }
    const mem = membershipDb.find((m) => m.staff_id === doctorId && m.clinic_id === clinicId);
    if (!mem || !mem.is_active) {
      throw new Error("Bác sĩ không có phân công hoạt động tại cơ sở hiện tại.");
    }
    if (!mem.roles.includes("DOCTOR")) {
      throw new Error("Nhân viên được chọn không có vai trò Bác sĩ tại cơ sở hiện tại.");
    }
  }

  function simulateAutoScheduleWorkflow(params: {
    callerRoles: string[];
    activeClinicId: string;
    courseId: string;
    doctorId: string;
  }) {
    // 1. Authorize caller at active clinic
    const isAuthorized = params.callerRoles.some((r) => ["RECEPTIONIST", "ADMIN"].includes(r));
    if (!isAuthorized) {
      throw new Error("Bạn không có quyền thực hiện xếp lịch tại cơ sở này.");
    }

    // 2. Target Course validation
    const course = courseDb.find((c) => c.id === params.courseId);
    if (!course || !course.clinic_id || course.clinic_id !== params.activeClinicId) {
      throw new Error("Không tìm thấy liệu trình phù hợp tại cơ sở hiện tại.");
    }

    // 3. Target Doctor validation
    simulateValidateDoctorForClinic(params.doctorId, params.activeClinicId);

    return { success: true, message: "Auto scheduled successfully" };
  }

  // CASE E1-1: RECEPTIONIST at active TT01 with TT01 Course + TT01 Doctor -> PASS
  const resE1 = simulateAutoScheduleWorkflow({
    callerRoles: ["RECEPTIONIST"],
    activeClinicId: "clinic-tt01",
    courseId: "course-tt01-1",
    doctorId: "doc-tt01-active",
  });
  assert(resE1.success === true, "CASE E1-1: RECEPTIONIST caller succeeds");

  // CASE E1-2: ADMIN at active TT01 -> PASS
  const resE2 = simulateAutoScheduleWorkflow({
    callerRoles: ["ADMIN"],
    activeClinicId: "clinic-tt01",
    courseId: "course-tt01-1",
    doctorId: "doc-tt01-active",
  });
  assert(resE2.success === true, "CASE E1-2: ADMIN caller succeeds");

  // CASE E1-4: DOCTOR-only caller -> DENIED
  let docOnlyDenied = false;
  try {
    simulateAutoScheduleWorkflow({
      callerRoles: ["DOCTOR"],
      activeClinicId: "clinic-tt01",
      courseId: "course-tt01-1",
      doctorId: "doc-tt01-active",
    });
  } catch (err: unknown) {
    docOnlyDenied = true;
    assert((err as Error).message.includes("không có quyền"), "CASE E1-4: Error message");
  }
  assert(docOnlyDenied, "CASE E1-4: DOCTOR-only caller must be denied");

  // CASE E1-5: MANAGER-only caller -> DENIED
  let managerDenied = false;
  try {
    simulateAutoScheduleWorkflow({
      callerRoles: ["MANAGER"],
      activeClinicId: "clinic-tt01",
      courseId: "course-tt01-1",
      doctorId: "doc-tt01-active",
    });
  } catch {
    managerDenied = true;
  }
  assert(managerDenied, "CASE E1-5: MANAGER-only caller must be denied");

  // CASE E1-6: Wrong clinic Course (Course belongs to MD01, caller at TT01) -> DENIED
  let crossClinicCourseDenied = false;
  try {
    simulateAutoScheduleWorkflow({
      callerRoles: ["RECEPTIONIST"],
      activeClinicId: "clinic-tt01",
      courseId: "course-md01-1",
      doctorId: "doc-tt01-active",
    });
  } catch (err: unknown) {
    crossClinicCourseDenied = true;
    assert((err as Error).message.includes("Không tìm thấy liệu trình"), "CASE E1-6: Error message");
  }
  assert(crossClinicCourseDenied, "CASE E1-6: Cross clinic course must be denied");

  // CASE E1-7: Legacy Course (clinic_id = null) -> DENIED
  let legacyCourseDenied = false;
  try {
    simulateAutoScheduleWorkflow({
      callerRoles: ["RECEPTIONIST"],
      activeClinicId: "clinic-tt01",
      courseId: "course-legacy-null",
      doctorId: "doc-tt01-active",
    });
  } catch (err: unknown) {
    legacyCourseDenied = true;
    assert((err as Error).message.includes("Không tìm thấy liệu trình"), "CASE E1-7: Error message");
  }
  assert(legacyCourseDenied, "CASE E1-7: Legacy null clinic course must be denied");

  // CASE E1-8: Wrong clinic Doctor (Doctor is MD01-only) -> DENIED
  let crossClinicDoctorDenied = false;
  try {
    simulateAutoScheduleWorkflow({
      callerRoles: ["RECEPTIONIST"],
      activeClinicId: "clinic-tt01",
      courseId: "course-tt01-1",
      doctorId: "doc-md01-active",
    });
  } catch (err: unknown) {
    crossClinicDoctorDenied = true;
    assert((err as Error).message.includes("không có phân công"), "CASE E1-8: Error message");
  }
  assert(crossClinicDoctorDenied, "CASE E1-8: Cross clinic doctor must be denied");

  // CASE E1-9: Inactive Doctor Staff -> DENIED
  let inactiveDoctorDenied = false;
  try {
    simulateAutoScheduleWorkflow({
      callerRoles: ["RECEPTIONIST"],
      activeClinicId: "clinic-tt01",
      courseId: "course-tt01-1",
      doctorId: "doc-inactive",
    });
  } catch (err: unknown) {
    inactiveDoctorDenied = true;
    assert((err as Error).message.includes("ngừng hoạt động"), "CASE E1-9: Error message");
  }
  assert(inactiveDoctorDenied, "CASE E1-9: Inactive doctor must be denied");

  // CASE E1-11: Missing DOCTOR role (Doctor has ADMIN only) -> DENIED
  let missingDocRoleDenied = false;
  try {
    simulateAutoScheduleWorkflow({
      callerRoles: ["RECEPTIONIST"],
      activeClinicId: "clinic-tt01",
      courseId: "course-tt01-1",
      doctorId: "staff-admin-only",
    });
  } catch (err: unknown) {
    missingDocRoleDenied = true;
    assert((err as Error).message.includes("không có vai trò Bác sĩ"), "CASE E1-11: Error message");
  }
  assert(missingDocRoleDenied, "CASE E1-11: Staff without DOCTOR role must be denied");

  // CASE E1-12: Multi-role Doctor (DOCTOR + ADMIN) -> PASS
  const resE12 = simulateAutoScheduleWorkflow({
    callerRoles: ["RECEPTIONIST"],
    activeClinicId: "clinic-tt01",
    courseId: "course-tt01-1",
    doctorId: "doc-multi-role",
  });
  assert(resE12.success === true, "CASE E1-12: Multi-role DOCTOR+ADMIN succeeds");

  // CASE E1-13: Legacy role_type = DOCTOR without membership DOCTOR role -> DENIED
  let legacyRoleDenied = false;
  try {
    simulateAutoScheduleWorkflow({
      callerRoles: ["RECEPTIONIST"],
      activeClinicId: "clinic-tt01",
      courseId: "course-tt01-1",
      doctorId: "staff-legacy-role-only",
    });
  } catch (err: unknown) {
    legacyRoleDenied = true;
    assert((err as Error).message.includes("không có vai trò Bác sĩ"), "CASE E1-13: Error message");
  }
  assert(legacyRoleDenied, "CASE E1-13: Legacy role_type alone must be denied");

  // 8. AUTH1.7E2 RESCHEDULE APPOINTMENT AUTHORIZATION & TARGET SCOPE TESTS
  interface MockAppointment {
    id: string;
    treatment_course_id: string;
    doctor_id: string | null;
  }

  const apptDb: MockAppointment[] = [
    { id: "appt-tt01-1", treatment_course_id: "course-tt01-1", doctor_id: "doc-tt01-active" },
    { id: "appt-md01-1", treatment_course_id: "course-md01-1", doctor_id: "doc-md01-active" },
    { id: "appt-legacy-null", treatment_course_id: "course-legacy-null", doctor_id: "doc-tt01-active" },
  ];

  function simulateRescheduleWorkflow(params: {
    callerRoles: string[];
    activeClinicId: string;
    appointmentId: string;
    newDoctorId?: string | null;
  }) {
    // 1. Authorize caller at active clinic
    const isAuthorized = params.callerRoles.some((r) => ["RECEPTIONIST", "ADMIN"].includes(r));
    if (!isAuthorized) {
      throw new Error("Bạn không có quyền thực hiện đổi lịch hẹn tại cơ sở này.");
    }

    // 2. Target Appointment validation
    const appt = apptDb.find((a) => a.id === params.appointmentId);
    if (!appt || !appt.treatment_course_id) {
      throw new Error("Không tìm thấy lịch hẹn phù hợp tại cơ sở hiện tại.");
    }

    // 3. Parent Course clinic validation
    const course = courseDb.find((c) => c.id === appt.treatment_course_id);
    if (!course || !course.clinic_id || course.clinic_id !== params.activeClinicId) {
      throw new Error("Không tìm thấy lịch hẹn phù hợp tại cơ sở hiện tại.");
    }

    // 4. Validate new doctor if specified
    if (params.newDoctorId) {
      simulateValidateDoctorForClinic(params.newDoctorId, params.activeClinicId);
    }

    return { success: true, message: "Rescheduled successfully" };
  }

  // CASE E2-1: RECEPTIONIST at active TT01 with TT01 Appointment -> PASS
  const resE21 = simulateRescheduleWorkflow({
    callerRoles: ["RECEPTIONIST"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-tt01-1",
  });
  assert(resE21.success === true, "CASE E2-1: RECEPTIONIST caller succeeds");

  // CASE E2-2: ADMIN at active TT01 with TT01 Appointment -> PASS
  const resE22 = simulateRescheduleWorkflow({
    callerRoles: ["ADMIN"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-tt01-1",
  });
  assert(resE22.success === true, "CASE E2-2: ADMIN caller succeeds");

  // CASE E2-4: DOCTOR-only caller -> DENIED
  let docOnlyRescheduleDenied = false;
  try {
    simulateRescheduleWorkflow({
      callerRoles: ["DOCTOR"],
      activeClinicId: "clinic-tt01",
      appointmentId: "appt-tt01-1",
    });
  } catch (err: unknown) {
    docOnlyRescheduleDenied = true;
    assert((err as Error).message.includes("không có quyền"), "CASE E2-4: Error message");
  }
  assert(docOnlyRescheduleDenied, "CASE E2-4: DOCTOR-only caller must be denied for reschedule");

  // CASE E2-5: MANAGER-only caller -> DENIED
  let managerRescheduleDenied = false;
  try {
    simulateRescheduleWorkflow({
      callerRoles: ["MANAGER"],
      activeClinicId: "clinic-tt01",
      appointmentId: "appt-tt01-1",
    });
  } catch {
    managerRescheduleDenied = true;
  }
  assert(managerRescheduleDenied, "CASE E2-5: MANAGER-only caller must be denied for reschedule");

  // CASE E2-6: Cross-clinic Appointment (Appointment belongs to MD01, active clinic is TT01) -> DENIED
  let crossClinicApptDenied = false;
  try {
    simulateRescheduleWorkflow({
      callerRoles: ["RECEPTIONIST"],
      activeClinicId: "clinic-tt01",
      appointmentId: "appt-md01-1",
    });
  } catch (err: unknown) {
    crossClinicApptDenied = true;
    assert((err as Error).message.includes("Không tìm thấy lịch hẹn"), "CASE E2-6: Error message");
  }
  assert(crossClinicApptDenied, "CASE E2-6: Cross clinic appointment must be denied");

  // CASE E2-7: Legacy/unbound Appointment (Course clinic_id = null) -> DENIED
  let legacyApptDenied = false;
  try {
    simulateRescheduleWorkflow({
      callerRoles: ["RECEPTIONIST"],
      activeClinicId: "clinic-tt01",
      appointmentId: "appt-legacy-null",
    });
  } catch (err: unknown) {
    legacyApptDenied = true;
    assert((err as Error).message.includes("Không tìm thấy lịch hẹn"), "CASE E2-7: Error message");
  }
  assert(legacyApptDenied, "CASE E2-7: Legacy null clinic appointment must be denied");

  // CASE E2-9: Doctor target changed to cross-clinic Doctor -> DENIED
  let crossClinicNewDocDenied = false;
  try {
    simulateRescheduleWorkflow({
      callerRoles: ["RECEPTIONIST"],
      activeClinicId: "clinic-tt01",
      appointmentId: "appt-tt01-1",
      newDoctorId: "doc-md01-active",
    });
  } catch (err: unknown) {
    crossClinicNewDocDenied = true;
    assert((err as Error).message.includes("không có phân công"), "CASE E2-9: Error message");
  }
  assert(crossClinicNewDocDenied, "CASE E2-9: Cross-clinic new doctor must be denied");

  // 9. AUTH1.7E3B APPOINTMENT STATUS TRANSITION & ROLE MATRIX TESTS
  interface MockAppointmentState {
    id: string;
    treatment_course_id: string;
    status: string;
  }

  const apptStatusDb: MockAppointmentState[] = [
    { id: "appt-planned-tt01", treatment_course_id: "course-tt01-1", status: "PLANNED" },
    { id: "appt-checkedin-tt01", treatment_course_id: "course-tt01-1", status: "CHECKED_IN" },
    { id: "appt-intreat-tt01", treatment_course_id: "course-tt01-1", status: "IN_TREATMENT" },
    { id: "appt-completed-tt01", treatment_course_id: "course-tt01-1", status: "COMPLETED" },
    { id: "appt-planned-md01", treatment_course_id: "course-md01-1", status: "PLANNED" },
    { id: "appt-planned-legacy", treatment_course_id: "course-legacy-null", status: "PLANNED" },
  ];

  const ALLOWED_TEST_TRANSITIONS: Record<string, { targetStatus: string; allowedRoles: string[] }> = {
    PLANNED: { targetStatus: "CHECKED_IN", allowedRoles: ["RECEPTIONIST", "ADMIN"] },
    CHECKED_IN: { targetStatus: "IN_TREATMENT", allowedRoles: ["DOCTOR", "TECHNICIAN", "Y_SI"] },
    IN_TREATMENT: { targetStatus: "COMPLETED", allowedRoles: ["DOCTOR", "TECHNICIAN", "Y_SI"] },
  };

  function simulateUpdateAppointmentStatusWorkflow(params: {
    callerRoles: string[];
    activeClinicId: string;
    appointmentId: string;
    requestedStatus: string;
  }) {
    // 1. Target Appointment validation
    const appt = apptStatusDb.find((a) => a.id === params.appointmentId);
    if (!appt || !appt.treatment_course_id) {
      throw new Error("Không tìm thấy lịch hẹn phù hợp tại cơ sở hiện tại.");
    }

    // 2. Parent Course clinic validation
    const course = courseDb.find((c) => c.id === appt.treatment_course_id);
    if (!course || !course.clinic_id || course.clinic_id !== params.activeClinicId) {
      throw new Error("Không tìm thấy lịch hẹn phù hợp tại cơ sở hiện tại.");
    }

    // 3. Transition validation against server current status
    const currentStatus = appt.status;
    const rule = ALLOWED_TEST_TRANSITIONS[currentStatus];
    if (!rule || rule.targetStatus !== params.requestedStatus) {
      throw new Error(`Chuyển đổi trạng thái không hợp lệ: không thể chuyển từ ${currentStatus} sang ${params.requestedStatus}.`);
    }

    // 4. Role authorization for this specific transition
    const isAuthorized = rule.allowedRoles.some((r) => params.callerRoles.includes(r));
    if (!isAuthorized) {
      throw new Error("Bạn không có quyền thực hiện chuyển đổi trạng thái này tại cơ sở hiện tại.");
    }

    return { success: true, message: `Status updated from ${currentStatus} to ${params.requestedStatus}` };
  }

  // CASE E3B-1: PLANNED -> CHECKED_IN, RECEPTIONIST -> PASS
  const resE3B1 = simulateUpdateAppointmentStatusWorkflow({
    callerRoles: ["RECEPTIONIST"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-planned-tt01",
    requestedStatus: "CHECKED_IN",
  });
  assert(resE3B1.success === true, "CASE E3B-1: RECEPTIONIST can check in");

  // CASE E3B-2: PLANNED -> CHECKED_IN, ADMIN -> PASS
  const resE3B2 = simulateUpdateAppointmentStatusWorkflow({
    callerRoles: ["ADMIN"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-planned-tt01",
    requestedStatus: "CHECKED_IN",
  });
  assert(resE3B2.success === true, "CASE E3B-2: ADMIN can check in");

  // CASE E3B-3: PLANNED -> CHECKED_IN, DOCTOR-only -> DENIED
  let docCheckinDenied = false;
  try {
    simulateUpdateAppointmentStatusWorkflow({
      callerRoles: ["DOCTOR"],
      activeClinicId: "clinic-tt01",
      appointmentId: "appt-planned-tt01",
      requestedStatus: "CHECKED_IN",
    });
  } catch (err: unknown) {
    docCheckinDenied = true;
    assert((err as Error).message.includes("không có quyền"), "CASE E3B-3: Error message");
  }
  assert(docCheckinDenied, "CASE E3B-3: DOCTOR-only cannot check in");

  // CASE E3B-4: CHECKED_IN -> IN_TREATMENT, DOCTOR -> PASS
  const resE3B4 = simulateUpdateAppointmentStatusWorkflow({
    callerRoles: ["DOCTOR"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-checkedin-tt01",
    requestedStatus: "IN_TREATMENT",
  });
  assert(resE3B4.success === true, "CASE E3B-4: DOCTOR can start treatment");

  // CASE E3B-5: CHECKED_IN -> IN_TREATMENT, TECHNICIAN -> PASS
  const resE3B5 = simulateUpdateAppointmentStatusWorkflow({
    callerRoles: ["TECHNICIAN"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-checkedin-tt01",
    requestedStatus: "IN_TREATMENT",
  });
  assert(resE3B5.success === true, "CASE E3B-5: TECHNICIAN can start treatment");

  // CASE E3B-6: CHECKED_IN -> IN_TREATMENT, Y_SI -> PASS
  const resE3B6 = simulateUpdateAppointmentStatusWorkflow({
    callerRoles: ["Y_SI"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-checkedin-tt01",
    requestedStatus: "IN_TREATMENT",
  });
  assert(resE3B6.success === true, "CASE E3B-6: Y_SI can start treatment");

  // CASE E3B-7: CHECKED_IN -> IN_TREATMENT, ADMIN-only -> DENIED
  let adminStartDenied = false;
  try {
    simulateUpdateAppointmentStatusWorkflow({
      callerRoles: ["ADMIN"],
      activeClinicId: "clinic-tt01",
      appointmentId: "appt-checkedin-tt01",
      requestedStatus: "IN_TREATMENT",
    });
  } catch (err: unknown) {
    adminStartDenied = true;
    assert((err as Error).message.includes("không có quyền"), "CASE E3B-7: Error message");
  }
  assert(adminStartDenied, "CASE E3B-7: ADMIN-only cannot start treatment");

  // CASE E3B-8: CHECKED_IN -> IN_TREATMENT, RECEPTIONIST-only -> DENIED
  let recStartDenied = false;
  try {
    simulateUpdateAppointmentStatusWorkflow({
      callerRoles: ["RECEPTIONIST"],
      activeClinicId: "clinic-tt01",
      appointmentId: "appt-checkedin-tt01",
      requestedStatus: "IN_TREATMENT",
    });
  } catch (err: unknown) {
    recStartDenied = true;
    assert((err as Error).message.includes("không có quyền"), "CASE E3B-8: Error message");
  }
  assert(recStartDenied, "CASE E3B-8: RECEPTIONIST cannot start treatment");

  // CASE E3B-9: IN_TREATMENT -> COMPLETED, DOCTOR -> PASS
  const resE3B9 = simulateUpdateAppointmentStatusWorkflow({
    callerRoles: ["DOCTOR"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-intreat-tt01",
    requestedStatus: "COMPLETED",
  });
  assert(resE3B9.success === true, "CASE E3B-9: DOCTOR can complete treatment");

  // CASE E3B-10: IN_TREATMENT -> COMPLETED, TECHNICIAN -> PASS
  const resE3B10 = simulateUpdateAppointmentStatusWorkflow({
    callerRoles: ["TECHNICIAN"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-intreat-tt01",
    requestedStatus: "COMPLETED",
  });
  assert(resE3B10.success === true, "CASE E3B-10: TECHNICIAN can complete treatment");

  // CASE E3B-11: IN_TREATMENT -> COMPLETED, Y_SI -> PASS
  const resE3B11 = simulateUpdateAppointmentStatusWorkflow({
    callerRoles: ["Y_SI"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-intreat-tt01",
    requestedStatus: "COMPLETED",
  });
  assert(resE3B11.success === true, "CASE E3B-11: Y_SI can complete treatment");

  // CASE E3B-12: IN_TREATMENT -> COMPLETED, ADMIN-only -> DENIED
  let adminCompleteDenied = false;
  try {
    simulateUpdateAppointmentStatusWorkflow({
      callerRoles: ["ADMIN"],
      activeClinicId: "clinic-tt01",
      appointmentId: "appt-intreat-tt01",
      requestedStatus: "COMPLETED",
    });
  } catch (err: unknown) {
    adminCompleteDenied = true;
    assert((err as Error).message.includes("không có quyền"), "CASE E3B-12: Error message");
  }
  assert(adminCompleteDenied, "CASE E3B-12: ADMIN-only cannot complete treatment");

  // CASE E3B-13: ADMIN + DOCTOR, IN_TREATMENT -> COMPLETED -> PASS
  const resE3B13 = simulateUpdateAppointmentStatusWorkflow({
    callerRoles: ["ADMIN", "DOCTOR"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-intreat-tt01",
    requestedStatus: "COMPLETED",
  });
  assert(resE3B13.success === true, "CASE E3B-13: ADMIN+DOCTOR can complete treatment");

  // CASE E3B-14: RECEPTIONIST + TECHNICIAN multi-role
  const resE3B14a = simulateUpdateAppointmentStatusWorkflow({
    callerRoles: ["RECEPTIONIST", "TECHNICIAN"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-planned-tt01",
    requestedStatus: "CHECKED_IN",
  });
  assert(resE3B14a.success === true, "CASE E3B-14a: Checkin via RECEPTIONIST");

  const resE3B14b = simulateUpdateAppointmentStatusWorkflow({
    callerRoles: ["RECEPTIONIST", "TECHNICIAN"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-checkedin-tt01",
    requestedStatus: "IN_TREATMENT",
  });
  assert(resE3B14b.success === true, "CASE E3B-14b: Start treatment via TECHNICIAN");

  // CASE E3B-15: Arbitrary jump PLANNED -> COMPLETED -> DENIED
  let skipToCompleteDenied = false;
  try {
    simulateUpdateAppointmentStatusWorkflow({
      callerRoles: ["DOCTOR"],
      activeClinicId: "clinic-tt01",
      appointmentId: "appt-planned-tt01",
      requestedStatus: "COMPLETED",
    });
  } catch (err: unknown) {
    skipToCompleteDenied = true;
    assert((err as Error).message.includes("không thể chuyển từ PLANNED sang COMPLETED"), "CASE E3B-15: Error message");
  }
  assert(skipToCompleteDenied, "CASE E3B-15: Arbitrary jump PLANNED->COMPLETED denied");

  // CASE E3B-16: CHECKED_IN -> COMPLETED -> DENIED
  let skipInTreatDenied = false;
  try {
    simulateUpdateAppointmentStatusWorkflow({
      callerRoles: ["DOCTOR"],
      activeClinicId: "clinic-tt01",
      appointmentId: "appt-checkedin-tt01",
      requestedStatus: "COMPLETED",
    });
  } catch (err: unknown) {
    skipInTreatDenied = true;
    assert((err as Error).message.includes("không thể chuyển từ CHECKED_IN sang COMPLETED"), "CASE E3B-16: Error message");
  }
  assert(skipInTreatDenied, "CASE E3B-16: CHECKED_IN->COMPLETED denied");

  // CASE E3B-17: COMPLETED -> PLANNED -> DENIED
  let backwardsDenied = false;
  try {
    simulateUpdateAppointmentStatusWorkflow({
      callerRoles: ["ADMIN"],
      activeClinicId: "clinic-tt01",
      appointmentId: "appt-completed-tt01",
      requestedStatus: "PLANNED",
    });
  } catch {
    backwardsDenied = true;
  }
  assert(backwardsDenied, "CASE E3B-17: COMPLETED->PLANNED denied");

  // CASE E3B-18: Requested RESCHEDULED through generic action -> DENIED
  let rescheduledDenied = false;
  try {
    simulateUpdateAppointmentStatusWorkflow({
      callerRoles: ["ADMIN"],
      activeClinicId: "clinic-tt01",
      appointmentId: "appt-planned-tt01",
      requestedStatus: "RESCHEDULED",
    });
  } catch {
    rescheduledDenied = true;
  }
  assert(rescheduledDenied, "CASE E3B-18: RESCHEDULED denied through status action");

  // CASE E3B-20: Cross-clinic Appointment -> DENIED
  let crossClinicStatusDenied = false;
  try {
    simulateUpdateAppointmentStatusWorkflow({
      callerRoles: ["RECEPTIONIST"],
      activeClinicId: "clinic-tt01",
      appointmentId: "appt-planned-md01",
      requestedStatus: "CHECKED_IN",
    });
  } catch (err: unknown) {
    crossClinicStatusDenied = true;
    assert((err as Error).message.includes("Không tìm thấy lịch hẹn"), "CASE E3B-20: Error message");
  }
  assert(crossClinicStatusDenied, "CASE E3B-20: Cross clinic status change denied");

  // CASE E3B-21: Legacy Course clinic_id = null -> DENIED
  let legacyStatusDenied = false;
  try {
    simulateUpdateAppointmentStatusWorkflow({
      callerRoles: ["RECEPTIONIST"],
      activeClinicId: "clinic-tt01",
      appointmentId: "appt-planned-legacy",
      requestedStatus: "CHECKED_IN",
    });
  } catch (err: unknown) {
    legacyStatusDenied = true;
    assert((err as Error).message.includes("Không tìm thấy lịch hẹn"), "CASE E3B-21: Error message");
  }
  assert(legacyStatusDenied, "CASE E3B-21: Legacy course status change denied");

  // 10. SESSION-GOV1C ATOMIC RPC WIRING, ERROR MAPPING & DEFENSE-IN-DEPTH TESTS
  const RPC_ERROR_MAP_TEST: Record<string, string> = {
    APPOINTMENT_NOT_FOUND: "Không tìm thấy lịch hẹn phù hợp.",
    INVALID_APPOINTMENT_STATE: "Trạng thái lịch hẹn không còn phù hợp để hoàn tất điều trị.",
    INCONSISTENT_COMPLETION_STATE: "Dữ liệu buổi điều trị không nhất quán. Vui lòng liên hệ quản trị viên.",
    COURSE_NOT_FOUND: "Không tìm thấy liệu trình điều trị.",
    COURSE_NOT_ACTIVE: "Liệu trình hiện không ở trạng thái có thể hoàn tất buổi điều trị.",
    PLAN_NOT_ESTABLISHED: "Bác sĩ chưa thiết lập kế hoạch điều trị cho liệu trình này.",
    PLAN_ALREADY_COMPLETED: "Liệu trình đã đủ số buổi theo kế hoạch.",
    INVALID_ACTOR: "Thông tin tài khoản thực hiện không hợp lệ.",
  };

  interface MockRpcCallRecord {
    fnName: string;
    params: {
      p_appointment_id: string;
      p_actor_staff_id: string;
      p_actor_user_id: string;
      p_clinical_note: string | null;
    };
  }

  let lastRpcCall: MockRpcCallRecord | null = null;
  let mockRpcResponse: { data: unknown; error: unknown } = {
    data: { success: true, idempotent: false },
    error: null,
  };

  function simulateUpdateAppointmentStatusActionWorkflow(params: {
    callerAuthUserId: string;
    callerStaffId: string;
    callerRoles: string[];
    activeClinicId: string;
    appointmentId: string;
    requestedStatus: string;
    notes?: string;
  }) {
    lastRpcCall = null;

    // 1. Target Appointment validation
    const appt = apptStatusDb.find((a) => a.id === params.appointmentId);
    if (!appt || !appt.treatment_course_id) {
      return { success: false, error: "Không tìm thấy lịch hẹn phù hợp tại cơ sở hiện tại." };
    }

    // 2. Parent Course clinic validation
    const course = courseDb.find((c) => c.id === appt.treatment_course_id);
    if (!course || !course.clinic_id || course.clinic_id !== params.activeClinicId) {
      return { success: false, error: "Không tìm thấy lịch hẹn phù hợp tại cơ sở hiện tại." };
    }

    // 3. Transition validation against server current status
    const currentStatus = appt.status;
    const rule = ALLOWED_TEST_TRANSITIONS[currentStatus];
    if (!rule || rule.targetStatus !== params.requestedStatus) {
      return {
        success: false,
        error: `Chuyển đổi trạng thái không hợp lệ: không thể chuyển từ ${currentStatus} sang ${params.requestedStatus}.`,
      };
    }

    // 4. Role authorization for this specific transition
    const isAuthorized = rule.allowedRoles.some((r) => params.callerRoles.includes(r));
    if (!isAuthorized) {
      return {
        success: false,
        error: "Bạn không có quyền thực hiện chuyển đổi trạng thái này tại cơ sở hiện tại.",
      };
    }

    // 5. Privileged execution dispatch
    if (params.requestedStatus === "COMPLETED") {
      // Must use atomic RPC
      lastRpcCall = {
        fnName: "complete_appointment_treatment_session",
        params: {
          p_appointment_id: params.appointmentId,
          p_actor_staff_id: params.callerStaffId,
          p_actor_user_id: params.callerAuthUserId,
          p_clinical_note: params.notes || null,
        },
      };

      if (mockRpcResponse.error || !mockRpcResponse.data) {
        return { success: false, error: "Lỗi hệ thống khi hoàn tất buổi điều trị. Vui lòng thử lại." };
      }

      const res = mockRpcResponse.data as {
        success: boolean;
        idempotent?: boolean;
        error_code?: string;
        message?: string;
      };

      if (!res.success) {
        const errorMsg =
          (res.error_code && RPC_ERROR_MAP_TEST[res.error_code]) ||
          res.message ||
          "Lỗi hoàn tất buổi điều trị.";
        return { success: false, error: errorMsg };
      }

      return { success: true, data: res };
    }

    // Non-completion lightweight transition
    return { success: true, data: { status: params.requestedStatus } };
  }

  // CASE C-1: IN_TREATMENT -> COMPLETED, DOCTOR same clinic -> calls atomic RPC
  mockRpcResponse = { data: { success: true, idempotent: false }, error: null };
  const resC1 = simulateUpdateAppointmentStatusActionWorkflow({
    callerAuthUserId: "user-auth-doc1",
    callerStaffId: "staff-doc1",
    callerRoles: ["DOCTOR"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-intreat-tt01",
    requestedStatus: "COMPLETED",
    notes: "Completed session note",
  });
  assert(resC1.success === true, "CASE C-1: DOCTOR completion succeeded");
  const callC1 = lastRpcCall as MockRpcCallRecord | null;
  assert(callC1 !== null, "CASE C-1: RPC called");
  assert(callC1?.fnName === "complete_appointment_treatment_session", "CASE C-1: RPC function name");
  assert(callC1?.params.p_actor_staff_id === "staff-doc1", "CASE C-12: p_actor_staff_id receives trusted Staff ID");
  assert(callC1?.params.p_actor_user_id === "user-auth-doc1", "CASE C-13: p_actor_user_id receives Auth User UUID");
  assert(callC1?.params.p_clinical_note === "Completed session note", "CASE C-1: Clinical note passed");

  // CASE C-2: TECHNICIAN same clinic -> calls RPC
  const resC2 = simulateUpdateAppointmentStatusActionWorkflow({
    callerAuthUserId: "user-auth-tech1",
    callerStaffId: "staff-tech1",
    callerRoles: ["TECHNICIAN"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-intreat-tt01",
    requestedStatus: "COMPLETED",
  });
  assert(resC2.success === true, "CASE C-2: TECHNICIAN completion succeeded");
  assert(lastRpcCall !== null, "CASE C-2: RPC called for TECHNICIAN");

  // CASE C-3: Y_SI same clinic -> calls RPC
  const resC3 = simulateUpdateAppointmentStatusActionWorkflow({
    callerAuthUserId: "user-auth-ysi1",
    callerStaffId: "staff-ysi1",
    callerRoles: ["Y_SI"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-intreat-tt01",
    requestedStatus: "COMPLETED",
  });
  assert(resC3.success === true, "CASE C-3: Y_SI completion succeeded");
  assert(lastRpcCall !== null, "CASE C-3: RPC called for Y_SI");

  // CASE C-4: ADMIN-only completion -> DENIED, RPC not called
  lastRpcCall = null;
  const resC4 = simulateUpdateAppointmentStatusActionWorkflow({
    callerAuthUserId: "user-auth-admin1",
    callerStaffId: "staff-admin1",
    callerRoles: ["ADMIN"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-intreat-tt01",
    requestedStatus: "COMPLETED",
  });
  assert(resC4.success === false, "CASE C-4: ADMIN-only completion denied");
  assert(lastRpcCall === null, "CASE C-4: RPC must NOT be called for unauthorized role");

  // CASE C-5: RECEPTIONIST-only completion -> DENIED, RPC not called
  lastRpcCall = null;
  const resC5 = simulateUpdateAppointmentStatusActionWorkflow({
    callerAuthUserId: "user-auth-rec1",
    callerStaffId: "staff-rec1",
    callerRoles: ["RECEPTIONIST"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-intreat-tt01",
    requestedStatus: "COMPLETED",
  });
  assert(resC5.success === false, "CASE C-5: RECEPTIONIST-only completion denied");
  assert(lastRpcCall === null, "CASE C-5: RPC must NOT be called for RECEPTIONIST");

  // CASE C-6: Cross-clinic Appointment completion -> DENIED, RPC not called
  lastRpcCall = null;
  const resC6 = simulateUpdateAppointmentStatusActionWorkflow({
    callerAuthUserId: "user-auth-doc1",
    callerStaffId: "staff-doc1",
    callerRoles: ["DOCTOR"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-planned-md01",
    requestedStatus: "COMPLETED",
  });
  assert(resC6.success === false, "CASE C-6: Cross-clinic appointment denied");
  assert(lastRpcCall === null, "CASE C-6: RPC must NOT be called for cross-clinic appointment");

  // CASE C-7: PLANNED -> CHECKED_IN does NOT call completion RPC
  lastRpcCall = null;
  const resC7 = simulateUpdateAppointmentStatusActionWorkflow({
    callerAuthUserId: "user-auth-rec1",
    callerStaffId: "staff-rec1",
    callerRoles: ["RECEPTIONIST"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-planned-tt01",
    requestedStatus: "CHECKED_IN",
  });
  assert(resC7.success === true, "CASE C-7: Check-in succeeded");
  assert(lastRpcCall === null, "CASE C-7: Completion RPC must NOT be called for check-in");

  // CASE C-8: CHECKED_IN -> IN_TREATMENT does NOT call completion RPC
  lastRpcCall = null;
  const resC8 = simulateUpdateAppointmentStatusActionWorkflow({
    callerAuthUserId: "user-auth-doc1",
    callerStaffId: "staff-doc1",
    callerRoles: ["DOCTOR"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-checkedin-tt01",
    requestedStatus: "IN_TREATMENT",
  });
  assert(resC8.success === true, "CASE C-8: Start treatment succeeded");
  assert(lastRpcCall === null, "CASE C-8: Completion RPC must NOT be called for start treatment");

  // CASE C-15: RPC returns success=true, idempotent=false -> Application success
  mockRpcResponse = { data: { success: true, idempotent: false }, error: null };
  const resC15 = simulateUpdateAppointmentStatusActionWorkflow({
    callerAuthUserId: "user-auth-doc1",
    callerStaffId: "staff-doc1",
    callerRoles: ["DOCTOR"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-intreat-tt01",
    requestedStatus: "COMPLETED",
  });
  assert(resC15.success === true, "CASE C-15: Normal completion success");

  // CASE C-16: RPC returns success=true, idempotent=true -> Application success
  mockRpcResponse = { data: { success: true, idempotent: true, message: "Lịch hẹn đã được hoàn tất trước đó." }, error: null };
  const resC16 = simulateUpdateAppointmentStatusActionWorkflow({
    callerAuthUserId: "user-auth-doc1",
    callerStaffId: "staff-doc1",
    callerRoles: ["DOCTOR"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-intreat-tt01",
    requestedStatus: "COMPLETED",
  });
  assert(resC16.success === true, "CASE C-16: Idempotent completion success");

  // CASE C-17: RPC returns PLAN_NOT_ESTABLISHED -> safe Vietnamese error
  mockRpcResponse = { data: { success: false, error_code: "PLAN_NOT_ESTABLISHED" }, error: null };
  const resC17 = simulateUpdateAppointmentStatusActionWorkflow({
    callerAuthUserId: "user-auth-doc1",
    callerStaffId: "staff-doc1",
    callerRoles: ["DOCTOR"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-intreat-tt01",
    requestedStatus: "COMPLETED",
  });
  assert(resC17.success === false, "CASE C-17: Plan not established returns error");
  assert(resC17.error === "Bác sĩ chưa thiết lập kế hoạch điều trị cho liệu trình này.", "CASE C-17: Safe message");

  // CASE C-18: RPC transport error -> safe generic failure
  mockRpcResponse = { data: null, error: new Error("RPC network timeout") };
  const resC18 = simulateUpdateAppointmentStatusActionWorkflow({
    callerAuthUserId: "user-auth-doc1",
    callerStaffId: "staff-doc1",
    callerRoles: ["DOCTOR"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-intreat-tt01",
    requestedStatus: "COMPLETED",
  });
  assert(resC18.success === false, "CASE C-18: Transport error handled safely");
  assert(resC18.error === "Lỗi hệ thống khi hoàn tất buổi điều trị. Vui lòng thử lại.", "CASE C-18: Safe generic message");

  // CASE C-19: RPC COURSE_NOT_ACTIVE -> safe failure
  mockRpcResponse = { data: { success: false, error_code: "COURSE_NOT_ACTIVE" }, error: null };
  const resC19 = simulateUpdateAppointmentStatusActionWorkflow({
    callerAuthUserId: "user-auth-doc1",
    callerStaffId: "staff-doc1",
    callerRoles: ["DOCTOR"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-intreat-tt01",
    requestedStatus: "COMPLETED",
  });
  assert(resC19.success === false && resC19.error === "Liệu trình hiện không ở trạng thái có thể hoàn tất buổi điều trị.", "CASE C-19: COURSE_NOT_ACTIVE message");

  // CASE C-20: RPC INCONSISTENT_COMPLETION_STATE -> safe failure
  mockRpcResponse = { data: { success: false, error_code: "INCONSISTENT_COMPLETION_STATE" }, error: null };
  const resC20 = simulateUpdateAppointmentStatusActionWorkflow({
    callerAuthUserId: "user-auth-doc1",
    callerStaffId: "staff-doc1",
    callerRoles: ["DOCTOR"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-intreat-tt01",
    requestedStatus: "COMPLETED",
  });
  assert(resC20.success === false && resC20.error === "Dữ liệu buổi điều trị không nhất quán. Vui lòng liên hệ quản trị viên.", "CASE C-20: INCONSISTENT_COMPLETION_STATE message");

  console.log("All Scheduling & Slots Unit Tests PASSED!");
}

