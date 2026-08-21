/**
 * Vietnamese Phone Number Normalizer
 * Handles Excel numeric export truncation (e.g. 912345678 -> 0912345678),
 * spaces, dots, dashes, and international prefix (+84 / 84).
 */

export interface NormalizedPhoneResult {
  normalized: string | null;
  raw: string;
  isValid: boolean;
  confidence: number; // 0 to 1
  isModified: boolean;
}

export function normalizePhone(input: string | number | null | undefined): NormalizedPhoneResult {
  if (input === null || input === undefined) {
    return { normalized: null, raw: "", isValid: false, confidence: 0, isModified: false };
  }

  const raw = String(input).trim();
  if (!raw) {
    return { normalized: null, raw, isValid: false, confidence: 0, isModified: false };
  }

  // Remove common punctuation: space, dot, dash, parentheses, plus
  let cleaned = raw.replace(/[\s.\-()]/g, "");

  // Handle +84 or 84 prefix
  if (cleaned.startsWith("+84")) {
    cleaned = "0" + cleaned.slice(3);
  } else if (cleaned.startsWith("84") && cleaned.length === 11) {
    cleaned = "0" + cleaned.slice(2);
  }

  // Handle stripped leading zero from Excel numeric exports (9 digits -> add leading 0)
  let confidence = 1.0;
  let isModified = false;

  if (/^\d{9}$/.test(cleaned)) {
    cleaned = "0" + cleaned;
    confidence = 0.85; // Flagged for review
    isModified = true;
  }

  // Standard Vietnamese phone regex: 10 digits starting with 03, 05, 07, 08, 09
  const isValid = /^0(3|5|7|8|9)\d{8}$/.test(cleaned);

  if (!isValid && /^\d{10,11}$/.test(cleaned)) {
    // Other 10-11 digit landlines or special numbers
    return {
      normalized: cleaned,
      raw,
      isValid: true,
      confidence: 0.75,
      isModified: isModified || cleaned !== raw,
    };
  }

  if (!isValid) {
    return {
      normalized: null,
      raw,
      isValid: false,
      confidence: 0,
      isModified: false,
    };
  }

  return {
    normalized: cleaned,
    raw,
    isValid: true,
    confidence,
    isModified: isModified || cleaned !== raw,
  };
}
