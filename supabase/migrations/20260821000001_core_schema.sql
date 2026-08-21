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
