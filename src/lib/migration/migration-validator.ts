import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type {
  NormalizedLegacyRow,
  MigrationValidationReport,
  MigrationValidationError,
  MigrationPreviewItem,
} from "@/types/migration";
import { matchPatientCandidate } from "@/lib/patients/deduplication";

export async function validateLegacyRows(
  supabase: SupabaseClient<Database>,
  fileName: string,
  rows: NormalizedLegacyRow[]
): Promise<MigrationValidationReport> {
  const errors: MigrationValidationError[] = [];
  const previewItems: MigrationPreviewItem[] = [];

  let newPatientsCount = 0;
  let existingMatchesCount = 0;
  let totalApptsCount = 0;

  for (const row of rows) {
    const rowErrors: string[] = [];

    // 1. Basic validation
    if (!row.full_name || row.full_name.length < 2) {
      rowErrors.push("Họ tên bệnh nhân không hợp lệ hoặc bị để trống");
    }

    // 2. Run deduplication match against existing database
    let matchStatus: MigrationPreviewItem["match_status"] = "NEW_PATIENT";
    let matchedPatientId: string | null = null;

    if (row.full_name) {
      const matchResult = await matchPatientCandidate(
        supabase,
        {
          full_name: row.full_name,
          normalized_name: row.normalized_name,
          phone: row.phone,
          raw_phone: row.phone || "",
          citizen_id: row.citizen_id,
          raw_citizen_id: row.citizen_id || "",
          card_number: row.card_number,
          raw_card_number: row.card_number || "",
          birth_date: row.birth_date,
          birth_year: row.birth_year,
          dob_precision: row.dob_precision,
          height_cm: null,
          weight_kg: null,
          normalization_confidence: 1.0,
        },
        row.address
      );

      if (matchResult.matched_patient_id) {
        matchedPatientId = matchResult.matched_patient_id;
        existingMatchesCount++;

        if (matchResult.priority === "EXACT_BHYT") {
          matchStatus = "EXACT_BHYT";
        } else if (matchResult.priority === "EXACT_CCCD") {
          matchStatus = "EXACT_CCCD";
        } else if (matchResult.priority === "PHONE_DOB_NAME") {
          matchStatus = "EXACT_PHONE";
        } else {
          matchStatus = "REVIEW_REQUIRED";
        }
      } else {
        newPatientsCount++;
      }
    }

    const apptCount = row.day_appointments.length;
    totalApptsCount += apptCount;

    if (rowErrors.length > 0) {
      for (const err of rowErrors) {
        errors.push({
          row_no: row.excel_row_no,
          sheet: row.sheet_name,
          message: err,
          raw: row.raw,
        });
      }
    }

    previewItems.push({
      row_no: row.excel_row_no,
      sheet: row.sheet_name,
      name: row.full_name,
      phone: row.phone,
      cccd: row.citizen_id,
      bhyt: row.card_number,
      match_status: matchStatus,
      matched_patient_id: matchedPatientId,
      course_no: row.course_no,
      appt_count: apptCount,
      errors: rowErrors,
    });
  }

  const validRows = previewItems.filter((item) => item.errors.length === 0).length;
  const errorRows = previewItems.length - validRows;

  return {
    file_name: fileName,
    total_rows: rows.length,
    valid_rows: validRows,
    error_rows: errorRows,
    new_patients_count: newPatientsCount,
    existing_matches_count: existingMatchesCount,
    total_appointments_count: totalApptsCount,
    errors,
    preview_items: previewItems,
  };
}
