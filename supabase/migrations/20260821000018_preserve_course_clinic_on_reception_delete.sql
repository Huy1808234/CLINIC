-- Migration: Preserve Treatment Course Clinic Ownership on Reception Deletion
-- Spec Reference: GOAL AUTH1.7D2A-FIX1 — Fix TreatmentCourse -> Reception Composite FK Delete Behavior

-- 1. Drop the whole-composite SET NULL foreign key constraint
ALTER TABLE public.treatment_courses
    DROP CONSTRAINT IF EXISTS fk_treatment_courses_reception_clinic;

-- 2. Re-create composite foreign key with column-specific SET NULL on reception_id ONLY
-- This ensures that deleting/unlinking a parent Reception clears reception_id while preserving treatment_courses.clinic_id
ALTER TABLE public.treatment_courses
    ADD CONSTRAINT fk_treatment_courses_reception_clinic
    FOREIGN KEY (reception_id, clinic_id)
    REFERENCES public.receptions(id, clinic_id)
    ON DELETE SET NULL (reception_id);
