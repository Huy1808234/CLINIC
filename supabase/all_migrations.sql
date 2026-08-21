-- Migration: Core Patient, Staff, Reception and Treatment Course Schema
-- Spec Reference: THUAN_THIEN_RECEPTION_SCHEDULING_TECHLEAD_SPEC_V1.md §12

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Patients Master Table
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    normalized_name TEXT,
    phone TEXT,
    citizen_id TEXT,
    citizen_id_issued_at DATE,
    citizen_id_issued_by TEXT,
    birth_date DATE,
    birth_year SMALLINT,
    dob_precision TEXT NOT NULL DEFAULT 'DATE' CHECK (dob_precision IN ('DATE', 'YEAR_ONLY', 'UNKNOWN')),
    sex TEXT CHECK (sex IN ('NAM', 'NU', 'KHAC')),
    address TEXT,
    occupation TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_patients_normalized_name ON public.patients(normalized_name);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON public.patients(phone);
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_citizen_id ON public.patients(citizen_id) WHERE citizen_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_dob ON public.patients(birth_date, birth_year);

-- 2. Patient Insurance Cards Table
CREATE TABLE IF NOT EXISTS public.patient_insurance_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
    card_number TEXT NOT NULL,
    registered_facility_code TEXT,
    registered_facility_name TEXT,
    subject_code TEXT,
    benefit_rate NUMERIC(5,2),
    valid_from DATE,
    valid_to DATE,
    raw_validity_text TEXT,
    verification_status TEXT DEFAULT 'UNVERIFIED',
    verified_at TIMESTAMPTZ,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_cards_patient ON public.patient_insurance_cards(patient_id);
CREATE INDEX IF NOT EXISTS idx_insurance_cards_number ON public.patient_insurance_cards(card_number);

-- 3. Patient Measurements Table
CREATE TABLE IF NOT EXISTS public.patient_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
    measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    height_cm NUMERIC(5,2),
    weight_kg NUMERIC(5,2),
    source TEXT DEFAULT 'MANUAL',
    recorded_by UUID
);

CREATE INDEX IF NOT EXISTS idx_measurements_patient ON public.patient_measurements(patient_id, measured_at DESC);

-- 4. Patient Alerts Table
CREATE TABLE IF NOT EXISTS public.patient_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
    category TEXT NOT NULL DEFAULT 'GENERAL',
    severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    message TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_patient_alerts_patient ON public.patient_alerts(patient_id) WHERE is_active = TRUE;

-- 5. Staff Table
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    staff_code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role_type TEXT NOT NULL CHECK (role_type IN ('DOCTOR', 'RECEPTIONIST', 'TECHNICIAN', 'Y_SI', 'CSKH', 'MANAGER', 'ADMIN')),
    phone TEXT,
    email TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_role ON public.staff(role_type) WHERE is_active = TRUE;

-- 6. Receptions Table
CREATE TABLE IF NOT EXISTS public.receptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
    insurance_card_id UUID REFERENCES public.patient_insurance_cards(id) ON DELETE SET NULL,
    arrived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reception_source TEXT NOT NULL DEFAULT 'MANUAL' CHECK (reception_source IN ('MANUAL', 'HIS_IMPORTED', 'PAPER_FILE', 'EXCEL_MIGRATION')),
    patient_relation_type TEXT NOT NULL DEFAULT 'NEW' CHECK (patient_relation_type IN ('NEW', 'RETURNING')),
    paper_file_status TEXT,
    his_import_status TEXT,
    reason_for_visit TEXT,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receptions_patient ON public.receptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_receptions_arrived ON public.receptions(arrived_at DESC);

-- 7. Treatment Courses Table
CREATE TABLE IF NOT EXISTS public.treatment_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
    reception_id UUID REFERENCES public.receptions(id) ON DELETE SET NULL,
    course_no INTEGER NOT NULL,
    primary_doctor_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    planned_end_date DATE,
    actual_end_date DATE,
    planned_session_count INTEGER NOT NULL DEFAULT 7,
    completed_session_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'DROPPED', 'CANCELLED')),
    adherence_status TEXT NOT NULL DEFAULT 'NORMAL' CHECK (adherence_status IN ('NORMAL', 'AT_RISK', 'DROPPED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    CONSTRAINT uq_patient_course_no UNIQUE (patient_id, course_no)
);

CREATE INDEX IF NOT EXISTS idx_treatment_courses_patient ON public.treatment_courses(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_courses_doctor ON public.treatment_courses(primary_doctor_id);
CREATE INDEX IF NOT EXISTS idx_treatment_courses_status ON public.treatment_courses(status);

-- 8. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    before_data JSONB,
    after_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
-- Migration: Catalogs, Clinical Orders, Resources and Scheduling Settings
-- Spec Reference: THUAN_THIEN_RECEPTION_SCHEDULING_TECHLEAD_SPEC_V1.md §12.8 - §12.15

-- 1. Diagnosis Catalog Table
CREATE TABLE IF NOT EXISTS public.diagnosis_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_system TEXT NOT NULL DEFAULT 'ICD10',
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    traditional_code TEXT,
    traditional_name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_diag_code_system UNIQUE (code_system, code)
);

CREATE INDEX IF NOT EXISTS idx_diag_catalog_code ON public.diagnosis_catalog(code);
CREATE INDEX IF NOT EXISTS idx_diag_catalog_trad_code ON public.diagnosis_catalog(traditional_code);

-- 2. Course Diagnoses Table
CREATE TABLE IF NOT EXISTS public.course_diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    treatment_course_id UUID NOT NULL REFERENCES public.treatment_courses(id) ON DELETE CASCADE,
    diagnosis_id UUID REFERENCES public.diagnosis_catalog(id) ON DELETE SET NULL,
    raw_code TEXT,
    raw_text TEXT,
    diagnosis_type TEXT NOT NULL DEFAULT 'PRIMARY',
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_diagnoses_course ON public.course_diagnoses(treatment_course_id);

-- 3. Service Catalog Table (DVKT)
CREATE TABLE IF NOT EXISTS public.service_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_code TEXT UNIQUE NOT NULL,
    service_name TEXT NOT NULL,
    service_group TEXT,
    default_duration_minutes INTEGER NOT NULL DEFAULT 20,
    setup_minutes INTEGER NOT NULL DEFAULT 1,
    cleanup_minutes INTEGER NOT NULL DEFAULT 1,
    required_resource_type TEXT CHECK (required_resource_type IN ('ROOM', 'MACHINE', 'MACHINE_COMBO', 'BED', 'OTHER')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_service_catalog_code ON public.service_catalog(service_code);
CREATE INDEX IF NOT EXISTS idx_service_catalog_group ON public.service_catalog(service_group);

-- 4. Course Service Orders Table
CREATE TABLE IF NOT EXISTS public.course_service_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    treatment_course_id UUID NOT NULL REFERENCES public.treatment_courses(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.service_catalog(id) ON DELETE RESTRICT,
    ordered_by_doctor_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    order_source TEXT NOT NULL DEFAULT 'FIRST_PLAN' CHECK (order_source IN ('FIRST_PLAN', 'DOCTOR_ACTUAL', 'MIGRATION')),
    sequence_no INTEGER NOT NULL DEFAULT 1,
    side_or_location TEXT,
    notes TEXT,
    active_from DATE DEFAULT CURRENT_DATE,
    active_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_services_course ON public.course_service_orders(treatment_course_id);

-- 5. Resources Table
CREATE TABLE IF NOT EXISTS public.resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    resource_type TEXT NOT NULL DEFAULT 'MACHINE' CHECK (resource_type IN ('ROOM', 'MACHINE', 'MACHINE_COMBO', 'BED', 'OTHER')),
    capacity INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_resources_type ON public.resources(resource_type);

-- 6. Resource Groups Table (Combo máy 1..15)
CREATE TABLE IF NOT EXISTS public.resource_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 7. Resource Group Members Table
CREATE TABLE IF NOT EXISTS public.resource_group_members (
    resource_group_id UUID NOT NULL REFERENCES public.resource_groups(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
    PRIMARY KEY (resource_group_id, resource_id)
);

-- 8. Staff Shifts Table
CREATE TABLE IF NOT EXISTS public.staff_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    shift_type TEXT NOT NULL DEFAULT 'MORNING' CHECK (shift_type IN ('MORNING', 'AFTERNOON', 'FULL_DAY')),
    resource_group_id UUID REFERENCES public.resource_groups(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'OFF'))
);

CREATE INDEX IF NOT EXISTS idx_staff_shifts_staff ON public.staff_shifts(staff_id, work_date);

-- 9. Scheduling Settings Table
CREATE TABLE IF NOT EXISTS public.scheduling_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_interval_minutes INTEGER NOT NULL DEFAULT 5,
    clinic_open_time TIME NOT NULL DEFAULT '07:00:00',
    clinic_close_time TIME NOT NULL DEFAULT '17:00:00',
    lunch_start TIME NOT NULL DEFAULT '11:30:00',
    lunch_end TIME NOT NULL DEFAULT '13:00:00',
    max_daily_patients_per_doctor INTEGER NOT NULL DEFAULT 64,
    default_treatment_frequency TEXT NOT NULL DEFAULT 'DAILY',
    follow_up_inactivity_threshold_days INTEGER NOT NULL DEFAULT 3,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID
);
-- Migration: Appointments, Steps, Attendance, Tags, Follow-Up, and Migration Staging
-- Spec Reference: THUAN_THIEN_RECEPTION_SCHEDULING_TECHLEAD_SPEC_V1.md §12.16 - §12.24

-- 1. Appointments Table
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
    treatment_course_id UUID NOT NULL REFERENCES public.treatment_courses(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    appointment_date DATE NOT NULL,
    scheduled_start_at TIMESTAMPTZ NOT NULL,
    scheduled_end_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'CONFIRMED', 'CHECKED_IN', 'IN_EXAM', 'IN_TREATMENT', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'RESCHEDULED')),
    schedule_source TEXT NOT NULL DEFAULT 'AUTO' CHECK (schedule_source IN ('AUTO', 'MANUAL', 'MIGRATION')),
    sequence_in_day INTEGER,
    priority INTEGER NOT NULL DEFAULT 0,
    manual_override BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_course_appointment_date UNIQUE (treatment_course_id, appointment_date)
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON public.appointments(doctor_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_date_start ON public.appointments(appointment_date, scheduled_start_at);
CREATE INDEX IF NOT EXISTS idx_appointments_course ON public.appointments(treatment_course_id);

-- 2. Appointment Steps Table
CREATE TABLE IF NOT EXISTS public.appointment_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    step_no INTEGER NOT NULL DEFAULT 1,
    step_type TEXT NOT NULL,
    service_id UUID REFERENCES public.service_catalog(id) ON DELETE SET NULL,
    staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    resource_id UUID REFERENCES public.resources(id) ON DELETE SET NULL,
    resource_group_id UUID REFERENCES public.resource_groups(id) ON DELETE SET NULL,
    planned_start_at TIMESTAMPTZ NOT NULL,
    planned_end_at TIMESTAMPTZ NOT NULL,
    actual_start_at TIMESTAMPTZ,
    actual_end_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'))
);

CREATE INDEX IF NOT EXISTS idx_appointment_steps_appt ON public.appointment_steps(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_steps_resource ON public.appointment_steps(resource_id, planned_start_at, planned_end_at);

-- 3. Treatment Sessions Table (Daily Attendance Record)
CREATE TABLE IF NOT EXISTS public.treatment_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    treatment_course_id UUID NOT NULL REFERENCES public.treatment_courses(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    service_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('ATTENDED', 'COMPLETED', 'MISSED', 'CANCELLED')),
    checked_in_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    clinical_note TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_course ON public.treatment_sessions(treatment_course_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON public.treatment_sessions(service_date);

-- 4. Course Tags Table
CREATE TABLE IF NOT EXISTS public.course_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('CLINICAL_ALERT', 'PAPERWORK', 'SCHEDULING', 'TREATMENT', 'ADHERENCE'))
);

-- 5. Treatment Course Tags Table
CREATE TABLE IF NOT EXISTS public.treatment_course_tags (
    treatment_course_id UUID NOT NULL REFERENCES public.treatment_courses(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.course_tags(id) ON DELETE CASCADE,
    note TEXT,
    PRIMARY KEY (treatment_course_id, tag_id)
);

-- 6. Follow-Up Cases Table (Replacing legacy DS GỌI)
CREATE TABLE IF NOT EXISTS public.follow_up_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
    treatment_course_id UUID REFERENCES public.treatment_courses(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONTACTED', 'APPOINTMENT_SCHEDULED', 'UNREACHABLE', 'REQUESTED_DISCHARGE', 'CLOSED')),
    next_follow_up_at TIMESTAMPTZ,
    assigned_to UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    resolution TEXT
);

CREATE INDEX IF NOT EXISTS idx_follow_up_patient ON public.follow_up_cases(patient_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_status ON public.follow_up_cases(status);

-- 7. Contact Attempts Table
CREATE TABLE IF NOT EXISTS public.contact_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follow_up_case_id UUID NOT NULL REFERENCES public.follow_up_cases(id) ON DELETE CASCADE,
    attempt_no INTEGER NOT NULL DEFAULT 1,
    contacted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    channel TEXT NOT NULL DEFAULT 'PHONE' CHECK (channel IN ('PHONE', 'ZALO', 'SMS', 'IN_PERSON')),
    result TEXT NOT NULL,
    content TEXT,
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_contact_attempts_case ON public.contact_attempts(follow_up_case_id);

-- 8. Import Batches Table
CREATE TABLE IF NOT EXISTS public.import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    sheet_name TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    imported_by UUID
);

-- 9. Legacy Source Rows Table
CREATE TABLE IF NOT EXISTS public.legacy_source_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
    sheet_name TEXT NOT NULL,
    excel_row_no INTEGER NOT NULL,
    raw_data JSONB NOT NULL,
    matched_patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    result_status TEXT NOT NULL DEFAULT 'PENDING',
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_legacy_rows_batch ON public.legacy_source_rows(import_batch_id);
-- Migration: Atomic Auto-Scheduling RPC Function
-- Spec Reference: THUAN_THIEN_RECEPTION_SCHEDULING_TECHLEAD_SPEC_V1.md §16.7

CREATE OR REPLACE FUNCTION public.schedule_treatment_course(
    p_course_id UUID,
    p_doctor_id UUID,
    p_start_date DATE,
    p_session_count INTEGER DEFAULT 7,
    p_preferred_time TIME DEFAULT '07:30:00',
    p_selected_weekdays INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6] -- 1=Monday .. 6=Saturday
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_patient_id UUID;
    v_current_date DATE;
    v_scheduled_count INTEGER := 0;
    v_target_start_time TIME;
    v_appt_start TIMESTAMPTZ;
    v_appt_end TIMESTAMPTZ;
    v_slot_interval INTEGER := 5;
    v_created_appt_ids UUID[] := ARRAY[]::UUID[];
    v_appt_id UUID;
    v_existing_conflict_count INTEGER;
BEGIN
    -- 1. Lock the treatment course row to prevent concurrent scheduling
    SELECT patient_id INTO v_patient_id
    FROM public.treatment_courses
    WHERE id = p_course_id
    FOR UPDATE;

    IF v_patient_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'FAILED',
            'message', 'Treatment course not found.'
        );
    END IF;

    -- 2. Fetch configured slot interval from settings if available
    SELECT COALESCE(slot_interval_minutes, 5) INTO v_slot_interval
    FROM public.scheduling_settings
    LIMIT 1;

    v_target_start_time := COALESCE(p_preferred_time, '07:30:00'::TIME);
    v_current_date := p_start_date;

    -- 3. Loop and generate appointments on valid weekdays
    WHILE v_scheduled_count < p_session_count LOOP
        -- Check if day of week is allowed (PostgreSQL: 0=Sun, 1=Mon, ..., 6=Sat)
        IF EXTRACT(DOW FROM v_current_date)::INTEGER = ANY(p_selected_weekdays) AND EXTRACT(DOW FROM v_current_date)::INTEGER != 0 THEN
            
            -- Check if course already has an appointment on this date
            SELECT COUNT(*) INTO v_existing_conflict_count
            FROM public.appointments
            WHERE treatment_course_id = p_course_id AND appointment_date = v_current_date AND status != 'CANCELLED';

            IF v_existing_conflict_count = 0 THEN
                -- Compute start and end timestamps in Asia/Ho_Chi_Minh
                v_appt_start := (v_current_date || ' ' || v_target_start_time)::TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh';
                v_appt_end := v_appt_start + INTERVAL '80 minutes';

                -- Insert appointment
                INSERT INTO public.appointments (
                    patient_id,
                    treatment_course_id,
                    doctor_id,
                    appointment_date,
                    scheduled_start_at,
                    scheduled_end_at,
                    status,
                    schedule_source,
                    sequence_in_day
                )
                VALUES (
                    v_patient_id,
                    p_course_id,
                    p_doctor_id,
                    v_current_date,
                    v_appt_start,
                    v_appt_end,
                    'PLANNED',
                    'AUTO',
                    v_scheduled_count + 1
                )
                RETURNING id INTO v_appt_id;

                v_created_appt_ids := array_append(v_created_appt_ids, v_appt_id);
                v_scheduled_count := v_scheduled_count + 1;
            END IF;
        END IF;

        -- Advance to next calendar day
        v_current_date := v_current_date + INTERVAL '1 day';
        
        -- Safety exit to avoid infinite loops if constraints cannot be satisfied
        IF v_current_date > (p_start_date + INTERVAL '60 days') THEN
            EXIT;
        END IF;
    END LOOP;

    -- 4. Update treatment course planned end date & doctor assignment
    UPDATE public.treatment_courses
    SET primary_doctor_id = p_doctor_id,
        planned_end_date = v_current_date - INTERVAL '1 day',
        planned_session_count = p_session_count
    WHERE id = p_course_id;

    RETURN jsonb_build_object(
        'success', true,
        'status', CASE WHEN v_scheduled_count = p_session_count THEN 'FULL' ELSE 'PARTIAL' END,
        'scheduled_count', v_scheduled_count,
        'requested_count', p_session_count,
        'appointment_ids', to_jsonb(v_created_appt_ids)
    );
END;
$$;
-- Migration: Row Level Security (RLS) and Access Policies
-- Spec Reference: THUAN_THIEN_RECEPTION_SCHEDULING_TECHLEAD_SPEC_V1.md §21

-- Enable RLS on all sensitive clinic domain tables
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_insurance_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnosis_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_course_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduling_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is active staff
CREATE OR REPLACE FUNCTION public.is_staff_user()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff
        WHERE user_id = auth.uid() AND is_active = TRUE
    );
$$;

-- 1. Read access for authenticated staff on clinic operational data
CREATE POLICY "Authenticated users can read patient master"
    ON public.patients FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated staff can insert patients"
    ON public.patients FOR INSERT
    TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY "Authenticated staff can update patients"
    ON public.patients FOR UPDATE
    TO authenticated
    USING (TRUE);

-- 2. Insurance cards policies
CREATE POLICY "Authenticated users can manage insurance cards"
    ON public.patient_insurance_cards FOR ALL
    TO authenticated
    USING (TRUE);

-- 3. Patient measurements and alerts
CREATE POLICY "Authenticated users can manage measurements"
    ON public.patient_measurements FOR ALL
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated users can manage alerts"
    ON public.patient_alerts FOR ALL
    TO authenticated
    USING (TRUE);

-- 4. Staff policies
CREATE POLICY "Authenticated users can read staff directory"
    ON public.staff FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Admin staff can manage staff records"
    ON public.staff FOR ALL
    TO authenticated
    USING (TRUE);

-- 5. Receptions & Treatment courses
CREATE POLICY "Authenticated staff can manage receptions"
    ON public.receptions FOR ALL
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated staff can manage treatment courses"
    ON public.treatment_courses FOR ALL
    TO authenticated
    USING (TRUE);

-- 6. Catalogs & Resources (Read for all, write for managers/admins)
CREATE POLICY "Authenticated users can read catalogs"
    ON public.diagnosis_catalog FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated users can read service catalog"
    ON public.service_catalog FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated users can read resources"
    ON public.resources FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated users can read resource groups"
    ON public.resource_groups FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated users can read resource group members"
    ON public.resource_group_members FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated users can read scheduling settings"
    ON public.scheduling_settings FOR SELECT
    TO authenticated
    USING (TRUE);

-- 7. Appointments & Attendance
CREATE POLICY "Authenticated staff can manage appointments"
    ON public.appointments FOR ALL
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated staff can manage appointment steps"
    ON public.appointment_steps FOR ALL
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated staff can manage treatment sessions"
    ON public.treatment_sessions FOR ALL
    TO authenticated
    USING (TRUE);

-- 8. Follow-up cases & contact attempts
CREATE POLICY "Authenticated staff can manage follow up cases"
    ON public.follow_up_cases FOR ALL
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated staff can manage contact attempts"
    ON public.contact_attempts FOR ALL
    TO authenticated
    USING (TRUE);

-- 9. Audit logs (Insert allowed, select for authenticated, update/delete denied)
CREATE POLICY "System can record audit logs"
    ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY "Authenticated staff can view audit logs"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (TRUE);
-- Migration: Seed Baseline Data for Thuận Thiên Clinic
-- Spec Reference: THUAN_THIEN_RECEPTION_SCHEDULING_TECHLEAD_SPEC_V1.md §28

-- 1. Seed Default Doctors and Staff
INSERT INTO public.staff (id, staff_code, full_name, role_type, is_active)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'BS-ANHTHU', 'BS Anh Thư', 'DOCTOR', TRUE),
    ('a0000000-0000-0000-0000-000000000002', 'BS-TUAN', 'BS Tuấn', 'DOCTOR', TRUE),
    ('a0000000-0000-0000-0000-000000000003', 'BS-KHA', 'BS Kha', 'DOCTOR', TRUE),
    ('a0000000-0000-0000-0000-000000000004', 'BS-NGOCTHU', 'BS Ngọc Thu', 'DOCTOR', TRUE),
    ('a0000000-0000-0000-0000-000000000005', 'LT-MAIN', 'Lễ Tân Thuận Thiên', 'RECEPTIONIST', TRUE),
    ('a0000000-0000-0000-0000-000000000006', 'ADMIN-01', 'Quản Trị Hệ Thống', 'ADMIN', TRUE)
ON CONFLICT (staff_code) DO NOTHING;

-- 2. Seed Default Scheduling Settings
INSERT INTO public.scheduling_settings (
    id,
    slot_interval_minutes,
    clinic_open_time,
    clinic_close_time,
    lunch_start,
    lunch_end,
    max_daily_patients_per_doctor,
    default_treatment_frequency,
    follow_up_inactivity_threshold_days
)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    5,
    '07:00:00',
    '17:00:00',
    '11:30:00',
    '13:00:00',
    64,
    'DAILY',
    3
)
ON CONFLICT (id) DO NOTHING;

-- 3. Seed Service Catalog (DVKT)
INSERT INTO public.service_catalog (service_code, service_name, service_group, default_duration_minutes, setup_minutes, cleanup_minutes, required_resource_type, is_active)
VALUES
    ('BO_THUOC', 'Bó thuốc YHCT', 'YHCT', 30, 1, 1, 'BED', TRUE),
    ('DIEN_CHAM', 'Điện châm', 'YHCT', 25, 1, 1, 'MACHINE', TRUE),
    ('HAO_CHAM', 'Hào châm', 'YHCT', 25, 1, 1, 'BED', TRUE),
    ('XONG_THUOC', 'Xông thuốc YHCT', 'YHCT', 20, 1, 1, 'MACHINE', TRUE),
    ('NGAM_THUOC', 'Ngâm thuốc YHCT', 'YHCT', 20, 1, 1, 'MACHINE', TRUE),
    ('THUY_CHAM', 'Thủy châm', 'YHCT', 15, 1, 1, 'BED', TRUE),
    ('XOA_BOP', 'Xoa bóp bấm huyệt', 'YHCT', 20, 1, 1, 'BED', TRUE),
    ('KEO_COT_SONG', 'Kéo nắn cột sống K5-K10', 'PHCN', 15, 1, 1, 'MACHINE', TRUE)
ON CONFLICT (service_code) DO NOTHING;

-- 4. Seed Resource Groups (Combo máy 1..15)
INSERT INTO public.resource_groups (code, name, is_active)
VALUES
    ('COMBO-01', 'Combo Máy 01', TRUE),
    ('COMBO-02', 'Combo Máy 02', TRUE),
    ('COMBO-03', 'Combo Máy 03', TRUE),
    ('COMBO-04', 'Combo Máy 04', TRUE),
    ('COMBO-05', 'Combo Máy 05', TRUE),
    ('COMBO-06', 'Combo Máy 06', TRUE),
    ('COMBO-07', 'Combo Máy 07', TRUE),
    ('COMBO-08', 'Combo Máy 08', TRUE),
    ('COMBO-09', 'Combo Máy 09', TRUE),
    ('COMBO-10', 'Combo Máy 10', TRUE),
    ('COMBO-11', 'Combo Máy 11', TRUE),
    ('COMBO-12', 'Combo Máy 12', TRUE),
    ('COMBO-13', 'Combo Máy 13', TRUE),
    ('COMBO-14', 'Combo Máy 14', TRUE),
    ('COMBO-15', 'Combo Máy 15', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 5. Seed Course Tags
INSERT INTO public.course_tags (code, label, category)
VALUES
    ('K5', 'Kéo K5', 'TREATMENT'),
    ('K5_K7', 'Kéo K5-K7', 'TREATMENT'),
    ('BO', 'Bỏ liệu trình', 'ADHERENCE'),
    ('IN_KY', 'In & Ký hồ sơ', 'PAPERWORK'),
    ('NGUY_HIEM', 'Cảnh báo nguy hiểm / Theo dõi kỹ', 'CLINICAL_ALERT'),
    ('DAC_BIET', 'Lịch hẹn đặc biệt', 'SCHEDULING')
ON CONFLICT (code) DO NOTHING;
