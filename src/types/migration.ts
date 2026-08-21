import type { Json } from "./database";

export interface ImportBatch {
  id: string;
  file_name: string;
  sheet_name: string | null;
  started_at: string;
  completed_at: string | null;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  imported_by: string | null;
}

export interface LegacySourceRow {
  id: string;
  import_batch_id: string;
  sheet_name: string;
  excel_row_no: number;
  raw_data: Json;
  matched_patient_id: string | null;
  result_status: "PENDING" | "VALID" | "ERROR" | "COMMITTED";
  error_message: string | null;
}

export interface LegacyDayAppointment {
  day_of_month: number;
  time_str: string; // "07:34"
  status?: string;
}

export interface NormalizedLegacyRow {
  excel_row_no: number;
  sheet_name: string;
  full_name: string;
  normalized_name: string;
  phone: string | null;
  citizen_id: string | null;
  card_number: string | null;
  birth_date: string | null;
  birth_year: number | null;
  dob_precision: "DATE" | "YEAR_ONLY" | "UNKNOWN";
  address: string | null;
  diagnoses: string[];
  services: string[];
  doctor_name: string | null;
  course_no: number;
  day_appointments: LegacyDayAppointment[];
  raw: Record<string, unknown>;
}

export interface MigrationValidationError {
  row_no: number;
  sheet: string;
  message: string;
  raw: Record<string, unknown>;
}

export interface MigrationPreviewItem {
  row_no: number;
  sheet: string;
  name: string;
  phone: string | null;
  cccd: string | null;
  bhyt: string | null;
  match_status: "NEW_PATIENT" | "EXACT_BHYT" | "EXACT_CCCD" | "EXACT_PHONE" | "REVIEW_REQUIRED";
  matched_patient_id?: string | null;
  course_no: number;
  appt_count: number;
  errors: string[];
}

export interface MigrationValidationReport {
  file_name: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  new_patients_count: number;
  existing_matches_count: number;
  total_appointments_count: number;
  errors: MigrationValidationError[];
  preview_items: MigrationPreviewItem[];
}

export interface MigrationCommitResult {
  batch_id: string;
  total_processed: number;
  committed_patients: number;
  reused_patients: number;
  committed_courses: number;
  committed_appointments: number;
  errors_count: number;
}
