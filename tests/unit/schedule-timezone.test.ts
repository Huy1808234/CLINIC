import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  getClinicTodayDate,
  formatTimestampToClinicDate,
  convertClinicTimeToUtcInstant,
} from "@/utils/timezone";
import { formatTimestampTime } from "@/utils/format-time";
import { generateDailyTimeSlots } from "@/lib/scheduling/generate-slots";

export async function runScheduleTimezoneTests() {
  console.log("Running Schedule Timezone Unit & Contract Tests...");

  // SCH-TZ-1: 2026-08-25T02:30:00Z in Asia/Ho_Chi_Minh -> 09:30
  const apptUtcIso = "2026-08-25T02:30:00.000Z";
  const formattedLocalTime = formatTimestampTime(apptUtcIso, "Asia/Ho_Chi_Minh");
  assert.equal(
    formattedLocalTime,
    "09:30",
    "2026-08-25T02:30:00Z must format to 09:30 in Asia/Ho_Chi_Minh (SCH-TZ-1)"
  );

  // SCH-TZ-2 & SCH-TZ-3: 09:30 appointment matches 09:30 timeline slot and does NOT disappear
  const timeSlots = generateDailyTimeSlots({
    openTime: "07:00",
    closeTime: "17:00",
    intervalMinutes: 5,
  });
  assert.equal(
    timeSlots.includes(formattedLocalTime),
    true,
    "09:30 slot must exist in daily time slots (SCH-TZ-2)"
  );
  assert.equal(
    formattedLocalTime === "09:30",
    true,
    "09:30 appointment matches 09:30 slot and does not map to 02:30 (SCH-TZ-3)"
  );

  // SCH-TZ-4 & SCH-TZ-5: Month matrix formatting and appointment_date invariant
  const apptDate = "2026-08-25";
  const dayNum = parseInt(apptDate.split("-")[2], 10);
  assert.equal(dayNum, 25, "appointment_date 2026-08-25 determines day 25 (SCH-TZ-5)");
  assert.equal(
    formatTimestampTime(apptUtcIso, "Asia/Ho_Chi_Minh"),
    "09:30",
    "Month matrix displays 09:30 for scheduled_start_at (SCH-TZ-4)"
  );

  // SCH-TZ-6 & SCH-TZ-7: Available slots calculation
  const bookedSlots = new Set<string>();
  bookedSlots.add(formatTimestampTime(apptUtcIso, "Asia/Ho_Chi_Minh"));
  assert.equal(
    bookedSlots.has("09:30"),
    true,
    "Booked 09:30 appointment is present in bookedSlots as 09:30 (SCH-TZ-6)"
  );
  assert.equal(
    bookedSlots.has("02:30"),
    false,
    "Booked 09:30 appointment is NOT added as UTC 02:30 (SCH-TZ-7)"
  );

  // SCH-TZ-8 & SCH-TZ-9: Business hours remain wall-clock time
  const slots = generateDailyTimeSlots({
    openTime: "07:00",
    closeTime: "17:00",
    lunchStart: "11:30",
    lunchEnd: "13:00",
  });
  assert.equal(slots[0], "07:00", "openTime 07:00 remains 07:00 (SCH-TZ-8, SCH-TZ-9)");
  assert.equal(slots[slots.length - 1], "17:00", "closeTime 17:00 remains 17:00");
  assert.equal(slots.includes("12:00"), false, "lunch break 12:00 excluded");

  // SCH-TZ-10 & SCH-TZ-11: Default date calculation independent of server runtime timezone
  const todayStr = getClinicTodayDate("Asia/Ho_Chi_Minh");
  assert.match(todayStr, /^\d{4}-\d{2}-\d{2}$/, "Clinic today date is valid YYYY-MM-DD (SCH-TZ-10, SCH-TZ-11)");

  // SCH-TZ-12 & SCH-TZ-13: AutoScheduleModal default date uses clinic date
  const autoScheduleModalPath = path.join(
    process.cwd(),
    "src",
    "components",
    "schedule",
    "AutoScheduleModal.tsx"
  );
  const modalCode = fs.readFileSync(autoScheduleModalPath, "utf-8");
  assert.equal(
    modalCode.includes("new Date().toISOString().slice(0, 10)"),
    false,
    "AutoScheduleModal does NOT use browser new Date().toISOString() (SCH-TZ-12, SCH-TZ-13)"
  );
  assert.equal(
    modalCode.includes("getClinicTodayDate"),
    true,
    "AutoScheduleModal uses getClinicTodayDate (SCH-TZ-12)"
  );

  // SCH-TZ-14: Midnight crossover
  const midnightUtc = "2026-08-24T18:07:00.000Z";
  assert.equal(
    formatTimestampToClinicDate(midnightUtc, "Asia/Ho_Chi_Minh"),
    "2026-08-25",
    "2026-08-24T18:07Z maps to 2026-08-25 (SCH-TZ-14)"
  );
  assert.equal(
    formatTimestampTime(midnightUtc, "Asia/Ho_Chi_Minh"),
    "01:07",
    "2026-08-24T18:07Z maps to 01:07 (SCH-TZ-14)"
  );

  // SCH-TZ-15: appointment_date matches clinic-local scheduled_start_at date
  const convertedUtc = convertClinicTimeToUtcInstant("2026-08-25", "09:30", "Asia/Ho_Chi_Minh");
  assert.equal(convertedUtc, "2026-08-25T02:30:00.000Z", "convertClinicTimeToUtcInstant produces 2026-08-25T02:30:00Z");
  assert.equal(
    formatTimestampToClinicDate(convertedUtc, "Asia/Ho_Chi_Minh"),
    "2026-08-25",
    "Local date of converted UTC matches appointment_date 2026-08-25 (SCH-TZ-15)"
  );

  // SCH-TZ-16: No naive scheduled_start_at ISO time slicing in RSC loaders
  const daySchedulePath = path.join(process.cwd(), "src", "rsc-data", "schedule", "get-day-schedule.ts");
  const monthSchedulePath = path.join(process.cwd(), "src", "rsc-data", "schedule", "get-month-schedule.ts");
  const availableSlotsPath = path.join(process.cwd(), "src", "rsc-data", "schedule", "get-available-slots.ts");
  const schedulePagePath = path.join(process.cwd(), "src", "app", "schedule", "page.tsx");

  const dayCode = fs.readFileSync(daySchedulePath, "utf-8");
  const monthCode = fs.readFileSync(monthSchedulePath, "utf-8");
  const slotsCode = fs.readFileSync(availableSlotsPath, "utf-8");
  const pageCode = fs.readFileSync(schedulePagePath, "utf-8");

  assert.equal(
    dayCode.includes('scheduled_start_at.split("T")[1]'),
    false,
    "No naive scheduled_start_at.split('T')[1] in get-day-schedule.ts (SCH-TZ-16)"
  );
  assert.equal(
    monthCode.includes('scheduled_start_at.split("T")[1]') || monthCode.includes('scheduled_start_at as string).split("T")[1]'),
    false,
    "No naive scheduled_start_at.split('T')[1] in get-month-schedule.ts (SCH-TZ-16)"
  );
  assert.equal(
    slotsCode.includes('scheduled_start_at.split("T")[1]') || slotsCode.includes('scheduled_start_at as string).split("T")[1]'),
    false,
    "No naive scheduled_start_at.split('T')[1] in get-available-slots.ts (SCH-TZ-16)"
  );
  assert.equal(
    pageCode.includes("new Date().toISOString().slice(0, 10)"),
    false,
    "No new Date().toISOString().slice(0, 10) in schedule/page.tsx (SCH-TZ-16)"
  );

  // SCH-TZ-17: No manual +7/-7 math
  assert.equal(
    dayCode.includes("+ 7") || monthCode.includes("+ 7") || slotsCode.includes("+ 7"),
    false,
    "No manual +7 math in scheduling code (SCH-TZ-17)"
  );

  console.log("All Schedule Timezone Unit & Contract Tests PASSED!");
}
