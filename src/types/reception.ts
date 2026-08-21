import type { ReceptionSource, PatientRelationType } from "./database";
import type { PatientProfile } from "./patient";

export interface ReceptionEncounter {
  id: string;
  patient_id: string;
  insurance_card_id: string | null;
  arrived_at: string;
  registered_at: string;
  reception_source: ReceptionSource;
  patient_relation_type: PatientRelationType;
  paper_file_status: string | null;
  his_import_status: string | null;
  reason_for_visit: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ReceptionQueueItem extends ReceptionEncounter {
  patient: PatientProfile;
  active_course?: {
    id: string;
    course_no: number;
    doctor_name: string | null;
    planned_session_count: number;
    completed_session_count: number;
    status: string;
  } | null;
}

export interface ReceptionStats {
  total_today: number;
  new_patients_today: number;
  returning_patients_today: number;
  waiting_exam_count: number;
  in_treatment_count: number;
  completed_today: number;
}
