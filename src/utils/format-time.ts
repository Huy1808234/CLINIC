import { DEFAULT_CLINIC_TIMEZONE } from "./timezone";

/**
 * Time Utilities & Excel Time Fraction Parser
 * In Excel, time is often stored as a fraction of a day (e.g. 0.315277 -> 07:34).
 */

export function parseTimeToHHMM(input: string | number | null | undefined): string | null {
  if (input === null || input === undefined) return null;

  // 1. If numeric fraction of a day (0.0 to 1.0)
  if (typeof input === "number" || (!isNaN(Number(input)) && !String(input).includes(":"))) {
    const num = Number(input);
    if (num >= 0 && num <= 1) {
      const totalMinutes = Math.round(num * 24 * 60);
      const hours = Math.floor(totalMinutes / 60) % 24;
      const minutes = totalMinutes % 60;
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }

  const str = String(input).trim();
  if (!str) return null;

  // 2. Format HH:mm or HH:mm:ss
  const colonMatch = str.match(/^(\d{1,2}):(\d{2})/);
  if (colonMatch) {
    const hours = parseInt(colonMatch[1], 10);
    const minutes = parseInt(colonMatch[2], 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }

  // 3. Format 7h30, 07h30
  const hMatch = str.match(/^(\d{1,2})[hH](\d{2})/);
  if (hMatch) {
    const hours = parseInt(hMatch[1], 10);
    const minutes = parseInt(hMatch[2], 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * Formats a TIMESTAMPTZ ISO string or Date object to HH:mm in the specified clinic timezone.
 * Returns "—" for null, undefined, or invalid timestamps.
 */
export function formatTimestampTime(
  input: string | Date | null | undefined,
  timeZone = DEFAULT_CLINIC_TIMEZONE
): string {
  if (input === null || input === undefined || input === "") return "—";

  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timeZone || DEFAULT_CLINIC_TIMEZONE,
  }).format(d);
}

/**
 * Universal time formatter:
 * 1. If input is an ISO timestamp (contains "T" or full ISO date), formats in clinic timezone.
 * 2. If input is a plain time-of-day string ("07:30", "7h30", 0.315 fraction), formats via parseTimeToHHMM.
 */
export function formatTimeVN(
  timeStr: string | number | null | undefined,
  timeZone = DEFAULT_CLINIC_TIMEZONE
): string {
  if (!timeStr) return "—";

  // If string represents an ISO timestamp (contains "T" or is Date-like)
  if (typeof timeStr === "string" && (timeStr.includes("T") || (timeStr.includes("-") && timeStr.length > 10))) {
    return formatTimestampTime(timeStr, timeZone);
  }

  const parsed = parseTimeToHHMM(timeStr);
  return parsed || String(timeStr);
}
