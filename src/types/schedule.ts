import type { AppointmentStatus } from "./database";
import type { AppointmentWithDetails } from "./appointment";

export interface MonthMatrixCell {
  appointment_id: string;
  time_str: string; // HH:mm format, e.g. "07:34"
  status: AppointmentStatus;
  manual_override: boolean;
  notes: string | null;
}

export interface MonthMatrixPatientRow {
  patient_id: string;
  patient_name: string;
  patient_code: string;
  treatment_course_id: string;
  course_no: number;
  tags: string[]; // e.g. ["K5", "IN_KY"]
  cells: Record<number, MonthMatrixCell | null>; // dayOfMonth 1..31 -> Cell
}

export interface MonthMatrixDoctorBlock {
  doctor_id: string;
  doctor_name: string;
  doctor_code: string;
  patient_rows: MonthMatrixPatientRow[];
  total_appointments: number;
}

export interface MonthMatrixData {
  month_str: string; // YYYY-MM
  days_in_month: number;
  doctor_blocks: MonthMatrixDoctorBlock[];
  unassigned_block?: MonthMatrixDoctorBlock | null;
}

export interface DayTimelineSlot {
  time_str: string; // HH:mm, e.g. "07:30"
  appointments_by_doctor: Record<string, AppointmentWithDetails[]>; // doctor_id -> appointments
}

export interface DayTimelineData {
  date_str: string; // YYYY-MM-DD
  doctors: { id: string; name: string; code: string }[];
  slots: DayTimelineSlot[];
  total_appointments: number;
}

export interface AvailableSlotItem {
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  doctor_id: string;
  is_available: boolean;
  score: number;
  reason?: string;
}

export interface AutoScheduleInput {
  treatment_course_id: string;
  doctor_id: string;
  start_date: string; // YYYY-MM-DD
  planned_session_count: number;
  preferred_time?: string | null; // HH:mm
  selected_weekdays?: number[]; // 1=Mon .. 6=Sat
}

export interface AutoScheduleResult {
  success: boolean;
  status: "FULL" | "PARTIAL" | "FAILED";
  scheduled_count: number;
  requested_count: number;
  appointment_ids: string[];
  unscheduled_dates?: string[];
  message?: string;
}
