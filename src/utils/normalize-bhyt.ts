/**
 * Vietnamese Health Insurance Card (BHYT) Normalizer
 * Standard BHYT format is 15 characters (e.g. GD4797931234567) or 10-digit social security code.
 * Identifies textual placeholders such as "CHƯA CÓ THÔNG TIN" and converts them cleanly.
 */

export interface NormalizedBhytResult {
  normalized: string | null;
  raw: string;
  isValid: boolean;
  isPlaceholder: boolean;
  subjectCode: string | null;
}

const PLACEHOLDER_PATTERNS = [
  /chua\s*co\s*thong\s*tin/i,
  /chua\s*co\s*the/i,
  /khong\s*co/i,
  /mat\s*the/i,
  /chua\s*cap/i,
  /none/i,
  /null/i,
  /n\/a/i,
  /^-+$/,
];

export function normalizeBhyt(input: string | number | null | undefined): NormalizedBhytResult {
  if (input === null || input === undefined) {
    return { normalized: null, raw: "", isValid: false, isPlaceholder: false, subjectCode: null };
  }

  const raw = String(input).trim();
  if (!raw) {
    return { normalized: null, raw, isValid: false, isPlaceholder: false, subjectCode: null };
  }

  // Check if raw is a placeholder (unaccented check)
  const unaccented = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(unaccented)) {
      return {
        normalized: null,
        raw,
        isValid: false,
        isPlaceholder: true,
        subjectCode: null,
      };
    }
  }

  // Clean characters: uppercase, remove spaces, dots, dashes
  const cleaned = raw.toUpperCase().replace(/[\s.\-_]/g, "");

  // 15-character BHYT pattern: 2 letters (object) + 1 digit (level) + 2 digits (province) + 10 digits
  const standard15Match = /^([A-Z]{2})\d{13}$/.test(cleaned);
  // 10-digit social insurance number
  const code10Match = /^\d{10}$/.test(cleaned);

  if (standard15Match) {
    return {
      normalized: cleaned,
      raw,
      isValid: true,
      isPlaceholder: false,
      subjectCode: cleaned.slice(0, 2),
    };
  }

  if (code10Match) {
    return {
      normalized: cleaned,
      raw,
      isValid: true,
      isPlaceholder: false,
      subjectCode: null,
    };
  }

  // If alphanumeric and between 8 and 20 chars, treat as valid custom/legacy card number
  if (/^[A-Z0-9]{8,20}$/.test(cleaned)) {
    const prefixMatch = cleaned.match(/^([A-Z]{2})/);
    return {
      normalized: cleaned,
      raw,
      isValid: true,
      isPlaceholder: false,
      subjectCode: prefixMatch ? prefixMatch[1] : null,
    };
  }

  return {
    normalized: null,
    raw,
    isValid: false,
    isPlaceholder: false,
    subjectCode: null,
  };
}
