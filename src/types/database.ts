export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type DobPrecision = "DATE" | "YEAR_ONLY" | "UNKNOWN";
export type StaffRole = "DOCTOR" | "RECEPTIONIST" | "TECHNICIAN" | "Y_SI" | "CSKH" | "MANAGER" | "ADMIN";
export type ReceptionSource = "MANUAL" | "HIS_IMPORTED" | "PAPER_FILE" | "EXCEL_MIGRATION";
export type PatientRelationType = "NEW" | "RETURNING";
export type CourseStatus = "PLANNED" | "ACTIVE" | "PAUSED" | "COMPLETED" | "DROPPED" | "CANCELLED";
export type CourseAdherenceStatus = "NORMAL" | "AT_RISK" | "DROPPED";
export type ServiceOrderSource = "FIRST_PLAN" | "DOCTOR_ACTUAL" | "MIGRATION";
export type ResourceType = "ROOM" | "MACHINE" | "MACHINE_COMBO" | "BED" | "OTHER";
export type AppointmentStatus =
  | "PLANNED"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "IN_EXAM"
  | "IN_TREATMENT"
  | "COMPLETED"
  | "NO_SHOW"
  | "CANCELLED"
  | "RESCHEDULED";
export type ScheduleSource = "AUTO" | "MANUAL" | "MIGRATION";
export type FollowUpStatus = "PENDING" | "CONTACTED" | "APPOINTMENT_SCHEDULED" | "UNREACHABLE" | "REQUESTED_DISCHARGE" | "CLOSED";

export interface Database {
  public: {
    Tables: {
      patients: {
        Row: {
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
          sex: string | null;
          address: string | null;
          occupation: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          patient_code?: string;
          full_name: string;
          normalized_name?: string | null;
          phone?: string | null;
          citizen_id?: string | null;
          citizen_id_issued_at?: string | null;
          citizen_id_issued_by?: string | null;
          birth_date?: string | null;
          birth_year?: number | null;
          dob_precision?: DobPrecision;
          sex?: string | null;
          address?: string | null;
          occupation?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          patient_code?: string;
          full_name?: string;
          normalized_name?: string | null;
          phone?: string | null;
          citizen_id?: string | null;
          citizen_id_issued_at?: string | null;
          citizen_id_issued_by?: string | null;
          birth_date?: string | null;
          birth_year?: number | null;
          dob_precision?: DobPrecision;
          sex?: string | null;
          address?: string | null;
          occupation?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      patient_insurance_cards: {
        Row: {
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
        };
        Insert: {
          id?: string;
          patient_id: string;
          card_number: string;
          registered_facility_code?: string | null;
          registered_facility_name?: string | null;
          subject_code?: string | null;
          benefit_rate?: number | null;
          valid_from?: string | null;
          valid_to?: string | null;
          raw_validity_text?: string | null;
          verification_status?: string | null;
          verified_at?: string | null;
          is_current?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          card_number?: string;
          registered_facility_code?: string | null;
          registered_facility_name?: string | null;
          subject_code?: string | null;
          benefit_rate?: number | null;
          valid_from?: string | null;
          valid_to?: string | null;
          raw_validity_text?: string | null;
          verification_status?: string | null;
          verified_at?: string | null;
          is_current?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      patient_measurements: {
        Row: {
          id: string;
          patient_id: string;
          measured_at: string;
          height_cm: number | null;
          weight_kg: number | null;
          source: string | null;
          recorded_by: string | null;
        };
        Insert: {
          id?: string;
          patient_id: string;
          measured_at?: string;
          height_cm?: number | null;
          weight_kg?: number | null;
          source?: string | null;
          recorded_by?: string | null;
        };
        Update: {
          id?: string;
          patient_id?: string;
          measured_at?: string;
          height_cm?: number | null;
          weight_kg?: number | null;
          source?: string | null;
          recorded_by?: string | null;
        };
        Relationships: [];
      };
      patient_alerts: {
        Row: {
          id: string;
          patient_id: string;
          category: string;
          severity: string;
          message: string;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          patient_id: string;
          category?: string;
          severity?: string;
          message: string;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          patient_id?: string;
          category?: string;
          severity?: string;
          message?: string;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      staff: {
        Row: {
          id: string;
          user_id: string | null;
          staff_code: string;
          full_name: string;
          role_type: StaffRole;
          phone: string | null;
          email: string | null;
          is_active: boolean;
          auth_setup_required: boolean;
          auth_setup_completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          staff_code: string;
          full_name: string;
          role_type: StaffRole;
          phone?: string | null;
          email?: string | null;
          is_active?: boolean;
          auth_setup_required?: boolean;
          auth_setup_completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          staff_code?: string;
          full_name?: string;
          role_type?: StaffRole;
          phone?: string | null;
          email?: string | null;
          is_active?: boolean;
          auth_setup_required?: boolean;
          auth_setup_completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      receptions: {
        Row: {
          id: string;
          clinic_id: string | null;
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
        };
        Insert: {
          id?: string;
          clinic_id?: string | null;
          patient_id: string;
          insurance_card_id?: string | null;
          arrived_at?: string;
          registered_at?: string;
          reception_source?: ReceptionSource;
          patient_relation_type?: PatientRelationType;
          paper_file_status?: string | null;
          his_import_status?: string | null;
          reason_for_visit?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          clinic_id?: string | null;
          patient_id?: string;
          insurance_card_id?: string | null;
          arrived_at?: string;
          registered_at?: string;
          reception_source?: ReceptionSource;
          patient_relation_type?: PatientRelationType;
          paper_file_status?: string | null;
          his_import_status?: string | null;
          reason_for_visit?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      treatment_courses: {
        Row: {
          id: string;
          clinic_id: string | null;
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
        };
        Insert: {
          id?: string;
          clinic_id?: string | null;
          patient_id: string;
          reception_id?: string | null;
          course_no: number;
          primary_doctor_id?: string | null;
          start_date: string;
          planned_end_date?: string | null;
          actual_end_date?: string | null;
          planned_session_count?: number | null;
          planned_by_doctor_id?: string | null;
          planned_at?: string | null;
          completed_session_count?: number;
          status?: CourseStatus;
          adherence_status?: CourseAdherenceStatus;
          notes?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          clinic_id?: string | null;
          patient_id?: string;
          reception_id?: string | null;
          course_no?: number;
          primary_doctor_id?: string | null;
          start_date?: string;
          planned_end_date?: string | null;
          actual_end_date?: string | null;
          planned_session_count?: number | null;
          planned_by_doctor_id?: string | null;
          planned_at?: string | null;
          completed_session_count?: number;
          status?: CourseStatus;
          adherence_status?: CourseAdherenceStatus;
          notes?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      diagnosis_catalog: {
        Row: {
          id: string;
          code_system: string;
          code: string;
          name: string;
          traditional_code: string | null;
          traditional_name: string | null;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          code_system: string;
          code: string;
          name: string;
          traditional_code?: string | null;
          traditional_name?: string | null;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          code_system?: string;
          code?: string;
          name?: string;
          traditional_code?: string | null;
          traditional_name?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      course_diagnoses: {
        Row: {
          id: string;
          treatment_course_id: string;
          diagnosis_id: string | null;
          raw_code: string | null;
          raw_text: string | null;
          diagnosis_type: string;
          is_primary: boolean;
          diagnosed_by_doctor_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          treatment_course_id: string;
          diagnosis_id?: string | null;
          raw_code?: string | null;
          raw_text?: string | null;
          diagnosis_type?: string;
          is_primary?: boolean;
          diagnosed_by_doctor_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          treatment_course_id?: string;
          diagnosis_id?: string | null;
          raw_code?: string | null;
          raw_text?: string | null;
          diagnosis_type?: string;
          is_primary?: boolean;
          diagnosed_by_doctor_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      service_catalog: {
        Row: {
          id: string;
          service_code: string;
          service_name: string;
          service_group: string | null;
          default_duration_minutes: number;
          setup_minutes: number;
          cleanup_minutes: number;
          required_resource_type: ResourceType | null;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          service_code: string;
          service_name: string;
          service_group?: string | null;
          default_duration_minutes?: number;
          setup_minutes?: number;
          cleanup_minutes?: number;
          required_resource_type?: ResourceType | null;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          service_code?: string;
          service_name?: string;
          service_group?: string | null;
          default_duration_minutes?: number;
          setup_minutes?: number;
          cleanup_minutes?: number;
          required_resource_type?: ResourceType | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      course_service_orders: {
        Row: {
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
        };
        Insert: {
          id?: string;
          treatment_course_id: string;
          service_id: string;
          ordered_by_doctor_id?: string | null;
          order_source?: ServiceOrderSource;
          sequence_no?: number;
          side_or_location?: string | null;
          notes?: string | null;
          active_from?: string | null;
          active_to?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          treatment_course_id?: string;
          service_id?: string;
          ordered_by_doctor_id?: string | null;
          order_source?: ServiceOrderSource;
          sequence_no?: number;
          side_or_location?: string | null;
          notes?: string | null;
          active_from?: string | null;
          active_to?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      resources: {
        Row: {
          id: string;
          resource_code: string;
          name: string;
          resource_type: ResourceType;
          capacity: number;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          resource_code: string;
          name: string;
          resource_type?: ResourceType;
          capacity?: number;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          resource_code?: string;
          name?: string;
          resource_type?: ResourceType;
          capacity?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
      resource_groups: {
        Row: {
          id: string;
          code: string;
          name: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      resource_group_members: {
        Row: {
          resource_group_id: string;
          resource_id: string;
        };
        Insert: {
          resource_group_id: string;
          resource_id: string;
        };
        Update: {
          resource_group_id?: string;
          resource_id?: string;
        };
        Relationships: [];
      };
      staff_shifts: {
        Row: {
          id: string;
          staff_id: string;
          work_date: string;
          start_time: string;
          end_time: string;
          shift_type: string;
          resource_group_id: string | null;
          status: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          work_date: string;
          start_time: string;
          end_time: string;
          shift_type?: string;
          resource_group_id?: string | null;
          status?: string;
        };
        Update: {
          id?: string;
          staff_id?: string;
          work_date?: string;
          start_time?: string;
          end_time?: string;
          shift_type?: string;
          resource_group_id?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          patient_id: string;
          treatment_course_id: string;
          doctor_id: string | null;
          appointment_date: string;
          scheduled_start_at: string;
          scheduled_end_at: string | null;
          status: AppointmentStatus;
          schedule_source: ScheduleSource;
          sequence_in_day: number | null;
          priority: number;
          manual_override: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          treatment_course_id: string;
          doctor_id?: string | null;
          appointment_date: string;
          scheduled_start_at: string;
          scheduled_end_at?: string | null;
          status?: AppointmentStatus;
          schedule_source?: ScheduleSource;
          sequence_in_day?: number | null;
          priority?: number;
          manual_override?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          treatment_course_id?: string;
          doctor_id?: string | null;
          appointment_date?: string;
          scheduled_start_at?: string;
          scheduled_end_at?: string | null;
          status?: AppointmentStatus;
          schedule_source?: ScheduleSource;
          sequence_in_day?: number | null;
          priority?: number;
          manual_override?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      appointment_steps: {
        Row: {
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
          status: string;
        };
        Insert: {
          id?: string;
          appointment_id: string;
          step_no: number;
          step_type: string;
          service_id?: string | null;
          staff_id?: string | null;
          resource_id?: string | null;
          resource_group_id?: string | null;
          planned_start_at: string;
          planned_end_at: string;
          actual_start_at?: string | null;
          actual_end_at?: string | null;
          status?: string;
        };
        Update: {
          id?: string;
          appointment_id?: string;
          step_no?: number;
          step_type?: string;
          service_id?: string | null;
          staff_id?: string | null;
          resource_id?: string | null;
          resource_group_id?: string | null;
          planned_start_at?: string;
          planned_end_at?: string;
          actual_start_at?: string | null;
          actual_end_at?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      treatment_sessions: {
        Row: {
          id: string;
          treatment_course_id: string;
          appointment_id: string | null;
          service_date: string;
          status: string;
          checked_in_at: string | null;
          started_at: string | null;
          completed_at: string | null;
          clinical_note: string | null;
          created_by: string | null;
          performed_by_staff_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          treatment_course_id: string;
          appointment_id?: string | null;
          service_date: string;
          status?: string;
          checked_in_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          clinical_note?: string | null;
          created_by?: string | null;
          performed_by_staff_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          treatment_course_id?: string;
          appointment_id?: string | null;
          service_date?: string;
          status?: string;
          checked_in_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          clinical_note?: string | null;
          created_by?: string | null;
          performed_by_staff_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      course_tags: {
        Row: {
          id: string;
          code: string;
          label: string;
          category: string;
        };
        Insert: {
          id?: string;
          code: string;
          label: string;
          category: string;
        };
        Update: {
          id?: string;
          code?: string;
          label?: string;
          category?: string;
        };
        Relationships: [];
      };
      treatment_course_tags: {
        Row: {
          treatment_course_id: string;
          tag_id: string;
          note: string | null;
        };
        Insert: {
          treatment_course_id: string;
          tag_id: string;
          note?: string | null;
        };
        Update: {
          treatment_course_id?: string;
          tag_id?: string;
          note?: string | null;
        };
        Relationships: [];
      };
      follow_up_cases: {
        Row: {
          id: string;
          patient_id: string;
          treatment_course_id: string | null;
          reason: string;
          opened_at: string;
          status: FollowUpStatus;
          next_follow_up_at: string | null;
          assigned_to: string | null;
          resolved_at: string | null;
          resolution: string | null;
        };
        Insert: {
          id?: string;
          patient_id: string;
          treatment_course_id?: string | null;
          reason: string;
          opened_at?: string;
          status?: FollowUpStatus;
          next_follow_up_at?: string | null;
          assigned_to?: string | null;
          resolved_at?: string | null;
          resolution?: string | null;
        };
        Update: {
          id?: string;
          patient_id?: string;
          treatment_course_id?: string | null;
          reason?: string;
          opened_at?: string;
          status?: FollowUpStatus;
          next_follow_up_at?: string | null;
          assigned_to?: string | null;
          resolved_at?: string | null;
          resolution?: string | null;
        };
        Relationships: [];
      };
      contact_attempts: {
        Row: {
          id: string;
          follow_up_case_id: string;
          attempt_no: number;
          contacted_at: string;
          channel: string;
          result: string;
          content: string | null;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          follow_up_case_id: string;
          attempt_no: number;
          contacted_at?: string;
          channel?: string;
          result: string;
          content?: string | null;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          follow_up_case_id?: string;
          attempt_no?: number;
          contacted_at?: string;
          channel?: string;
          result?: string;
          content?: string | null;
          created_by?: string | null;
        };
        Relationships: [];
      };
      scheduling_settings: {
        Row: {
          id: string;
          slot_interval_minutes: number;
          clinic_open_time: string;
          clinic_close_time: string;
          lunch_start: string;
          lunch_end: string;
          max_daily_patients_per_doctor: number;
          default_treatment_frequency: string;
          follow_up_inactivity_threshold_days: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          slot_interval_minutes?: number;
          clinic_open_time?: string;
          clinic_close_time?: string;
          lunch_start?: string;
          lunch_end?: string;
          max_daily_patients_per_doctor?: number;
          default_treatment_frequency?: string;
          follow_up_inactivity_threshold_days?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          slot_interval_minutes?: number;
          clinic_open_time?: string;
          clinic_close_time?: string;
          lunch_start?: string;
          lunch_end?: string;
          max_daily_patients_per_doctor?: number;
          default_treatment_frequency?: string;
          follow_up_inactivity_threshold_days?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      import_batches: {
        Row: {
          id: string;
          file_name: string;
          sheet_name: string | null;
          started_at: string;
          completed_at: string | null;
          status: string;
          imported_by: string | null;
        };
        Insert: {
          id?: string;
          file_name: string;
          sheet_name?: string | null;
          started_at?: string;
          completed_at?: string | null;
          status?: string;
          imported_by?: string | null;
        };
        Update: {
          id?: string;
          file_name?: string;
          sheet_name?: string | null;
          started_at?: string;
          completed_at?: string | null;
          status?: string;
          imported_by?: string | null;
        };
        Relationships: [];
      };
      legacy_source_rows: {
        Row: {
          id: string;
          import_batch_id: string;
          sheet_name: string;
          excel_row_no: number;
          raw_data: Json;
          matched_patient_id: string | null;
          result_status: string;
          error_message: string | null;
        };
        Insert: {
          id?: string;
          import_batch_id: string;
          sheet_name: string;
          excel_row_no: number;
          raw_data: Json;
          matched_patient_id?: string | null;
          result_status?: string;
          error_message?: string | null;
        };
        Update: {
          id?: string;
          import_batch_id?: string;
          sheet_name?: string;
          excel_row_no?: number;
          raw_data?: Json;
          matched_patient_id?: string | null;
          result_status?: string;
          error_message?: string | null;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          before_data: Json | null;
          after_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          before_data?: Json | null;
          after_data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_user_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string;
          before_data?: Json | null;
          after_data?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          code: string;
          name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      clinics: {
        Row: {
          id: string;
          organization_id: string;
          clinic_code: string;
          name: string;
          short_name: string | null;
          address: string | null;
          phone: string | null;
          timezone: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          clinic_code: string;
          name: string;
          short_name?: string | null;
          address?: string | null;
          phone?: string | null;
          timezone?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          clinic_code?: string;
          name?: string;
          short_name?: string | null;
          address?: string | null;
          phone?: string | null;
          timezone?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clinics_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };
      staff_clinic_memberships: {
        Row: {
          id: string;
          staff_id: string;
          clinic_id: string;
          is_primary: boolean;
          is_active: boolean;
          joined_at: string | null;
          left_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          clinic_id: string;
          is_primary?: boolean;
          is_active?: boolean;
          joined_at?: string | null;
          left_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          staff_id?: string;
          clinic_id?: string;
          is_primary?: boolean;
          is_active?: boolean;
          joined_at?: string | null;
          left_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_clinic_memberships_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_clinic_memberships_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          }
        ];
      };
      staff_clinic_roles: {
        Row: {
          id: string;
          staff_clinic_membership_id: string;
          role_code: StaffRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          staff_clinic_membership_id: string;
          role_code: StaffRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          staff_clinic_membership_id?: string;
          role_code?: StaffRole;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_clinic_roles_staff_clinic_membership_id_fkey";
            columns: ["staff_clinic_membership_id"];
            isOneToOne: false;
            referencedRelation: "staff_clinic_memberships";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      schedule_treatment_course: {
        Args: {
          p_course_id: string;
          p_doctor_id: string;
          p_start_date: string;
          p_session_count: number;
          p_preferred_time: string | null;
          p_selected_weekdays: number[] | null;
        };
        Returns: Json;
      };
      set_staff_active_with_admin_guard: {
        Args: {
          p_staff_id: string;
          p_is_active: boolean;
        };
        Returns: Json;
      };
      deactivate_staff_membership_with_admin_guard: {
        Args: {
          p_membership_id: string;
        };
        Returns: Json;
      };
      assign_staff_clinic_roles_with_admin_guard: {
        Args: {
          p_staff_id: string;
          p_clinic_id: string;
          p_roles: string[];
          p_is_primary?: boolean;
        };
        Returns: Json;
      };
      complete_appointment_treatment_session: {
        Args: {
          p_appointment_id: string;
          p_actor_staff_id: string;
          p_actor_user_id: string;
          p_clinical_note?: string | null;
        };
        Returns: Json;
      };
      establish_treatment_course_plan: {
        Args: {
          p_course_id: string;
          p_clinic_id: string;
          p_planned_session_count: number;
          p_actor_staff_id: string;
          p_actor_user_id: string;
        };
        Returns: Json;
      };
      complete_staff_auth_setup: {
        Args: {
          p_actor_user_id: string;
        };
        Returns: Json;
      };
      link_staff_auth_account: {
        Args: {
          p_staff_id: string;
          p_clinic_id: string;
          p_auth_user_id: string;
          p_login_email: string;
          p_actor_staff_id: string;
          p_actor_user_id: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
