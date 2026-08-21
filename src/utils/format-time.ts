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

export function formatTimeVN(timeStr: string | null | undefined): string {
  if (!timeStr) return "—";
  const parsed = parseTimeToHHMM(timeStr);
  return parsed || timeStr;
}
