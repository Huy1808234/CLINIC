import { normalizePhone } from "@/utils/normalize-phone";
import { normalizeCccd } from "@/utils/normalize-cccd";
import { normalizeBhyt } from "@/utils/normalize-bhyt";
import { formatPersonName } from "@/utils/format-person-name";
import { parseDateOfBirth } from "@/utils/format-date";

export interface NormalizedPatientPayload {
  full_name: string;
  normalized_name: string;
  phone: string | null;
  raw_phone: string;
  citizen_id: string | null;
  raw_citizen_id: string;
  card_number: string | null;
  raw_card_number: string;
  birth_date: string | null;
  birth_year: number | null;
  dob_precision: "DATE" | "YEAR_ONLY" | "UNKNOWN";
  height_cm: number | null;
  weight_kg: number | null;
  normalization_confidence: number;
}

/**
 * Normalizes measurement height: handles meters (1.20 - 2.20 -> * 100), centimeters (120 - 220), or text with "cm".
 */
export function parseHeightCm(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const str = String(input).trim().toLowerCase().replace(/cm/, "").trim();
  const num = parseFloat(str);
  if (isNaN(num)) return null;

  // Between 1.0 and 2.5 meters -> convert to cm
  if (num >= 1.0 && num <= 2.5) {
    return Math.round(num * 100);
  }
  // Standard cm range
  if (num >= 30 && num <= 250) {
    return Math.round(num);
  }
  return null;
}

/**
 * Normalizes measurement weight: handles "67 kg", "53 KG", or numeric.
 */
export function parseWeightKg(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const str = String(input).trim().toLowerCase().replace(/kg/, "").trim();
  const num = parseFloat(str);
  if (isNaN(num)) return null;

  if (num >= 2 && num <= 300) {
    return Math.round(num * 10) / 10;
  }
  return null;
}

/**
 * Runs complete normalization pipeline on raw patient inputs
 */
export function normalizePatientInputs(rawInputs: {
  full_name: string;
  phone?: string | number | null;
  citizen_id?: string | number | null;
  card_number?: string | number | null;
  birth_date_or_year?: string | number | null;
  height?: string | number | null;
  weight?: string | number | null;
}): NormalizedPatientPayload {
  const nameResult = formatPersonName(rawInputs.full_name);
  const phoneResult = normalizePhone(rawInputs.phone);
  const cccdResult = normalizeCccd(rawInputs.citizen_id);
  const bhytResult = normalizeBhyt(rawInputs.card_number);

  // Parse DOB; if name had an extracted birth year, fallback to that if no explicit DOB provided
  const dobResult = parseDateOfBirth(rawInputs.birth_date_or_year || nameResult.extractedYear);

  const height_cm = parseHeightCm(rawInputs.height);
  const weight_kg = parseWeightKg(rawInputs.weight);

  // Compute aggregate normalization confidence
  const confidences = [
    phoneResult.isValid ? phoneResult.confidence : 1.0,
    cccdResult.isValid ? cccdResult.confidence : 1.0,
  ];
  const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

  return {
    full_name: nameResult.formattedName,
    normalized_name: nameResult.normalizedSearchKey,
    phone: phoneResult.normalized,
    raw_phone: phoneResult.raw,
    citizen_id: cccdResult.normalized,
    raw_citizen_id: cccdResult.raw,
    card_number: bhytResult.normalized,
    raw_card_number: bhytResult.raw,
    birth_date: dobResult.birth_date,
    birth_year: dobResult.birth_year,
    dob_precision: dobResult.dob_precision,
    height_cm,
    weight_kg,
    normalization_confidence: Math.round(avgConfidence * 100) / 100,
  };
}
