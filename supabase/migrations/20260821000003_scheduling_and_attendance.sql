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
