-- Migration: Doctor Clinical Notes
-- Spec Reference: CURRENT_GOAL = DOCTOR-CLINICAL-NOTES1

-- 1. Table: clinical_notes
CREATE TABLE IF NOT EXISTS public.clinical_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
    treatment_course_id UUID REFERENCES public.treatment_courses(id) ON DELETE SET NULL,
    reception_id UUID REFERENCES public.receptions(id) ON DELETE SET NULL,
    author_staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Performance and Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_clinical_notes_patient_created
    ON public.clinical_notes(patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clinical_notes_course
    ON public.clinical_notes(treatment_course_id, created_at DESC)
    WHERE treatment_course_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_notes_clinic
    ON public.clinical_notes(clinic_id, created_at DESC);

-- 3. Row Level Security
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;

-- 4. Tenant & Active Clinic Scoped SELECT Policy
CREATE POLICY "Allow authenticated staff read clinical_notes"
    ON public.clinical_notes FOR SELECT
    TO authenticated
    USING (
        clinic_id IN (
            SELECT scm.clinic_id
            FROM public.staff_clinic_memberships scm
            JOIN public.staff s ON s.id = scm.staff_id
            WHERE s.user_id = auth.uid()
              AND scm.is_active = TRUE
              AND s.is_active = TRUE
        )
    );

-- 5. Doctor-Only INSERT Policy
CREATE POLICY "Allow authenticated doctors insert clinical_notes"
    ON public.clinical_notes FOR INSERT
    TO authenticated
    WITH CHECK (
        clinic_id IN (
            SELECT scr.clinic_id
            FROM public.staff_clinic_roles scr
            JOIN public.staff s ON s.id = scr.staff_id
            JOIN public.staff_clinic_memberships scm ON scm.staff_id = s.id AND scm.clinic_id = scr.clinic_id
            WHERE s.user_id = auth.uid()
              AND scr.role_code = 'DOCTOR'
              AND scm.is_active = TRUE
              AND s.is_active = TRUE
        )
    );
