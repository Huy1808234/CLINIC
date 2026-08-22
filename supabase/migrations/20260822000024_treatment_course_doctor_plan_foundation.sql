-- Migration: Treatment Course Doctor Plan Foundation
-- Spec Reference: GOAL CLINICAL1C1 — Nullable treatment plan with Doctor provenance (planned_by_doctor_id, planned_at)

-- 1. Drop DEFAULT 7 and remove NOT NULL from planned_session_count
ALTER TABLE public.treatment_courses
    ALTER COLUMN planned_session_count DROP DEFAULT,
    ALTER COLUMN planned_session_count DROP NOT NULL;

-- 2. Add CHECK constraint ensuring non-null planned_session_count is strictly positive
ALTER TABLE public.treatment_courses
    ADD CONSTRAINT chk_treatment_courses_planned_session_count_positive
    CHECK (planned_session_count IS NULL OR planned_session_count > 0);

-- 3. Add Doctor plan provenance columns
ALTER TABLE public.treatment_courses
    ADD COLUMN planned_by_doctor_id UUID NULL
        REFERENCES public.staff(id)
        ON DELETE RESTRICT,
    ADD COLUMN planned_at TIMESTAMPTZ NULL;

-- 4. Create index on planned_by_doctor_id for efficient doctor auditing/queries
CREATE INDEX idx_treatment_courses_planned_by_doctor_id
    ON public.treatment_courses(planned_by_doctor_id)
    WHERE planned_by_doctor_id IS NOT NULL;
