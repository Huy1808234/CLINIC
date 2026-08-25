-- Migration: Staff Clinic Preferences (Persist Last Selected Clinic)
-- Spec Reference: GOAL UI-CLINIC-SELECTION-UX1

-- 1. Create staff_preferences Table
CREATE TABLE IF NOT EXISTS public.staff_preferences (
    staff_id UUID PRIMARY KEY REFERENCES public.staff(id) ON DELETE CASCADE,
    last_selected_clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
    last_selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Index for clinic reference lookups
CREATE INDEX IF NOT EXISTS idx_staff_preferences_clinic ON public.staff_preferences(last_selected_clinic_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.staff_preferences ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Anon can manage staff_preferences"
    ON public.staff_preferences FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "Authenticated can manage staff_preferences"
    ON public.staff_preferences FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

COMMENT ON TABLE public.staff_preferences IS 'Stores persistent individual staff preferences including last selected clinic workspace.';
