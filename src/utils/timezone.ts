/**
 * Timezone and Business Date Utilities for Clinic Operations
 * Ensures all day-boundary calculations and time displays are anchored to the
 * Clinic's canonical IANA timezone (defaulting to Asia/Ho_Chi_Minh).
 */

export const DEFAULT_CLINIC_TIMEZONE = "Asia/Ho_Chi_Minh";

/**
 * Returns today's calendar date (YYYY-MM-DD) in the specified clinic IANA timezone.
 * Completely independent of Node/Vercel server runtime timezone.
 */
export function getClinicTodayDate(timeZone = DEFAULT_CLINIC_TIMEZONE): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || DEFAULT_CLINIC_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

/**
 * Formats an ISO timestamptz string or Date into YYYY-MM-DD in the specified clinic timezone.
 */
export function formatTimestampToClinicDate(
  input: string | Date | null | undefined,
  timeZone = DEFAULT_CLINIC_TIMEZONE
): string {
  if (!input) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "";

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || DEFAULT_CLINIC_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(d);
}

/**
 * Calculates deterministic UTC query boundaries [startUtc, endUtc) for a clinic calendar date (YYYY-MM-DD).
 *
 * For example, for "2026-08-25" in "Asia/Ho_Chi_Minh" (UTC+7):
 * - startUtc: "2026-08-24T17:00:00.000Z"
 * - endUtc:   "2026-08-25T17:00:00.000Z"
 */
export function getUtcBoundsForClinicDate(
  dateStr: string,
  timeZone = DEFAULT_CLINIC_TIMEZONE
): { startUtc: string; endUtc: string } {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD.`);
  }

  const [, y, m, d] = match;
  const year = parseInt(y, 10);
  const month = parseInt(m, 10);
  const day = parseInt(d, 10);

  const startUtc = getUtcInstantForLocal(year, month, day, 0, 0, 0, timeZone);

  // Next calendar day in clinic timezone
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
  const endUtc = getUtcInstantForLocal(
    nextDate.getUTCFullYear(),
    nextDate.getUTCMonth() + 1,
    nextDate.getUTCDate(),
    0,
    0,
    0,
    timeZone
  );

  return {
    startUtc: startUtc.toISOString(),
    endUtc: endUtc.toISOString(),
  };
}

/**
 * Converts a clinic-local date (YYYY-MM-DD) and wall-clock time (HH:mm or HH:mm:ss)
 * into a canonical UTC ISO instant (TIMESTAMPTZ).
 *
 * Example:
 * convertClinicTimeToUtcInstant("2026-08-25", "09:30", "Asia/Ho_Chi_Minh")
 * -> "2026-08-25T02:30:00.000Z"
 */
export function convertClinicTimeToUtcInstant(
  dateStr: string,
  timeStr: string,
  timeZone = DEFAULT_CLINIC_TIMEZONE
): string {
  const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD.`);
  }
  const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!timeMatch) {
    throw new Error(`Invalid time format: ${timeStr}. Expected HH:mm or HH:mm:ss.`);
  }

  const [, y, m, d] = dateMatch;
  const year = parseInt(y, 10);
  const month = parseInt(m, 10);
  const day = parseInt(d, 10);

  const hours = parseInt(timeMatch[1], 10);
  const minutes = parseInt(timeMatch[2], 10);
  const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;

  const utcInstant = getUtcInstantForLocal(year, month, day, hours, minutes, seconds, timeZone);
  return utcInstant.toISOString();
}

/**
 * Resolves the exact UTC Date object corresponding to local year, month, day, hour, minute, second
 * in the specified IANA timezone.
 */
function getUtcInstantForLocal(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  const naiveUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || DEFAULT_CLINIC_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(naiveUtc);
  const p: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      p[part.type] = parseInt(part.value, 10);
    }
  }

  const localHour = p.hour === 24 ? 0 : p.hour;
  const localAsUtc = Date.UTC(p.year, p.month - 1, p.day, localHour, p.minute, p.second);
  const offsetMs = localAsUtc - naiveUtc.getTime();

  return new Date(naiveUtc.getTime() - offsetMs);
}
