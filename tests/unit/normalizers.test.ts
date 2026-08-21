import { normalizePhone } from "@/utils/normalize-phone";
import { normalizeCccd } from "@/utils/normalize-cccd";
import { normalizeBhyt } from "@/utils/normalize-bhyt";
import { formatPersonName } from "@/utils/format-person-name";
import { parseDateOfBirth } from "@/utils/format-date";
import { parseTimeToHHMM } from "@/utils/format-time";
import { parseHeightCm, parseWeightKg, normalizePatientInputs } from "@/lib/patients/normalizers";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

export function runNormalizerTests() {
  console.log("Running Normalizer & Parsing Unit Tests...");

  // 1. Phone Normalizer
  const p1 = normalizePhone("912345678");
  assert(p1.normalized === "0912345678", "Phone 9 digits must restore leading 0");
  assert(p1.isModified === true, "Phone 9 digits must be flagged as modified");

  const p2 = normalizePhone("+84 987.654.321");
  assert(p2.normalized === "0987654321", "Phone +84 with dots must normalize to 0987654321");

  // 2. CCCD Normalizer
  const c1 = normalizeCccd("82068001773"); // 11 digits
  assert(c1.normalized === "082068001773", "CCCD 11 digits must restore leading 0");
  assert(c1.type === "CCCD_12", "CCCD type must be CCCD_12");

  const c2 = normalizeCccd("082068001773");
  assert(c2.isValid === true && c2.normalized === "082068001773", "Standard 12-digit CCCD must remain intact");

  // 3. BHYT Normalizer
  const b1 = normalizeBhyt("GD 479 793 1234567");
  assert(b1.normalized === "GD4797931234567", "BHYT must strip spaces");
  assert(b1.subjectCode === "GD", "BHYT subject code must be GD");

  const b2 = normalizeBhyt("CHƯA CÓ THÔNG TIN VỀ THẺ NÀY");
  assert(b2.isPlaceholder === true, "Placeholder must be detected");
  assert(b2.normalized === null, "Placeholder normalized must be null");

  // 4. Person Name & Year Suffix Extractor
  const n1 = formatPersonName("  nguyễn   văn   a   1967  ");
  assert(n1.formattedName === "Nguyễn Văn A", "Name must be title-cased and year stripped");
  assert(n1.extractedYear === 1967, "Extracted year must be 1967");
  assert(n1.normalizedSearchKey === "nguyen van a", "Search key must be unaccented lowercase");

  // 5. Date & DOB Precision Parser
  const d1 = parseDateOfBirth("1977");
  assert(d1.dob_precision === "YEAR_ONLY" && d1.birth_year === 1977, "4-digit year must parse to YEAR_ONLY");

  const d2 = parseDateOfBirth("25/12/1985");
  assert(d2.dob_precision === "DATE" && d2.birth_date === "1985-12-25", "DD/MM/YYYY must parse to DATE ISO");

  // 6. Height & Weight Parsers
  assert(parseHeightCm("1.65") === 165, "1.65m must parse to 165cm");
  assert(parseHeightCm("165 CM") === 165, "165 CM must parse to 165cm");
  assert(parseWeightKg("67 kg") === 67, "67 kg must parse to 67");
  assert(parseWeightKg("53.5 KG") === 53.5, "53.5 KG must parse to 53.5");

  // 7. Time Fraction
  assert(parseTimeToHHMM(0.315277) === "07:34", "0.315277 fraction must parse to 07:34");
  assert(parseTimeToHHMM("7h34") === "07:34", "7h34 must parse to 07:34");

  // 8. Full Patient Normalization Pipeline
  const full = normalizePatientInputs({
    full_name: "trần thị b (1980)",
    phone: "988776655",
    citizen_id: "79080001234",
    card_number: "DN-479-793-1234567",
    height: "1.58",
    weight: "52 kg",
  });

  assert(full.full_name === "Trần Thị B", "Full pipeline name check");
  assert(full.birth_year === 1980, "Full pipeline year fallback check");
  assert(full.phone === "0988776655", "Full pipeline phone check");
  assert(full.citizen_id === "079080001234", "Full pipeline CCCD check");
  assert(full.card_number === "DN4797931234567", "Full pipeline BHYT check");
  assert(full.height_cm === 158, "Full pipeline height check");
  assert(full.weight_kg === 52, "Full pipeline weight check");

  console.log("All Normalizer & Parsing Unit Tests PASSED!");
}
