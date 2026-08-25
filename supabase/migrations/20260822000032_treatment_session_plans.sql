-- Migration: Treatment Session Occurrence Plans & Same-Course Appointment Integrity
-- Spec Reference: GOAL CLINICAL-SERVICE-PLAN1

-- 1. Table: treatment_session_plans (Occurrence Plan Headers 1..N)
CREATE TABLE IF NOT EXISTS public.treatment_session_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    treatment_course_id UUID NOT NULL REFERENCES public.treatment_courses(id) ON DELETE RESTRICT,
    session_number INTEGER NOT NULL CHECK (session_number > 0),
    planned_by_doctor_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_treatment_session_plan UNIQUE (treatment_course_id, session_number),
    CONSTRAINT uq_treatment_session_plan_identity UNIQUE (id, treatment_course_id)
);

-- 2. Table: treatment_session_plan_services (Discrete Planned Services)
CREATE TABLE IF NOT EXISTS public.treatment_session_plan_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_plan_id UUID NOT NULL REFERENCES public.treatment_session_plans(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.service_catalog(id) ON DELETE RESTRICT,
    sequence_no INTEGER NOT NULL DEFAULT 1 CHECK (sequence_no > 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_session_plan_service UNIQUE (session_plan_id, service_id),
    CONSTRAINT uq_session_plan_service_seq UNIQUE (session_plan_id, sequence_no)
);

-- 3. Add treatment_session_plan_id with Composite FK on appointments
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS treatment_session_plan_id UUID;

ALTER TABLE public.appointments
    ADD CONSTRAINT fk_appointments_session_plan_same_course
    FOREIGN KEY (treatment_session_plan_id, treatment_course_id)
    REFERENCES public.treatment_session_plans(id, treatment_course_id)
    ON DELETE RESTRICT;

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_session_plans_course 
    ON public.treatment_session_plans(treatment_course_id);

CREATE INDEX IF NOT EXISTS idx_session_plan_services_plan 
    ON public.treatment_session_plan_services(session_plan_id);

CREATE INDEX IF NOT EXISTS idx_appointments_session_plan 
    ON public.appointments(treatment_session_plan_id);

-- 5. Active and Completed Appointment Uniqueness Guard
-- CANCELLED and NO_SHOW release the plan; COMPLETED and active states permanently consume it.
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_or_completed_appointment_session_plan
    ON public.appointments(treatment_session_plan_id)
    WHERE treatment_session_plan_id IS NOT NULL
      AND status NOT IN ('CANCELLED', 'NO_SHOW');

-- 6. Row Level Security
ALTER TABLE public.treatment_session_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_session_plan_services ENABLE ROW LEVEL SECURITY;

-- 7. Explicit Least-Privilege Grants & Revokes
REVOKE ALL ON TABLE public.treatment_session_plans FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.treatment_session_plan_services FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE public.treatment_session_plans TO service_role;
GRANT SELECT ON TABLE public.treatment_session_plan_services TO service_role;
