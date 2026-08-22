import type { DobPrecision, CourseStatus, CourseAdherenceStatus, AppointmentStatus } from "./database";

export interface Patient {
  id: string;
  patient_code: string;
  full_name: string;
  normalized_name: string | null;
  phone: string | null;
  citizen_id: string | null;
  citizen_id_issued_at: string | null;
  citizen_id_issued_by: string | null;
  birth_date: string | null;
  birth_year: number | null;
  dob_precision: DobPrecision;
  sex: "NAM" | "NU" | "KHAC" | null;
  address: string | null;
  occupation: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface PatientInsuranceCard {
  id: string;
  patient_id: string;
  card_number: string;
  registered_facility_code: string | null;
  registered_facility_name: string | null;
  subject_code: string | null;
  benefit_rate: number | null;
  valid_from: string | null;
  valid_to: string | null;
  raw_validity_text: string | null;
  verification_status: string | null;
  verified_at: string | null;
  is_current: boolean;
  created_at: string;
}

export interface PatientMeasurement {
  id: string;
  patient_id: string;
  measured_at: string;
  height_cm: number | null;
  weight_kg: number | null;
  source: string | null;
  recorded_by: string | null;
}

export interface PatientAlert {
  id: string;
  patient_id: string;
  category: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface PatientProfile extends Patient {
  current_insurance?: PatientInsuranceCard | null;
  latest_measurement?: PatientMeasurement | null;
  active_alerts: PatientAlert[];
  active_treatment_courses_count: number;
}

export interface PatientHistorySummary {
  patient: Patient;
  insurance_cards: PatientInsuranceCard[];
  measurements: PatientMeasurement[];
  alerts: PatientAlert[];
  treatment_courses: {
    id: string;
    course_no: number;
    start_date: string;
    planned_session_count: number | null;
    planned_by_doctor_id?: string | null;
    planned_by_doctor_name?: string | null;
    planned_at?: string | null;
    completed_session_count: number;
    status: CourseStatus;
    adherence_status: CourseAdherenceStatus;
    doctor_name: string | null;
    diagnoses: string[];
    services: string[];
  }[];
  recent_appointments: {
    id: string;
    treatment_course_id: string;
    appointment_date: string;
    scheduled_start_at: string;
    status: AppointmentStatus;
    doctor_name: string | null;
  }[];
}

export type DeduplicationMatchPriority =
  | "EXACT_BHYT"
  | "EXACT_CCCD"
  | "PHONE_DOB_NAME"
  | "NAME_DOB_ADDRESS"
  | "FUZZY_NAME"
  | "NO_MATCH";

export interface DeduplicationMatchResult {
  matched_patient_id: string | null;
  priority: DeduplicationMatchPriority;
  confidence_score: number; // 0 to 1
  requires_merge_review: boolean;
  match_reasons: string[];
  existing_patient?: Patient | null;
}
