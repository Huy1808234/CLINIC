-- Migration: Add Clinic Ownership to Receptions and Treatment Courses
-- Spec Reference: GOAL AUTH1.7D2A — Operational Multi-Clinic Data Partitioning

-- 1. Add clinic_id column to public.receptions
ALTER TABLE public.receptions
    ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id) ON DELETE RESTRICT;

-- Index for clinic-scoped queries and RLS
CREATE INDEX IF NOT EXISTS idx_receptions_clinic ON public.receptions(clinic_id);

-- 2. Add clinic_id column to public.treatment_courses
ALTER TABLE public.treatment_courses
    ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id) ON DELETE RESTRICT;

-- Index for clinic-scoped queries and RLS
CREATE INDEX IF NOT EXISTS idx_treatment_courses_clinic ON public.treatment_courses(clinic_id);

-- 3. Reception <-> Treatment Course Clinic Consistency
-- Create composite unique constraint on (id, clinic_id) in receptions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_receptions_id_clinic'
    ) THEN
        ALTER TABLE public.receptions
            ADD CONSTRAINT uq_receptions_id_clinic UNIQUE (id, clinic_id);
    END IF;
END $$;

-- Enforce composite foreign key on (reception_id, clinic_id) in treatment_courses
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_treatment_courses_reception_clinic'
    ) THEN
        ALTER TABLE public.treatment_courses
            ADD CONSTRAINT fk_treatment_courses_reception_clinic
            FOREIGN KEY (reception_id, clinic_id)
            REFERENCES public.receptions(id, clinic_id)
            ON DELETE SET NULL;
    END IF;
END $$;
