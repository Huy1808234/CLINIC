-- Migration: Harden Clinical Template RLS & Tenant Isolation
-- Spec Reference: CURRENT_GOAL = TT06-TEMPLATE-RLS-FIX1

-- 1. Drop existing permissive policies
DROP POLICY IF EXISTS "Allow anon read clinical_diagnosis_templates" ON public.clinical_diagnosis_templates;
DROP POLICY IF EXISTS "Allow anon read clinical_diagnosis_template_items" ON public.clinical_diagnosis_template_items;
DROP POLICY IF EXISTS "Allow anon read clinical_template_cycle_codings" ON public.clinical_template_cycle_codings;

DROP POLICY IF EXISTS "Allow authenticated read clinical_diagnosis_templates" ON public.clinical_diagnosis_templates;
DROP POLICY IF EXISTS "Allow authenticated read clinical_diagnosis_template_items" ON public.clinical_diagnosis_template_items;
DROP POLICY IF EXISTS "Allow authenticated read clinical_template_cycle_codings" ON public.clinical_template_cycle_codings;

-- 2. Ensure RLS is enabled on all 3 tables
ALTER TABLE public.clinical_diagnosis_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_diagnosis_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_template_cycle_codings ENABLE ROW LEVEL SECURITY;

-- 3. Tenant-isolated Authenticated SELECT on clinical_diagnosis_templates
CREATE POLICY "Allow authenticated org staff read clinical_diagnosis_templates"
    ON public.clinical_diagnosis_templates FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT c.organization_id
            FROM public.staff s
            JOIN public.staff_clinic_memberships scm ON scm.staff_id = s.id
            JOIN public.clinics c ON c.id = scm.clinic_id
            WHERE s.user_id = auth.uid()
              AND s.is_active = TRUE
              AND scm.is_active = TRUE
              AND c.is_active = TRUE
        )
    );

-- 4. Tenant-isolated Authenticated SELECT on clinical_diagnosis_template_items
CREATE POLICY "Allow authenticated org staff read clinical_diagnosis_template_items"
    ON public.clinical_diagnosis_template_items FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.clinical_diagnosis_templates t
            JOIN public.clinics c ON c.organization_id = t.organization_id
            JOIN public.staff_clinic_memberships scm ON scm.clinic_id = c.id
            JOIN public.staff s ON s.id = scm.staff_id
            WHERE t.id = clinical_diagnosis_template_items.template_id
              AND s.user_id = auth.uid()
              AND s.is_active = TRUE
              AND scm.is_active = TRUE
              AND c.is_active = TRUE
        )
    );

-- 5. Tenant-isolated Authenticated SELECT on clinical_template_cycle_codings
CREATE POLICY "Allow authenticated org staff read clinical_template_cycle_codings"
    ON public.clinical_template_cycle_codings FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.clinical_diagnosis_template_items i
            JOIN public.clinical_diagnosis_templates t ON t.id = i.template_id
            JOIN public.clinics c ON c.organization_id = t.organization_id
            JOIN public.staff_clinic_memberships scm ON scm.clinic_id = c.id
            JOIN public.staff s ON s.id = scm.staff_id
            WHERE i.id = clinical_template_cycle_codings.template_item_id
              AND s.user_id = auth.uid()
              AND s.is_active = TRUE
              AND scm.is_active = TRUE
              AND c.is_active = TRUE
        )
    );
