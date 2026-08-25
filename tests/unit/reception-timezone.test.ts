import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  getClinicTodayDate,
  getUtcBoundsForClinicDate,
  formatTimestampToClinicDate,
  DEFAULT_CLINIC_TIMEZONE,
} from "@/utils/timezone";
import { formatTimestampTime, formatTimeVN, parseTimeToHHMM } from "@/utils/format-time";

export async function runReceptionTimezoneTests() {
  console.log("Running Reception Timezone & Day Boundaries Unit Tests...");

  // Default timezone constant verification
  assert.equal(DEFAULT_CLINIC_TIMEZONE, "Asia/Ho_Chi_Minh", "DEFAULT_CLINIC_TIMEZONE must be Asia/Ho_Chi_Minh");

  // TIME-RX-5: getClinicTodayDate returns YYYY-MM-DD
  const todayStr = getClinicTodayDate();
  assert.match(todayStr, /^\d{4}-\d{2}-\d{2}$/, "getClinicTodayDate returns valid YYYY-MM-DD date string");

  // TIME-RX-1 & TIME-RX-2: UTC ISO timestamp renders using clinic timezone, 18:07Z renders 01:07
  const confirmedUtcIso = "2026-08-24T18:07:00.000Z";
  const renderedTime = formatTimestampTime(confirmedUtcIso, "Asia/Ho_Chi_Minh");
  assert.equal(
    renderedTime,
    "01:07",
    "2026-08-24T18:07:00.000Z must render as 01:07 in Asia/Ho_Chi_Minh (TIME-RX-1, TIME-RX-2)"
  );

  // Universal formatTimeVN routing ISO timestamp
  assert.equal(
    formatTimeVN(confirmedUtcIso),
    "01:07",
    "formatTimeVN must format ISO timestamp as 01:07 in Asia/Ho_Chi_Minh (TIME-RX-2)"
  );

  // TIME-RX-3: No .split("T")[1].slice(...) remains in ReceptionQueueTable
  const queueTablePath = path.join(
    process.cwd(),
    "src",
    "components",
    "reception",
    "ReceptionQueueTable.tsx"
  );
  const queueTableCode = fs.readFileSync(queueTablePath, "utf-8");
  assert.equal(
    queueTableCode.includes('split("T")[1]'),
    false,
    "No naive UTC split('T')[1] string slicing remains in ReceptionQueueTable (TIME-RX-3)"
  );
  assert.equal(
    queueTableCode.includes("formatTimestampTime"),
    true,
    "ReceptionQueueTable uses formatTimestampTime (TIME-RX-3)"
  );

  // TIME-RX-4: Null, undefined, empty, or invalid timestamp safely renders placeholder "—"
  assert.equal(formatTimestampTime(null), "—", "Null timestamp renders '—' (TIME-RX-4)");
  assert.equal(formatTimestampTime(undefined), "—", "Undefined timestamp renders '—' (TIME-RX-4)");
  assert.equal(formatTimestampTime(""), "—", "Empty timestamp renders '—' (TIME-RX-4)");
  assert.equal(formatTimestampTime("invalid-date"), "—", "Invalid timestamp renders '—' (TIME-RX-4)");

  // Day Crossover & Boundary Tests for Asia/Ho_Chi_Minh (UTC+7)
  // 2026-08-25 in Asia/Ho_Chi_Minh has exact bounds: [2026-08-24T17:00:00.000Z, 2026-08-25T17:00:00.000Z)
  const bounds25 = getUtcBoundsForClinicDate("2026-08-25", "Asia/Ho_Chi_Minh");
  assert.equal(bounds25.startUtc, "2026-08-24T17:00:00.000Z", "Start UTC of 2026-08-25 in VN is 2026-08-24T17:00:00.000Z");
  assert.equal(bounds25.endUtc, "2026-08-25T17:00:00.000Z", "End UTC of 2026-08-25 in VN is 2026-08-25T17:00:00.000Z");

  // Confirmed 18:07Z falls inside 2026-08-25 clinic day
  const tConfirmed = new Date(confirmedUtcIso).getTime();
  const tStart25 = new Date(bounds25.startUtc).getTime();
  const tEnd25 = new Date(bounds25.endUtc).getTime();
  assert.equal(
    tConfirmed >= tStart25 && tConfirmed < tEnd25,
    true,
    "Confirmed 18:07Z timestamp strictly belongs to 2026-08-25 reception interval"
  );
  assert.equal(
    formatTimestampToClinicDate(confirmedUtcIso, "Asia/Ho_Chi_Minh"),
    "2026-08-25",
    "Confirmed 18:07Z timestamp formats to clinic date 2026-08-25"
  );

  // Midnight boundary checks:
  // 2026-08-24T16:59:59.999Z -> 24/08 23:59:59 (belongs to 24/08)
  const b1 = new Date("2026-08-24T16:59:59.999Z").getTime();
  assert.equal(b1 < tStart25, true, "2026-08-24T16:59:59.999Z is before 25/08 start");

  // 2026-08-24T17:00:00.000Z -> 25/08 00:00:00 (belongs to 25/08)
  const b2 = new Date("2026-08-24T17:00:00.000Z").getTime();
  assert.equal(b2 >= tStart25 && b2 < tEnd25, true, "2026-08-24T17:00:00.000Z is inside 25/08 interval");

  // 2026-08-25T16:59:59.999Z -> 25/08 23:59:59 (belongs to 25/08)
  const b3 = new Date("2026-08-25T16:59:59.999Z").getTime();
  assert.equal(b3 >= tStart25 && b3 < tEnd25, true, "2026-08-25T16:59:59.999Z is inside 25/08 interval");

  // 2026-08-25T17:00:00.000Z -> 26/08 00:00:00 (belongs to 26/08, NOT 25/08)
  const b4 = new Date("2026-08-25T17:00:00.000Z").getTime();
  assert.equal(b4 >= tEnd25, true, "2026-08-25T17:00:00.000Z is outside 25/08 interval (half-open range)");

  // TIME-RX-5, TIME-RX-6, TIME-RX-7: getTodayReceptions and getReceptionStats use shared helper
  const getReceptionsPath = path.join(process.cwd(), "src", "rsc-data", "reception", "get-receptions.ts");
  const getStatsPath = path.join(process.cwd(), "src", "rsc-data", "reception", "get-reception-stats.ts");
  const receptionsCode = fs.readFileSync(getReceptionsPath, "utf-8");
  const statsCode = fs.readFileSync(getStatsPath, "utf-8");

  assert.equal(
    receptionsCode.includes("getUtcBoundsForClinicDate") && receptionsCode.includes("getClinicTodayDate"),
    true,
    "get-receptions.ts uses getUtcBoundsForClinicDate and getClinicTodayDate (TIME-RX-5)"
  );
  assert.equal(
    statsCode.includes("getUtcBoundsForClinicDate") && statsCode.includes("getClinicTodayDate"),
    true,
    "get-reception-stats.ts uses getUtcBoundsForClinicDate and getClinicTodayDate (TIME-RX-6)"
  );
  assert.equal(
    receptionsCode.includes("setHours(0, 0, 0, 0)"),
    false,
    "get-receptions.ts no longer uses server-local setHours(0, 0, 0, 0) (TIME-RX-8)"
  );
  assert.equal(
    statsCode.includes("setHours(0, 0, 0, 0)"),
    false,
    "get-reception-stats.ts no longer uses server-local setHours(0, 0, 0, 0) (TIME-RX-8)"
  );

  // TIME-RX-10: Date filter in ReceptionClientView matches clinic-local calendar date
  const clientViewPath = path.join(process.cwd(), "src", "components", "reception", "ReceptionClientView.tsx");
  const clientViewCode = fs.readFileSync(clientViewPath, "utf-8");
  assert.equal(
    clientViewCode.includes("formatTimestampToClinicDate"),
    true,
    "ReceptionClientView uses formatTimestampToClinicDate for date filter (TIME-RX-10)"
  );

  // TIME-RX-11 & TIME-RX-12: No manual +7 hardcoded math and no DB mutation
  assert.equal(
    receptionsCode.includes("+ 7 * 3600000") || receptionsCode.includes("+ 7 * 60 * 60"),
    false,
    "No manual +7 hour addition exists in get-receptions.ts (TIME-RX-11)"
  );

  // TIME-RX-15: Plain time strings and Excel fractions backward compatibility
  assert.equal(parseTimeToHHMM("07:30"), "07:30", "parseTimeToHHMM handles '07:30'");
  assert.equal(parseTimeToHHMM("7h30"), "07:30", "parseTimeToHHMM handles '7h30'");
  assert.equal(parseTimeToHHMM(0.3125), "07:30", "parseTimeToHHMM handles 0.3125 fraction");
  assert.equal(formatTimeVN("07:30"), "07:30", "formatTimeVN handles plain time strings (TIME-RX-15)");
  assert.equal(formatTimeVN("08:45:00"), "08:45", "formatTimeVN handles HH:mm:ss");

  console.log("All Reception Timezone & Day Boundaries Unit Tests PASSED!");
}
