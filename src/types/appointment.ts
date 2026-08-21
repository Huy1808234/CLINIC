import type { AppointmentStatus, ScheduleSource } from "./database";

export interface Appointment {
  id: string;
  patient_id: string;
  treatment_course_id: string;
  doctor_id: string | null;
  appointment_date: string; // YYYY-MM-DD
  scheduled_start_at: string; // ISO timestamptz
  scheduled_end_at: string | null;
  status: AppointmentStatus;
  schedule_source: ScheduleSource;
  sequence_in_day: number | null;
  priority: number;
  manual_override: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentStep {
  id: string;
  appointment_id: string;
  step_no: number;
  step_type: string;
  service_id: string | null;
  staff_id: string | null;
  resource_id: string | null;
  resource_group_id: string | null;
  planned_start_at: string;
  planned_end_at: string;
  actual_start_at: string | null;
  actual_end_at: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
}

export interface AppointmentWithDetails extends Appointment {
  patient_name: string;
  patient_code: string;
  doctor_name: string | null;
  course_no: number;
  steps?: AppointmentStep[];
  tags?: string[];
}
