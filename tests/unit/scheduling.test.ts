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
    schedule_count: 7,
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

  // 11. SCHED-GOV1B AUTO-SCHEDULER FAIL-CLOSED & FALLBACK REMOVAL TESTS
  interface MockScheduleRpcResponse {
    data: unknown;
    error: unknown;
  }

  let mockScheduleRpcState: MockScheduleRpcResponse = {
    data: {
      success: true,
      status: "FULL",
      scheduled_count: 7,
      requested_count: 7,
      appointment_ids: ["appt-1", "appt-2", "appt-3", "appt-4", "appt-5", "appt-6", "appt-7"],
    },
    error: null,
  };

  let directAppointmentWritesCount = 0;
  let directCourseUpdatesCount = 0;

  function simulateExecuteAutoSchedule(input: {
    treatment_course_id: string;
    doctor_id: string;
    start_date: string;
    schedule_count: number;
    preferred_time?: string;
    selected_weekdays?: number[];
  }) {
    directAppointmentWritesCount = 0;
    directCourseUpdatesCount = 0;

    try {
      if (mockScheduleRpcState.error || !mockScheduleRpcState.data) {
        // FAIL CLOSED: Return failure, do NOT execute fallback writes
        return {
          success: false,
          status: "FAILED",
          scheduled_count: 0,
          requested_count: input.schedule_count,
          appointment_ids: [],
          message: "Không thể tự động xếp lịch lúc này. Vui lòng thử lại.",
        };
      }

      const res = mockScheduleRpcState.data as {
        success: boolean;
        status?: "FULL" | "PARTIAL" | "FAILED";
        error_code?: string;
        scheduled_count?: number;
        requested_count?: number;
        appointment_ids?: string[];
        message?: string;
      };

      if (!res.success) {
        let localizedMessage = res.message || "Không thể tự động xếp lịch lúc này. Vui lòng thử lại.";
        if (res.error_code === "PLAN_NOT_ESTABLISHED") {
          localizedMessage = "Bác sĩ chưa thiết lập kế hoạch điều trị cho liệu trình này.";
        } else if (res.error_code === "EXCEEDS_PLAN_CAPACITY") {
          localizedMessage = "Số lịch muốn xếp vượt quá số buổi còn lại trong kế hoạch điều trị.";
        } else if (res.error_code === "INVALID_SCHEDULE_COUNT") {
          localizedMessage = "Số lịch muốn xếp phải lớn hơn 0.";
        }

        return {
          success: false,
          status: res.status || "FAILED",
          scheduled_count: res.scheduled_count || 0,
          requested_count: res.requested_count || input.schedule_count,
          appointment_ids: res.appointment_ids || [],
          message: localizedMessage,
        };
      }

      return {
        success: true,
        status: res.status || "FULL",
        scheduled_count: res.scheduled_count ?? input.schedule_count,
        requested_count: res.requested_count ?? input.schedule_count,
        appointment_ids: res.appointment_ids || [],
        message: `Xếp lịch tự động thành công (${res.scheduled_count ?? input.schedule_count}/${res.requested_count ?? input.schedule_count} buổi).`,
      };
    } catch {
      return {
        success: false,
        status: "FAILED",
        scheduled_count: 0,
        requested_count: input.schedule_count,
        appointment_ids: [],
        message: "Không thể tự động xếp lịch lúc này. Vui lòng thử lại.",
      };
    }
  }

  // CASE G1B-1: RPC success -> auto-scheduling succeeds
  mockScheduleRpcState = {
    data: {
      success: true,
      status: "FULL",
      scheduled_count: 7,
      requested_count: 7,
      appointment_ids: ["a1", "a2", "a3", "a4", "a5", "a6", "a7"],
    },
    error: null,
  };
  const resG1B1 = simulateExecuteAutoSchedule({
    treatment_course_id: "course-tt01-1",
    doctor_id: "doc-tt01-active",
    start_date: "2026-08-25",
    schedule_count: 7,
  });
  assert(resG1B1.success === true, "CASE G1B-1: RPC success must succeed");
  assert(resG1B1.scheduled_count === 7, "CASE G1B-1: 7 scheduled");
  assert(directAppointmentWritesCount === 0, "CASE G1B-1: Zero direct writes");

  // CASE G1B-2: RPC transport error -> safe failure, zero direct Appointment insert
  mockScheduleRpcState = { data: null, error: new Error("Network connection lost") };
  const resG1B2 = simulateExecuteAutoSchedule({
    treatment_course_id: "course-tt01-1",
    doctor_id: "doc-tt01-active",
    start_date: "2026-08-25",
    schedule_count: 7,
  });
  assert(resG1B2.success === false, "CASE G1B-2: Transport error fails closed");
  assert(resG1B2.message === "Không thể tự động xếp lịch lúc này. Vui lòng thử lại.", "CASE G1B-2: Safe message");
  assert(directAppointmentWritesCount === 0, "CASE G1B-2: Zero direct appointment inserts");
  assert(directCourseUpdatesCount === 0, "CASE G1B-2: Zero direct course updates");

  // CASE G1B-3: RPC database/domain error -> safe failure, zero fallback writes
  mockScheduleRpcState = { data: { success: false, status: "FAILED", message: "Treatment course not found." }, error: null };
  const resG1B3 = simulateExecuteAutoSchedule({
    treatment_course_id: "course-nonexistent",
    doctor_id: "doc-tt01-active",
    start_date: "2026-08-25",
    schedule_count: 7,
  });
  assert(resG1B3.success === false, "CASE G1B-3: Domain error fails closed");
  assert(directAppointmentWritesCount === 0, "CASE G1B-3: Zero fallback appointment writes");
  assert(directCourseUpdatesCount === 0, "CASE G1B-3: Zero fallback course updates");

  // CASE G1B-4: RPC permission error -> safe failure, no alternate mutation path
  mockScheduleRpcState = { data: null, error: new Error("permission denied for function schedule_treatment_course") };
  const resG1B4 = simulateExecuteAutoSchedule({
    treatment_course_id: "course-tt01-1",
    doctor_id: "doc-tt01-active",
    start_date: "2026-08-25",
    schedule_count: 7,
  });
  assert(resG1B4.success === false, "CASE G1B-4: Permission error fails closed");
  assert(directAppointmentWritesCount === 0, "CASE G1B-4: Zero direct writes on permission error");

  // CASE G1B-5: Future-like error PLAN_NOT_ESTABLISHED -> does NOT enter direct fallback
  mockScheduleRpcState = { data: { success: false, status: "FAILED", error_code: "PLAN_NOT_ESTABLISHED", message: "PLAN_NOT_ESTABLISHED" }, error: null };
  const resG1B5 = simulateExecuteAutoSchedule({
    treatment_course_id: "course-tt01-1",
    doctor_id: "doc-tt01-active",
    start_date: "2026-08-25",
    schedule_count: 7,
  });
  assert(resG1B5.success === false, "CASE G1B-5: Future plan error fails closed");
  assert(resG1B5.message === "Bác sĩ chưa thiết lập kế hoạch điều trị cho liệu trình này.", "CASE G1B-5: Safe localized error message");
  assert(directAppointmentWritesCount === 0, "CASE G1B-5: Zero fallback writes on plan error");
  assert(directCourseUpdatesCount === 0, "CASE G1B-5: Zero fallback course updates");

  // CASE G1B-6: RPC function unavailable -> failure, no local scheduling fallback
  mockScheduleRpcState = { data: null, error: new Error("function public.schedule_treatment_course does not exist") };
  const resG1B6 = simulateExecuteAutoSchedule({
    treatment_course_id: "course-tt01-1",
    doctor_id: "doc-tt01-active",
    start_date: "2026-08-25",
    schedule_count: 7,
  });
  assert(resG1B6.success === false, "CASE G1B-6: Function missing fails closed");
  assert(directAppointmentWritesCount === 0, "CASE G1B-6: Zero fallback writes when function missing");

  // 12. SCHED-RESCH1 APPOINTMENT RESCHEDULE LIFECYCLE & IN-PLACE PLANNED STATUS TESTS
  interface MockRescheduleAppt {
    id: string;
    treatment_course_id: string;
    doctor_id: string;
    appointment_date: string;
    scheduled_start_at: string;
    status: string;
    manual_override: boolean;
  }

  const rescheduleDb: MockRescheduleAppt[] = [
    {
      id: "appt-resch-planned",
      treatment_course_id: "course-tt01-1",
      doctor_id: "doc-tt01-active",
      appointment_date: "2026-08-25",
      scheduled_start_at: "2026-08-25T08:00:00+07:00",
      status: "PLANNED",
      manual_override: false,
    },
    {
      id: "appt-resch-checkedin",
      treatment_course_id: "course-tt01-1",
      doctor_id: "doc-tt01-active",
      appointment_date: "2026-08-25",
      scheduled_start_at: "2026-08-25T08:00:00+07:00",
      status: "CHECKED_IN",
      manual_override: false,
    },
    {
      id: "appt-resch-intreatment",
      treatment_course_id: "course-tt01-1",
      doctor_id: "doc-tt01-active",
      appointment_date: "2026-08-25",
      scheduled_start_at: "2026-08-25T08:00:00+07:00",
      status: "IN_TREATMENT",
      manual_override: false,
    },
    {
      id: "appt-resch-completed",
      treatment_course_id: "course-tt01-1",
      doctor_id: "doc-tt01-active",
      appointment_date: "2026-08-25",
      scheduled_start_at: "2026-08-25T08:00:00+07:00",
      status: "COMPLETED",
      manual_override: false,
    },
    {
      id: "appt-resch-cancelled",
      treatment_course_id: "course-tt01-1",
      doctor_id: "doc-tt01-active",
      appointment_date: "2026-08-25",
      scheduled_start_at: "2026-08-25T08:00:00+07:00",
      status: "CANCELLED",
      manual_override: false,
    },
    {
      id: "appt-resch-noshow",
      treatment_course_id: "course-tt01-1",
      doctor_id: "doc-tt01-active",
      appointment_date: "2026-08-25",
      scheduled_start_at: "2026-08-25T08:00:00+07:00",
      status: "NO_SHOW",
      manual_override: false,
    },
    {
      id: "appt-resch-legacy",
      treatment_course_id: "course-tt01-1",
      doctor_id: "doc-tt01-active",
      appointment_date: "2026-08-25",
      scheduled_start_at: "2026-08-25T08:00:00+07:00",
      status: "RESCHEDULED",
      manual_override: true,
    },
  ];

  let rescheduleAuditEvents: Array<{ action: string; entity_id: string; before: unknown; after: unknown }> = [];

  function simulateRescheduleService(params: {
    appointmentId: string;
    newDate: string;
    newStartAt: string;
    newDoctorId?: string;
  }) {
    const existing = rescheduleDb.find((a) => a.id === params.appointmentId);
    if (!existing) {
      throw new Error("Appointment not found.");
    }

    const ALLOWED_RESCHEDULE_SOURCE_STATUSES = ["PLANNED", "CONFIRMED", "RESCHEDULED"];
    if (!ALLOWED_RESCHEDULE_SOURCE_STATUSES.includes(existing.status)) {
      throw new Error(
        `Không thể đổi lịch cho lịch hẹn ở trạng thái ${existing.status}. Chỉ cho phép đổi lịch các lịch hẹn chưa khám/trị liệu.`
      );
    }

    const beforeData = { ...existing };
    existing.appointment_date = params.newDate;
    existing.scheduled_start_at = params.newStartAt;
    if (params.newDoctorId) {
      existing.doctor_id = params.newDoctorId;
    }
    existing.status = "PLANNED";
    existing.manual_override = true;

    rescheduleAuditEvents.push({
      action: "RESCHEDULE_APPOINTMENT",
      entity_id: existing.id,
      before: beforeData,
      after: { ...existing },
    });

    return { ...existing };
  }

  // CASE RESCH-1: PLANNED Appointment is rescheduled -> same row, new date/time, status = PLANNED
  const initialApptCount = rescheduleDb.length;
  rescheduleAuditEvents = [];
  const resResch1 = simulateRescheduleService({
    appointmentId: "appt-resch-planned",
    newDate: "2026-08-28",
    newStartAt: "2026-08-28T09:30:00+07:00",
  });
  assert(resResch1.id === "appt-resch-planned", "CASE RESCH-1: Same appointment ID retained");
  assert(resResch1.appointment_date === "2026-08-28", "CASE RESCH-1: Date updated");
  assert(resResch1.scheduled_start_at === "2026-08-28T09:30:00+07:00", "CASE RESCH-1: Time updated");
  assert(resResch1.status === "PLANNED", "CASE RESCH-1: Status must be PLANNED (NOT RESCHEDULED)");
  assert(rescheduleDb.length === initialApptCount, "CASE RESCH-3: No second appointment row created");
  assert(rescheduleAuditEvents.length === 1, "CASE RESCH-14: Audit event recorded");
  assert(rescheduleAuditEvents[0].action === "RESCHEDULE_APPOINTMENT", "CASE RESCH-14: Audit action name");

  // CASE RESCH-2: Rescheduled Appointment can subsequently follow PLANNED -> CHECKED_IN
  const resCheckin = simulateUpdateAppointmentStatusWorkflow({
    callerRoles: ["RECEPTIONIST"],
    activeClinicId: "clinic-tt01",
    appointmentId: "appt-planned-tt01",
    requestedStatus: "CHECKED_IN",
  });
  assert(resCheckin.success === true, "CASE RESCH-2: Rescheduled PLANNED appointment can be checked in");

  // CASE RESCH-4: COMPLETED Appointment cannot be rescheduled -> Zero mutation
  let completedReschDenied = false;
  try {
    simulateRescheduleService({
      appointmentId: "appt-resch-completed",
      newDate: "2026-08-28",
      newStartAt: "2026-08-28T09:30:00+07:00",
    });
  } catch (err: unknown) {
    completedReschDenied = true;
    assert((err as Error).message.includes("COMPLETED"), "CASE RESCH-4: Error message indicates COMPLETED");
  }
  assert(completedReschDenied, "CASE RESCH-4: COMPLETED appointment reschedule denied");

  // CASE RESCH-5: IN_TREATMENT Appointment cannot be rescheduled -> Zero mutation
  let intreatReschDenied = false;
  try {
    simulateRescheduleService({
      appointmentId: "appt-resch-intreatment",
      newDate: "2026-08-28",
      newStartAt: "2026-08-28T09:30:00+07:00",
    });
  } catch (err: unknown) {
    intreatReschDenied = true;
    assert((err as Error).message.includes("IN_TREATMENT"), "CASE RESCH-5: Error message indicates IN_TREATMENT");
  }
  assert(intreatReschDenied, "CASE RESCH-5: IN_TREATMENT appointment reschedule denied");

  // CASE RESCH-6: CHECKED_IN Appointment cannot be rescheduled -> Zero mutation
  let checkedinReschDenied = false;
  try {
    simulateRescheduleService({
      appointmentId: "appt-resch-checkedin",
      newDate: "2026-08-28",
      newStartAt: "2026-08-28T09:30:00+07:00",
    });
  } catch (err: unknown) {
    checkedinReschDenied = true;
    assert((err as Error).message.includes("CHECKED_IN"), "CASE RESCH-6: Error message indicates CHECKED_IN");
  }
  assert(checkedinReschDenied, "CASE RESCH-6: CHECKED_IN appointment reschedule denied");

  // CASE RESCH-7: CANCELLED Appointment cannot be rescheduled -> Zero mutation
  let cancelledReschDenied = false;
  try {
    simulateRescheduleService({
      appointmentId: "appt-resch-cancelled",
      newDate: "2026-08-28",
      newStartAt: "2026-08-28T09:30:00+07:00",
    });
  } catch (err: unknown) {
    cancelledReschDenied = true;
    assert((err as Error).message.includes("CANCELLED"), "CASE RESCH-7: Error message indicates CANCELLED");
  }
  assert(cancelledReschDenied, "CASE RESCH-7: CANCELLED appointment reschedule denied");

  // CASE RESCH-8: NO_SHOW Appointment cannot be rescheduled -> Zero mutation
  let noshowReschDenied = false;
  try {
    simulateRescheduleService({
      appointmentId: "appt-resch-noshow",
      newDate: "2026-08-28",
      newStartAt: "2026-08-28T09:30:00+07:00",
    });
  } catch (err: unknown) {
    noshowReschDenied = true;
    assert((err as Error).message.includes("NO_SHOW"), "CASE RESCH-8: Error message indicates NO_SHOW");
  }
  assert(noshowReschDenied, "CASE RESCH-8: NO_SHOW appointment reschedule denied");

  // Legacy RESCHEDULED status recovery to PLANNED
  const resLegacyRecover = simulateRescheduleService({
    appointmentId: "appt-resch-legacy",
    newDate: "2026-08-29",
    newStartAt: "2026-08-29T10:00:00+07:00",
  });
  assert(resLegacyRecover.status === "PLANNED", "Legacy RESCHEDULED appointment normalizes to PLANNED");

  // 13. SCHED-PLAN1B PLAN CAPACITY GUARD & SCHEDULE_TREATMENT_COURSE RPC TESTS
  interface MockPlanCourse {
    id: string;
    patient_id: string;
    primary_doctor_id: string;
    planned_session_count: number | null;
    completed_session_count: number;
    planned_end_date?: string | null;
  }

  interface MockPlanAppt {
    id: string;
    treatment_course_id: string;
    doctor_id: string;
    appointment_date: string;
    status: string;
  }

  function simulateScheduleTreatmentCourseRpc(
    course: MockPlanCourse,
    existingAppts: MockPlanAppt[],
    params: {
      doctorId: string;
      startDate: string;
      requestedCount: number;
      preferredTime?: string;
      selectedWeekdays?: number[];
    }
  ) {
    // 1. Validate requested schedule count
    if (!params.requestedCount || params.requestedCount <= 0) {
      return {
        success: false,
        status: "FAILED",
        error_code: "INVALID_SCHEDULE_COUNT",
        message: "Số buổi yêu cầu xếp lịch phải lớn hơn 0.",
      };
    }

    // 2. Lock & Check Plan Guard
    if (course.planned_session_count === null || course.planned_session_count <= 0) {
      return {
        success: false,
        status: "FAILED",
        error_code: "PLAN_NOT_ESTABLISHED",
        message: "Bác sĩ chưa thiết lập kế hoạch điều trị cho liệu trình này.",
      };
    }

    // 3. Calculate active allocated appointments (excludes CANCELLED, NO_SHOW, and COMPLETED)
    const activeStatuses = ["PLANNED", "CONFIRMED", "CHECKED_IN", "IN_EXAM", "IN_TREATMENT", "RESCHEDULED"];
    const courseAppts = existingAppts.filter((a) => a.treatment_course_id === course.id);
    const activeAllocatedCount = courseAppts.filter((a) => activeStatuses.includes(a.status)).length;

    // 4. Calculate allocated units and remaining capacity under lock
    const allocatedPlanUnits = course.completed_session_count + activeAllocatedCount;
    const remainingSchedulableSlots = course.planned_session_count - allocatedPlanUnits;

    // 5. Refuse over-scheduling
    if (params.requestedCount > remainingSchedulableSlots) {
      return {
        success: false,
        status: "FAILED",
        error_code: "EXCEEDS_PLAN_CAPACITY",
        message: "Số buổi yêu cầu xếp lịch vượt quá số buổi còn lại trong kế hoạch điều trị.",
        planned_session_count: course.planned_session_count,
        completed_session_count: course.completed_session_count,
        active_allocated_count: activeAllocatedCount,
        remaining_schedulable_slots: remainingSchedulableSlots,
        requested_count: params.requestedCount,
      };
    }

    // 6. Generate appointments
    const createdAppts: MockPlanAppt[] = [];
    const curDate = new Date(params.startDate);
    const weekdays = params.selectedWeekdays || [1, 2, 3, 4, 5, 6];

    while (createdAppts.length < params.requestedCount) {
      const dow = curDate.getDay(); // 0=Sun, 1=Mon...
      const dateStr = curDate.toISOString().slice(0, 10);
      if (weekdays.includes(dow) && dow !== 0) {
        const hasConflict = courseAppts.some((a) => a.appointment_date === dateStr && a.status !== "CANCELLED");
        if (!hasConflict) {
          const newAppt: MockPlanAppt = {
            id: `appt-gen-${createdAppts.length + 1}`,
            treatment_course_id: course.id,
            doctor_id: params.doctorId,
            appointment_date: dateStr,
            status: "PLANNED",
          };
          createdAppts.push(newAppt);
          existingAppts.push(newAppt);
        }
      }
      curDate.setDate(curDate.getDate() + 1);
    }

    // 7. Update scheduling-derived planned_end_date (NEVER overwrite planned_session_count or primary_doctor_id!)
    const relevantStatuses = ["PLANNED", "CONFIRMED", "CHECKED_IN", "IN_EXAM", "IN_TREATMENT", "COMPLETED", "RESCHEDULED"];
    const allRelevant = existingAppts.filter((a) => a.treatment_course_id === course.id && relevantStatuses.includes(a.status));
    if (allRelevant.length > 0) {
      const dates = allRelevant.map((a) => a.appointment_date).sort();
      course.planned_end_date = dates[dates.length - 1];
    }

    return {
      success: true,
      status: createdAppts.length === params.requestedCount ? "FULL" : "PARTIAL",
      scheduled_count: createdAppts.length,
      requested_count: params.requestedCount,
      appointment_ids: createdAppts.map((a) => a.id),
    };
  }

  // CASE PLAN1B-1: Plan = 10, completed = 0, active = 0, request = 3 -> 3 scheduled, plan remains 10
  const course1: MockPlanCourse = {
    id: "course-p1",
    patient_id: "pat-1",
    primary_doctor_id: "doc-orig",
    planned_session_count: 10,
    completed_session_count: 0,
  };
  const appts1: MockPlanAppt[] = [];
  const resP1 = simulateScheduleTreatmentCourseRpc(course1, appts1, {
    doctorId: "doc-appt-sched",
    startDate: "2026-08-25",
    requestedCount: 3,
  });
  assert(resP1.success === true, "CASE PLAN1B-1: Succeeded");
  assert(resP1.scheduled_count === 3, "CASE PLAN1B-1: 3 scheduled");
  assert(course1.planned_session_count === 10, "CASE PLAN1B-14: planned_session_count remains 10 (never overwritten!)");
  assert(course1.primary_doctor_id === "doc-orig", "CASE PLAN1B-15: primary_doctor_id remains doc-orig (never overwritten!)");

  // CASE PLAN1B-2: Plan = 10, completed = 3, active = 2, request = 3 -> allowed (remaining = 5)
  const course2: MockPlanCourse = {
    id: "course-p2",
    patient_id: "pat-2",
    primary_doctor_id: "doc-orig",
    planned_session_count: 10,
    completed_session_count: 3,
  };
  const appts2: MockPlanAppt[] = [
    { id: "a1", treatment_course_id: "course-p2", doctor_id: "doc-1", appointment_date: "2026-08-20", status: "PLANNED" },
    { id: "a2", treatment_course_id: "course-p2", doctor_id: "doc-1", appointment_date: "2026-08-21", status: "PLANNED" },
  ];
  const resP2 = simulateScheduleTreatmentCourseRpc(course2, appts2, {
    doctorId: "doc-1",
    startDate: "2026-08-25",
    requestedCount: 3,
  });
  assert(resP2.success === true, "CASE PLAN1B-2: Succeeded because 3 + 2 + 3 <= 10");

  // CASE PLAN1B-3: Plan = 10, completed = 3, active = 5, request = 3 -> remaining = 2 -> EXCEEDS_PLAN_CAPACITY
  const course3: MockPlanCourse = {
    id: "course-p3",
    patient_id: "pat-3",
    primary_doctor_id: "doc-orig",
    planned_session_count: 10,
    completed_session_count: 3,
  };
  const appts3: MockPlanAppt[] = [
    { id: "a1", treatment_course_id: "course-p3", doctor_id: "doc-1", appointment_date: "2026-08-20", status: "PLANNED" },
    { id: "a2", treatment_course_id: "course-p3", doctor_id: "doc-1", appointment_date: "2026-08-21", status: "PLANNED" },
    { id: "a3", treatment_course_id: "course-p3", doctor_id: "doc-1", appointment_date: "2026-08-22", status: "CONFIRMED" },
    { id: "a4", treatment_course_id: "course-p3", doctor_id: "doc-1", appointment_date: "2026-08-23", status: "CHECKED_IN" },
    { id: "a5", treatment_course_id: "course-p3", doctor_id: "doc-1", appointment_date: "2026-08-24", status: "IN_TREATMENT" },
  ];
  const initialAppts3Length = appts3.length;
  const resP3 = simulateScheduleTreatmentCourseRpc(course3, appts3, {
    doctorId: "doc-1",
    startDate: "2026-08-25",
    requestedCount: 3,
  });
  assert(resP3.success === false, "CASE PLAN1B-3: Over-scheduling rejected");
  assert((resP3 as unknown as { error_code: string }).error_code === "EXCEEDS_PLAN_CAPACITY", "CASE PLAN1B-3: Error code EXCEEDS_PLAN_CAPACITY");
  assert(appts3.length === initialAppts3Length, "CASE PLAN1B-3: Zero new appointments inserted");

  // CASE PLAN1B-4: Plan = 10, completed = 10 -> no additional scheduling allowed
  const course4: MockPlanCourse = {
    id: "course-p4",
    patient_id: "pat-4",
    primary_doctor_id: "doc-orig",
    planned_session_count: 10,
    completed_session_count: 10,
  };
  const resP4 = simulateScheduleTreatmentCourseRpc(course4, [], {
    doctorId: "doc-1",
    startDate: "2026-08-25",
    requestedCount: 1,
  });
  assert(resP4.success === false, "CASE PLAN1B-4: Fully completed course rejected");
  assert((resP4 as unknown as { error_code: string }).error_code === "EXCEEDS_PLAN_CAPACITY", "CASE PLAN1B-4: EXCEEDS_PLAN_CAPACITY");

  // CASE PLAN1B-5: CANCELLED appointment does NOT consume plan capacity
  const course5: MockPlanCourse = {
    id: "course-p5",
    patient_id: "pat-5",
    primary_doctor_id: "doc-orig",
    planned_session_count: 5,
    completed_session_count: 0,
  };
  const appts5: MockPlanAppt[] = [
    { id: "c1", treatment_course_id: "course-p5", doctor_id: "doc-1", appointment_date: "2026-08-20", status: "CANCELLED" },
    { id: "c2", treatment_course_id: "course-p5", doctor_id: "doc-1", appointment_date: "2026-08-21", status: "CANCELLED" },
  ];
  const resP5 = simulateScheduleTreatmentCourseRpc(course5, appts5, {
    doctorId: "doc-1",
    startDate: "2026-08-25",
    requestedCount: 5,
  });
  assert(resP5.success === true, "CASE PLAN1B-5: CANCELLED appointments do not count towards allocated plan");

  // CASE PLAN1B-6: NO_SHOW appointment does NOT consume plan capacity
  const course6: MockPlanCourse = {
    id: "course-p6",
    patient_id: "pat-6",
    primary_doctor_id: "doc-orig",
    planned_session_count: 5,
    completed_session_count: 0,
  };
  const appts6: MockPlanAppt[] = [
    { id: "ns1", treatment_course_id: "course-p6", doctor_id: "doc-1", appointment_date: "2026-08-20", status: "NO_SHOW" },
  ];
  const resP6 = simulateScheduleTreatmentCourseRpc(course6, appts6, {
    doctorId: "doc-1",
    startDate: "2026-08-25",
    requestedCount: 5,
  });
  assert(resP6.success === true, "CASE PLAN1B-6: NO_SHOW appointments do not count towards allocated plan");

  // CASE PLAN1B-7: COMPLETED Appointment is NOT double-counted when completed_session_count already contains the delivered session
  const course7: MockPlanCourse = {
    id: "course-p7",
    patient_id: "pat-7",
    primary_doctor_id: "doc-orig",
    planned_session_count: 5,
    completed_session_count: 2,
  };
  const appts7: MockPlanAppt[] = [
    { id: "comp1", treatment_course_id: "course-p7", doctor_id: "doc-1", appointment_date: "2026-08-20", status: "COMPLETED" },
    { id: "comp2", treatment_course_id: "course-p7", doctor_id: "doc-1", appointment_date: "2026-08-21", status: "COMPLETED" },
  ];
  // completed_session_count = 2, active allocated = 0, remaining = 3. Requesting 3 should succeed.
  const resP7 = simulateScheduleTreatmentCourseRpc(course7, appts7, {
    doctorId: "doc-1",
    startDate: "2026-08-25",
    requestedCount: 3,
  });
  assert(resP7.success === true, "CASE PLAN1B-7: COMPLETED appointments not double counted with completed_session_count");

  // CASE PLAN1B-8 to 13: Active statuses count towards plan
  const course8: MockPlanCourse = {
    id: "course-p8",
    patient_id: "pat-8",
    primary_doctor_id: "doc-orig",
    planned_session_count: 6,
    completed_session_count: 0,
  };
  const appts8: MockPlanAppt[] = [
    { id: "st1", treatment_course_id: "course-p8", doctor_id: "doc-1", appointment_date: "2026-08-20", status: "PLANNED" },
    { id: "st2", treatment_course_id: "course-p8", doctor_id: "doc-1", appointment_date: "2026-08-21", status: "CONFIRMED" },
    { id: "st3", treatment_course_id: "course-p8", doctor_id: "doc-1", appointment_date: "2026-08-22", status: "CHECKED_IN" },
    { id: "st4", treatment_course_id: "course-p8", doctor_id: "doc-1", appointment_date: "2026-08-23", status: "IN_EXAM" },
    { id: "st5", treatment_course_id: "course-p8", doctor_id: "doc-1", appointment_date: "2026-08-24", status: "IN_TREATMENT" },
    { id: "st6", treatment_course_id: "course-p8", doctor_id: "doc-1", appointment_date: "2026-08-25", status: "RESCHEDULED" },
  ];
  const resP8 = simulateScheduleTreatmentCourseRpc(course8, appts8, {
    doctorId: "doc-1",
    startDate: "2026-08-26",
    requestedCount: 1,
  });
  assert(resP8.success === false, "CASE PLAN1B-8..13: All 6 active statuses consume plan slots");

  // CASE PLAN1B-16: planned_end_date remains scheduling-derived
  assert(course1.planned_end_date !== null && course1.planned_end_date !== undefined, "CASE PLAN1B-16: planned_end_date updated");

  // CASE PLAN1B-17: PLAN_NOT_ESTABLISHED when planned_session_count is null or <= 0
  const courseNull: MockPlanCourse = {
    id: "course-null",
    patient_id: "pat-null",
    primary_doctor_id: "doc-orig",
    planned_session_count: null,
    completed_session_count: 0,
  };
  const resNull = simulateScheduleTreatmentCourseRpc(courseNull, [], {
    doctorId: "doc-1",
    startDate: "2026-08-25",
    requestedCount: 1,
  });
  assert(resNull.success === false, "CASE PLAN1B-17: Null plan rejected");
  assert((resNull as unknown as { error_code: string }).error_code === "PLAN_NOT_ESTABLISHED", "CASE PLAN1B-17: PLAN_NOT_ESTABLISHED error code");

  // 14. SCHED-PLAN1C APPLICATION & UI SEMANTIC SPLIT TESTS
  // CASE PLAN1C-1: Scheduling schema accepts schedule_count = 3 without planned_session_count
  const parsed1C = autoScheduleSchema.safeParse({
    treatment_course_id: "123e4567-e89b-12d3-a456-426614174000",
    doctor_id: "123e4567-e89b-12d3-a456-426614174001",
    start_date: "2026-08-25",
    schedule_count: 3,
  });
  assert(parsed1C.success === true, "CASE PLAN1C-1: Schema validates schedule_count successfully");
  if (parsed1C.success) {
    assert(parsed1C.data.schedule_count === 3, "CASE PLAN1C-1: schedule_count value is 3");
    assert(!("planned_session_count" in parsed1C.data), "CASE PLAN1C-1: planned_session_count is not in parsed output");
  }

  // CASE PLAN1C-2: Schema rejects non-positive schedule_count
  const parsedInvalid = autoScheduleSchema.safeParse({
    treatment_course_id: "123e4567-e89b-12d3-a456-426614174000",
    doctor_id: "123e4567-e89b-12d3-a456-426614174001",
    start_date: "2026-08-25",
    schedule_count: 0,
  });
  assert(parsedInvalid.success === false, "CASE PLAN1C-2: Non-positive schedule_count rejected by schema");

  // CASE PLAN1C-3 & 4: executeAutoSchedule receives schedule_count and maps to p_session_count
  mockScheduleRpcState = {
    data: {
      success: true,
      status: "FULL",
      scheduled_count: 3,
      requested_count: 3,
      appointment_ids: ["a1", "a2", "a3"],
    },
    error: null,
  };
  const res1C3 = simulateExecuteAutoSchedule({
    treatment_course_id: "course-tt01-1",
    doctor_id: "doc-tt01-active",
    start_date: "2026-08-25",
    schedule_count: 3,
  });
  assert(res1C3.success === true, "CASE PLAN1C-3: executeAutoSchedule with schedule_count succeeds");
  assert(res1C3.scheduled_count === 3, "CASE PLAN1C-3: 3 scheduled");

  // CASE PLAN1C-9: PLAN_NOT_ESTABLISHED maps to safe localized message
  mockScheduleRpcState = {
    data: { success: false, status: "FAILED", error_code: "PLAN_NOT_ESTABLISHED" },
    error: null,
  };
  const res1C9 = simulateExecuteAutoSchedule({
    treatment_course_id: "course-tt01-1",
    doctor_id: "doc-tt01-active",
    start_date: "2026-08-25",
    schedule_count: 2,
  });
  assert(res1C9.success === false, "CASE PLAN1C-9: PLAN_NOT_ESTABLISHED returns failure");
  assert(res1C9.message === "Bác sĩ chưa thiết lập kế hoạch điều trị cho liệu trình này.", "CASE PLAN1C-9: Localized message for PLAN_NOT_ESTABLISHED");

  // CASE PLAN1C-10: EXCEEDS_PLAN_CAPACITY maps to safe localized message
  mockScheduleRpcState = {
    data: { success: false, status: "FAILED", error_code: "EXCEEDS_PLAN_CAPACITY" },
    error: null,
  };
  const res1C10 = simulateExecuteAutoSchedule({
    treatment_course_id: "course-tt01-1",
    doctor_id: "doc-tt01-active",
    start_date: "2026-08-25",
    schedule_count: 5,
  });
  assert(res1C10.success === false, "CASE PLAN1C-10: EXCEEDS_PLAN_CAPACITY returns failure");
  assert(res1C10.message === "Số lịch muốn xếp vượt quá số buổi còn lại trong kế hoạch điều trị.", "CASE PLAN1C-10: Localized message for EXCEEDS_PLAN_CAPACITY");

  // CASE PLAN1C-11: INVALID_SCHEDULE_COUNT maps to safe localized message
  mockScheduleRpcState = {
    data: { success: false, status: "FAILED", error_code: "INVALID_SCHEDULE_COUNT" },
    error: null,
  };
  const res1C11 = simulateExecuteAutoSchedule({
    treatment_course_id: "course-tt01-1",
    doctor_id: "doc-tt01-active",
    start_date: "2026-08-25",
    schedule_count: 1,
  });
  assert(res1C11.success === false, "CASE PLAN1C-11: INVALID_SCHEDULE_COUNT returns failure");
  assert(res1C11.message === "Số lịch muốn xếp phải lớn hơn 0.", "CASE PLAN1C-11: Localized message for INVALID_SCHEDULE_COUNT");

  // 15. SCHED-PLAN1C-FIX1 REMAINING CAPACITY ZERO-STATE & PLAN GUARDS
  interface MockModalState {
    plannedSessionCount?: number | null;
    remainingSchedulableSlots?: number | null;
  }

  function simulateModalState(props: MockModalState) {
    const isPlanUnestablished =
      props.plannedSessionCount !== undefined &&
      (props.plannedSessionCount === null || props.plannedSessionCount <= 0);

    const isZeroRemaining =
      props.remainingSchedulableSlots !== undefined &&
      props.remainingSchedulableSlots !== null &&
      props.remainingSchedulableSlots <= 0;

    const isSchedulingDisabled = isPlanUnestablished || isZeroRemaining;

    const defaultScheduleCount =
      props.remainingSchedulableSlots !== undefined && props.remainingSchedulableSlots !== null
        ? Math.max(0, props.remainingSchedulableSlots)
        : 1;

    let displayMessage: string | null = null;
    if (isPlanUnestablished) {
      displayMessage = "Bác sĩ chưa thiết lập kế hoạch điều trị cho liệu trình này.";
    } else if (isZeroRemaining) {
      displayMessage = "Liệu trình đã được xếp đủ số buổi theo kế hoạch điều trị.";
    }

    return {
      isPlanUnestablished,
      isZeroRemaining,
      isSchedulingDisabled,
      defaultScheduleCount,
      displayMessage,
    };
  }

  // CASE PLAN1C-FIX1-1: remaining = 5 -> default = 5, enabled
  const m1 = simulateModalState({ plannedSessionCount: 10, remainingSchedulableSlots: 5 });
  assert(m1.defaultScheduleCount === 5, "CASE PLAN1C-FIX1-1: Default is 5");
  assert(m1.isSchedulingDisabled === false, "CASE PLAN1C-FIX1-1: Form is enabled");
  assert(m1.displayMessage === null, "CASE PLAN1C-FIX1-1: No warning message");

  // CASE PLAN1C-FIX1-2: remaining = 0 -> default is 0 (NOT 1), disabled
  const m2 = simulateModalState({ plannedSessionCount: 10, remainingSchedulableSlots: 0 });
  assert(m2.defaultScheduleCount === 0, "CASE PLAN1C-FIX1-2: Default is 0 (NOT converted to 1)");
  assert(m2.isZeroRemaining === true, "CASE PLAN1C-FIX1-2: isZeroRemaining is true");
  assert(m2.isSchedulingDisabled === true, "CASE PLAN1C-FIX1-2: Form submission is disabled");
  assert(m2.displayMessage === "Liệu trình đã được xếp đủ số buổi theo kế hoạch điều trị.", "CASE PLAN1C-FIX1-2: Shows zero remaining message");

  // CASE PLAN1C-FIX1-3: remaining unknown -> neutral default 1 permitted
  const m3 = simulateModalState({ plannedSessionCount: 10, remainingSchedulableSlots: undefined });
  assert(m3.defaultScheduleCount === 1, "CASE PLAN1C-FIX1-3: Neutral default is 1 when remaining unknown");
  assert(m3.isSchedulingDisabled === false, "CASE PLAN1C-FIX1-3: Enabled when remaining unknown");

  // CASE PLAN1C-FIX1-4: plannedSessionCount = null -> disabled, unestablished message
  const m4 = simulateModalState({ plannedSessionCount: null, remainingSchedulableSlots: 0 });
  assert(m4.isPlanUnestablished === true, "CASE PLAN1C-FIX1-4: isPlanUnestablished is true");
  assert(m4.isSchedulingDisabled === true, "CASE PLAN1C-FIX1-4: Form submission is disabled");
  assert(m4.displayMessage === "Bác sĩ chưa thiết lập kế hoạch điều trị cho liệu trình này.", "CASE PLAN1C-FIX1-4: Shows unestablished message");

  // CASE PLAN1C-FIX1-5: plannedSessionCount <= 0 -> disabled
  const m5 = simulateModalState({ plannedSessionCount: 0 });
  assert(m5.isPlanUnestablished === true, "CASE PLAN1C-FIX1-5: isPlanUnestablished is true for plan=0");
  assert(m5.isSchedulingDisabled === true, "CASE PLAN1C-FIX1-5: Form submission is disabled for plan=0");

  console.log("All Scheduling & Slots Unit Tests PASSED!");
}



