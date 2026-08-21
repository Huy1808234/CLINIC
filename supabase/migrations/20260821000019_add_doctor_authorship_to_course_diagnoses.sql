-- Migration: Add Doctor Authorship to Course Diagnoses
-- Spec Reference: GOAL CLINICAL1A1 — Secure Doctor Diagnosis Authorship

ALTER TABLE public.course_diagnoses
    ADD COLUMN diagnosed_by_doctor_id UUID NULL
    REFERENCES public.staff(id)
    ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_course_diagnoses_doctor
    ON public.course_diagnoses(diagnosed_by_doctor_id);
