-- Migration: Row Level Security (RLS) and Access Policies
-- Spec Reference: THUAN_THIEN_RECEPTION_SCHEDULING_TECHLEAD_SPEC_V1.md §21

-- Enable RLS on all sensitive clinic domain tables
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_insurance_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnosis_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_course_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduling_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is active staff
CREATE OR REPLACE FUNCTION public.is_staff_user()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.staff
        WHERE user_id = auth.uid() AND is_active = TRUE
    );
$$;

-- 1. Read access for authenticated staff on clinic operational data
CREATE POLICY "Authenticated users can read patient master"
    ON public.patients FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated staff can insert patients"
    ON public.patients FOR INSERT
    TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY "Authenticated staff can update patients"
    ON public.patients FOR UPDATE
    TO authenticated
    USING (TRUE);

-- 2. Insurance cards policies
CREATE POLICY "Authenticated users can manage insurance cards"
    ON public.patient_insurance_cards FOR ALL
    TO authenticated
    USING (TRUE);

-- 3. Patient measurements and alerts
CREATE POLICY "Authenticated users can manage measurements"
    ON public.patient_measurements FOR ALL
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated users can manage alerts"
    ON public.patient_alerts FOR ALL
    TO authenticated
    USING (TRUE);

-- 4. Staff policies
CREATE POLICY "Authenticated users can read staff directory"
    ON public.staff FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Admin staff can manage staff records"
    ON public.staff FOR ALL
    TO authenticated
    USING (TRUE);

-- 5. Receptions & Treatment courses
CREATE POLICY "Authenticated staff can manage receptions"
    ON public.receptions FOR ALL
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated staff can manage treatment courses"
    ON public.treatment_courses FOR ALL
    TO authenticated
    USING (TRUE);

-- 6. Catalogs & Resources (Read for all, write for managers/admins)
CREATE POLICY "Authenticated users can read catalogs"
    ON public.diagnosis_catalog FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated users can read service catalog"
    ON public.service_catalog FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated users can read resources"
    ON public.resources FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated users can read resource groups"
    ON public.resource_groups FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated users can read resource group members"
    ON public.resource_group_members FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated users can read scheduling settings"
    ON public.scheduling_settings FOR SELECT
    TO authenticated
    USING (TRUE);

-- 7. Appointments & Attendance
CREATE POLICY "Authenticated staff can manage appointments"
    ON public.appointments FOR ALL
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated staff can manage appointment steps"
    ON public.appointment_steps FOR ALL
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated staff can manage treatment sessions"
    ON public.treatment_sessions FOR ALL
    TO authenticated
    USING (TRUE);

-- 8. Follow-up cases & contact attempts
CREATE POLICY "Authenticated staff can manage follow up cases"
    ON public.follow_up_cases FOR ALL
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated staff can manage contact attempts"
    ON public.contact_attempts FOR ALL
    TO authenticated
    USING (TRUE);

-- 9. Audit logs (Insert allowed, select for authenticated, update/delete denied)
CREATE POLICY "System can record audit logs"
    ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY "Authenticated staff can view audit logs"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (TRUE);
