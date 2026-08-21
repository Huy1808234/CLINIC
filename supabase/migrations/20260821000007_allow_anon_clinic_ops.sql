-- Migration: Allow public/anon role access for internal clinic operations and server components
-- Spec Reference: THUAN_THIEN_RECEPTION_SCHEDULING_TECHLEAD_SPEC_V1.md

-- Patients
CREATE POLICY "Anon can manage patients"
    ON public.patients FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

-- Insurance Cards
CREATE POLICY "Anon can manage insurance cards"
    ON public.patient_insurance_cards FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

-- Measurements
CREATE POLICY "Anon can manage measurements"
    ON public.patient_measurements FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

-- Alerts
CREATE POLICY "Anon can manage alerts"
    ON public.patient_alerts FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

-- Staff
CREATE POLICY "Anon can read staff"
    ON public.staff FOR SELECT
    TO anon
    USING (TRUE);

-- Receptions
CREATE POLICY "Anon can manage receptions"
    ON public.receptions FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

-- Treatment Courses
CREATE POLICY "Anon can manage treatment courses"
    ON public.treatment_courses FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

-- Course Diagnoses
CREATE POLICY "Anon can manage course diagnoses"
    ON public.course_diagnoses FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

-- Course Service Orders
CREATE POLICY "Anon can manage course service orders"
    ON public.course_service_orders FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

-- Diagnosis Catalog
CREATE POLICY "Anon can read diagnosis catalog"
    ON public.diagnosis_catalog FOR SELECT
    TO anon
    USING (TRUE);

-- Service Catalog
CREATE POLICY "Anon can read service catalog"
    ON public.service_catalog FOR SELECT
    TO anon
    USING (TRUE);

-- Resources
CREATE POLICY "Anon can read resources"
    ON public.resources FOR SELECT
    TO anon
    USING (TRUE);

-- Resource Groups
CREATE POLICY "Anon can read resource groups"
    ON public.resource_groups FOR SELECT
    TO anon
    USING (TRUE);

-- Resource Group Members
CREATE POLICY "Anon can read resource group members"
    ON public.resource_group_members FOR SELECT
    TO anon
    USING (TRUE);

-- Staff Shifts
CREATE POLICY "Anon can read staff shifts"
    ON public.staff_shifts FOR SELECT
    TO anon
    USING (TRUE);

-- Appointments
CREATE POLICY "Anon can manage appointments"
    ON public.appointments FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

-- Appointment Steps
CREATE POLICY "Anon can manage appointment steps"
    ON public.appointment_steps FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

-- Treatment Sessions
CREATE POLICY "Anon can manage treatment sessions"
    ON public.treatment_sessions FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

-- Course Tags
CREATE POLICY "Anon can read course tags"
    ON public.course_tags FOR SELECT
    TO anon
    USING (TRUE);

-- Treatment Course Tags
CREATE POLICY "Anon can manage treatment course tags"
    ON public.treatment_course_tags FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

-- Follow Up Cases
CREATE POLICY "Anon can manage follow up cases"
    ON public.follow_up_cases FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

-- Contact Attempts
CREATE POLICY "Anon can manage contact attempts"
    ON public.contact_attempts FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

-- Scheduling Settings
CREATE POLICY "Anon can read scheduling settings"
    ON public.scheduling_settings FOR SELECT
    TO anon
    USING (TRUE);

-- Import Batches
CREATE POLICY "Anon can manage import batches"
    ON public.import_batches FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

-- Legacy Source Rows
CREATE POLICY "Anon can manage legacy source rows"
    ON public.legacy_source_rows FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

-- Audit Logs
CREATE POLICY "Anon can insert audit logs"
    ON public.audit_logs FOR INSERT
    TO anon
    WITH CHECK (TRUE);
