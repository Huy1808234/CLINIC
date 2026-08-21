import type { DobPrecision } from "@/types/database";

export interface ParsedDobResult {
  birth_date: string | null; // ISO YYYY-MM-DD
  birth_year: number | null;
  dob_precision: DobPrecision;
  raw: string;
}

/**
 * Parses DOB from various formats: Excel serial numbers, full dates (DD/MM/YYYY, YYYY-MM-DD), or 4-digit years.
 */
export function parseDateOfBirth(input: string | number | null | undefined): ParsedDobResult {
  if (input === null || input === undefined) {
    return { birth_date: null, birth_year: null, dob_precision: "UNKNOWN", raw: "" };
  }

  const raw = String(input).trim();
  if (!raw) {
    return { birth_date: null, birth_year: null, dob_precision: "UNKNOWN", raw };
  }

  // 1. Check if input is a 4-digit year (e.g. "1977", "2005")
  if (/^(19\d{2}|20\d{2})$/.test(raw)) {
    const year = parseInt(raw, 10);
    return {
      birth_date: null,
      birth_year: year,
      dob_precision: "YEAR_ONLY",
      raw,
    };
  }

  // 2. Check if numeric Excel date serial (e.g. 22156, 44560)
  const numericVal = Number(raw);
  if (!isNaN(numericVal) && numericVal > 1000 && numericVal < 60000) {
    const jsDate = excelSerialToDate(numericVal);
    if (jsDate && !isNaN(jsDate.getTime())) {
      const yyyy = jsDate.getFullYear();
      const mm = String(jsDate.getMonth() + 1).padStart(2, "0");
      const dd = String(jsDate.getDate()).padStart(2, "0");
      return {
        birth_date: `${yyyy}-${mm}-${dd}`,
        birth_year: yyyy,
        dob_precision: "DATE",
        raw,
      };
    }
  }

  // 3. Check DD/MM/YYYY format
  const ddmmyyyyMatch = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10);
    const year = parseInt(ddmmyyyyMatch[3], 10);

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const mm = String(month).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      return {
        birth_date: `${year}-${mm}-${dd}`,
        birth_year: year,
        dob_precision: "DATE",
        raw,
      };
    }
  }

  // 4. Check ISO YYYY-MM-DD format
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    return {
      birth_date: raw,
      birth_year: year,
      dob_precision: "DATE",
      raw,
    };
  }

  return {
    birth_date: null,
    birth_year: null,
    dob_precision: "UNKNOWN",
    raw,
  };
}

/**
 * Converts Excel serial date to Javascript Date
 */
export function excelSerialToDate(serial: number): Date {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000);
}

/**
 * Formats an ISO date string (YYYY-MM-DD) or Date to Vietnamese DD/MM/YYYY display
 */
export function formatDateVN(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "—";

  if (typeof dateInput === "string") {
    const parts = dateInput.split("T")[0].split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "—";

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
