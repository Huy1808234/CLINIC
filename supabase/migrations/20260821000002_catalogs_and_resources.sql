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
