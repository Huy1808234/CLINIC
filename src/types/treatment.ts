import type { CourseStatus, CourseAdherenceStatus, ServiceOrderSource } from "./database";
import type { Patient } from "./patient";
import type { ServiceCatalogItem, DiagnosisCatalogItem } from "./catalog";

export interface TreatmentCourse {
  id: string;
  patient_id: string;
  reception_id: string | null;
  course_no: number;
  primary_doctor_id: string | null;
  start_date: string;
  planned_end_date: string | null;
  actual_end_date: string | null;
  planned_session_count: number | null;
  planned_by_doctor_id: string | null;
  planned_at: string | null;
  completed_session_count: number;
  status: CourseStatus;
  adherence_status: CourseAdherenceStatus;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export interface CourseDiagnosis {
  id: string;
  treatment_course_id: string;
  diagnosis_id: string | null;
  raw_code: string | null;
  raw_text: string | null;
  diagnosis_type: string;
  is_primary: boolean;
  catalog_item?: DiagnosisCatalogItem | null;
}

export interface CourseServiceOrder {
  id: string;
  treatment_course_id: string;
  service_id: string;
  ordered_by_doctor_id: string | null;
  order_source: ServiceOrderSource;
  sequence_no: number;
  side_or_location: string | null;
  notes: string | null;
  active_from: string | null;
  active_to: string | null;
  is_active: boolean;
  created_at: string;
  service?: ServiceCatalogItem | null;
}

export interface TreatmentCourseDetail extends TreatmentCourse {
  patient: Patient;
  doctor_name: string | null;
  planned_by_doctor_name?: string | null;
  diagnoses: CourseDiagnosis[];
  service_orders: CourseServiceOrder[];
  tags: { id: string; code: string; label: string; category: string; note: string | null }[];
  progress_percentage: number;
}

export interface PlannedOccurrenceService {
  id: string;
  service_id: string;
  service_code: string;
  service_name: string;
  sequence_no: number;
  notes: string | null;
}

export interface TreatmentSessionPlanItem {
  id: string;
  treatment_course_id: string;
  session_number: number;
  planned_by_doctor_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  services: PlannedOccurrenceService[];
}
