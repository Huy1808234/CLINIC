-- Migration: Add Treatment Session unique appointment invariant and explicit clinical performer provenance
-- Spec Reference: GOAL SESSION-GOV1B1 — Database Foundation for Atomic Session Completion

-- 1. Enforce at most one Treatment Session per non-null Appointment
CREATE UNIQUE INDEX IF NOT EXISTS uq_treatment_sessions_appointment_id
ON public.treatment_sessions(appointment_id)
WHERE appointment_id IS NOT NULL;

-- 2. Add explicit clinical performer Staff FK column (nullable, ON DELETE RESTRICT)
ALTER TABLE public.treatment_sessions
ADD COLUMN IF NOT EXISTS performed_by_staff_id UUID NULL REFERENCES public.staff(id) ON DELETE RESTRICT;

-- 3. Create index on performed_by_staff_id for query performance
CREATE INDEX IF NOT EXISTS idx_treatment_sessions_performed_by_staff_id
ON public.treatment_sessions(performed_by_staff_id);
