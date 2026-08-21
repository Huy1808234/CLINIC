import type { NormalizedLegacyRow, LegacyDayAppointment } from "@/types/migration";
import { formatPersonName } from "@/utils/format-person-name";
import { normalizePhone } from "@/utils/normalize-phone";
import { normalizeCccd } from "@/utils/normalize-cccd";
import { normalizeBhyt } from "@/utils/normalize-bhyt";
import { parseDateOfBirth } from "@/utils/format-date";
import { parseTimeToHHMM } from "@/utils/format-time";

export function normalizeLegacyRow(
  rawRow: Record<string, unknown>,
  excelRowNo: number,
  sheetName: string
): NormalizedLegacyRow {
  // 1. Extract Patient Name
  const rawName = findFieldValue(rawRow, [
    "Họ và tên", "Họ tên", "HỌ VÀ TÊN", "HỌ TÊN", "Tên bệnh nhân",
    "BỆNH NHÂN", "bệnh nhân", "Patient Name", "Name", "FULL_NAME"
  ]);

  const nameResult = formatPersonName(String(rawName || ""));

  // 2. Extract Phone
  const rawPhone = findFieldValue(rawRow, [
    "SĐT", "Số điện thoại", "Điện thoại", "Phone", "SDT", "SỐ ĐIỆN THOẠI", "TEL"
  ]);
  const phoneResult = normalizePhone(rawPhone ? String(rawPhone) : null);

  // 3. Extract CCCD / CMND
  const rawCccd = findFieldValue(rawRow, [
    "CCCD", "CMND", "Số CCCD", "Số CMND", "Số định danh", "Căn cước", "CITIZEN_ID"
  ]);
  const cccdResult = normalizeCccd(rawCccd ? String(rawCccd) : null);

  // 4. Extract BHYT
  const rawBhyt = findFieldValue(rawRow, [
    "BHYT", "Số thẻ BHYT", "Mã thẻ", "Số thẻ", "Insurance", "SỐ THẺ BHYT", "MÃ THẺ BHYT"
  ]);
  const bhytResult = normalizeBhyt(rawBhyt ? String(rawBhyt) : null);

  // 5. Extract Date of Birth / Year
  const rawDob = findFieldValue(rawRow, [
    "Ngày sinh", "Năm sinh", "DOB", "Birth Date", "Tuổi", "NGÀY SINH", "NĂM SINH"
  ]);
  // If no explicit DOB column, fallback to extracted birth year from name string if available
  const dobResult = parseDateOfBirth(rawDob ? String(rawDob) : nameResult.extractedYear);

  // 6. Extract Address
  const rawAddress = findFieldValue(rawRow, [
    "Địa chỉ", "Địa bàn", "Nơi ở", "Address", "ĐỊA CHỈ"
  ]);
  const address = rawAddress ? String(rawAddress).trim() : null;

  // 7. Extract Diagnoses
  const rawDiag = findFieldValue(rawRow, [
    "Chẩn đoán", "Bệnh chính", "ICD", "Diagnosis", "CHẨN ĐOÁN", "BỆNH KÈM THEO"
  ]);
  const diagnoses: string[] = rawDiag
    ? String(rawDiag).split(/[,;\n+]/).map((d) => d.trim()).filter(Boolean)
    : [];

  // 8. Extract Services
  const rawServ = findFieldValue(rawRow, [
    "Dịch vụ", "Chỉ định", "Thủ thuật", "Services", "DỊCH VỤ", "KỸ THUẬT"
  ]);
  const services: string[] = rawServ
    ? String(rawServ).split(/[,;\n+]/).map((s) => s.trim()).filter(Boolean)
    : [];

  // 9. Extract Doctor
  const rawDoctor = findFieldValue(rawRow, [
    "Bác sĩ", "Bs điều trị", "Bs phụ trách", "Doctor", "BÁC SĨ", "BS"
  ]);
  let doctorName = rawDoctor ? String(rawDoctor).trim() : null;

  // If doctor not in row, infer from sheet name (e.g. "Bs Hải", "Bs Uyên", "Bs Ánh", "Bs Quyên")
  if (!doctorName && sheetName.toLowerCase().startsWith("bs")) {
    doctorName = sheetName.trim();
  }

  // 10. Extract Course Number (LT1, LT2, LT3...)
  const rawCourse = findFieldValue(rawRow, [
    "Liệu trình", "LT", "Course", "Đợt điều trị", "LIỆU TRÌNH"
  ]);
  let courseNo = 1;
  if (rawCourse) {
    const match = String(rawCourse).match(/\d+/);
    if (match) {
      courseNo = parseInt(match[0], 10);
    }
  }

  // 11. Extract legacy Day 1..31 appointment times
  const dayAppointments: LegacyDayAppointment[] = [];

  for (const [key, value] of Object.entries(rawRow)) {
    if (value === null || value === undefined || value === "") continue;

    // Check if key represents a day of month (e.g. "1", "2"..."31", "Ngày 1"..."Ngày 31", "D1"..."D31")
    const dayNum = extractDayOfMonthNumber(key);
    if (dayNum !== null && dayNum >= 1 && dayNum <= 31) {
      const timeStr = parseTimeToHHMM(value as string | number);
      if (timeStr) {
        dayAppointments.push({
          day_of_month: dayNum,
          time_str: timeStr,
        });
      }
    }
  }

  return {
    excel_row_no: excelRowNo,
    sheet_name: sheetName,
    full_name: nameResult.formattedName,
    normalized_name: nameResult.normalizedSearchKey,
    phone: phoneResult.normalized,
    citizen_id: cccdResult.normalized,
    card_number: bhytResult.normalized,
    birth_date: dobResult.birth_date,
    birth_year: dobResult.birth_year,
    dob_precision: dobResult.dob_precision,
    address,
    diagnoses,
    services,
    doctor_name: doctorName,
    course_no: courseNo,
    day_appointments: dayAppointments,
    raw: rawRow,
  };
}

function findFieldValue(row: Record<string, unknown>, candidateKeys: string[]): unknown {
  const rowKeys = Object.keys(row);
  for (const candidate of candidateKeys) {
    const foundKey = rowKeys.find(
      (k) => k.trim().toLowerCase() === candidate.toLowerCase()
    );
    if (foundKey && row[foundKey] !== null && row[foundKey] !== undefined && row[foundKey] !== "") {
      return row[foundKey];
    }
  }
  return null;
}

function extractDayOfMonthNumber(key: string): number | null {
  const clean = key.trim().toLowerCase();

  // Direct number "1" .. "31"
  if (/^\d{1,2}$/.test(clean)) {
    const n = parseInt(clean, 10);
    return n >= 1 && n <= 31 ? n : null;
  }

  // "ngày 1" .. "ngày 31" or "ngay 1"
  const ngayMatch = clean.match(/^(?:ngày|ngay|d|day)\s*(\d{1,2})$/i);
  if (ngayMatch) {
    const n = parseInt(ngayMatch[1], 10);
    return n >= 1 && n <= 31 ? n : null;
  }

  return null;
}
