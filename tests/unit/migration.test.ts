import { normalizeLegacyRow } from "@/lib/migration/row-normalizer";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

export function runMigrationTests() {
  console.log("Running Excel Migration & Staging Unit Tests...");

  // 1. Test legacy row normalization with typical Doctor sheet layout
  const rawLegacyRow = {
    "Họ và tên": "nguyễn văn an (1968)",
    "SĐT": "912345678", // 9 digits, missing 0
    "Số CCCD": "82068001773", // 11 digits, missing 0
    "Số thẻ BHYT": "GD 479 793 1234567",
    "Địa chỉ": "Phường 1, TP Cao Lãnh",
    "Chẩn đoán": "M54.5 Đau thắt lưng; M17 Thoái hóa khớp gối",
    "Dịch vụ": "Điện châm, Xoa bóp bấm huyệt",
    "Liệu trình": "LT2",
    "1": 0.315277, // 07:34
    "2": "07:34",
    "3": "7h34",
    "4": 0.583333, // 14:00
  };

  const normalized = normalizeLegacyRow(rawLegacyRow, 12, "Bs Hải");

  // Verify Name & DOB
  assert(normalized.full_name === "Nguyễn Văn An", "Name should be title cased and year stripped");
  assert(normalized.birth_year === 1968, "Birth year should be extracted from name suffix");
  assert(normalized.dob_precision === "YEAR_ONLY", "DOB precision should be YEAR_ONLY");

  // Verify Identifiers
  assert(normalized.phone === "0912345678", "Phone must restore leading 0");
  assert(normalized.citizen_id === "082068001773", "CCCD must restore leading 0");
  assert(normalized.card_number === "GD4797931234567", "BHYT must strip spaces");

  // Verify Clinical & Doctor
  assert(normalized.doctor_name === "Bs Hải", "Doctor should fallback to sheet name");
  assert(normalized.course_no === 2, "Course should parse LT2 as 2");
  assert(normalized.diagnoses.length === 2, "Diagnoses should split into 2 items");

  // Verify Day 1..31 appointment time extraction
  assert(normalized.day_appointments.length === 4, "Should extract 4 day appointments");
  assert(normalized.day_appointments[0].day_of_month === 1, "Day 1 check");
  assert(normalized.day_appointments[0].time_str === "07:34", "Day 1 fraction time check (07:34)");
  assert(normalized.day_appointments[1].time_str === "07:34", "Day 2 string time check");
  assert(normalized.day_appointments[2].time_str === "07:34", "Day 3 7h34 time check");
  assert(normalized.day_appointments[3].time_str === "14:00", "Day 4 fraction time check (14:00)");

  console.log("All Excel Migration Unit Tests PASSED!");
}
