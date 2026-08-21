/**
 * Vietnamese Citizen Identity Card (CCCD/CMND) Normalizer
 * Standard CCCD is 12 digits. Legacy CMND is 9 digits.
 * Detects 11-digit numeric values missing leading zero due to Excel numeric truncation.
 */

export interface NormalizedCccdResult {
  normalized: string | null;
  raw: string;
  isValid: boolean;
  type: "CCCD_12" | "CMND_9" | "INVALID";
  confidence: number; // 0 to 1
  isModified: boolean;
}

export function normalizeCccd(input: string | number | null | undefined): NormalizedCccdResult {
  if (input === null || input === undefined) {
    return { normalized: null, raw: "", isValid: false, type: "INVALID", confidence: 0, isModified: false };
  }

  const raw = String(input).trim();
  if (!raw) {
    return { normalized: null, raw, isValid: false, type: "INVALID", confidence: 0, isModified: false };
  }

  // Remove non-digit characters
  let cleaned = raw.replace(/\D/g, "");
  let isModified = false;
  let confidence = 1.0;

  // 11 digits: missing leading zero from Excel numeric export
  if (cleaned.length === 11) {
    cleaned = "0" + cleaned;
    confidence = 0.9;
    isModified = true;
  }

  if (/^\d{12}$/.test(cleaned)) {
    return {
      normalized: cleaned,
      raw,
      isValid: true,
      type: "CCCD_12",
      confidence,
      isModified: isModified || cleaned !== raw,
    };
  }

  if (/^\d{9}$/.test(cleaned)) {
    return {
      normalized: cleaned,
      raw,
      isValid: true,
      type: "CMND_9",
      confidence: 0.95,
      isModified: isModified || cleaned !== raw,
    };
  }

  return {
    normalized: null,
    raw,
    isValid: false,
    type: "INVALID",
    confidence: 0,
    isModified: false,
  };
}
