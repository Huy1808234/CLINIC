-- Supabase DB Test: Schedule Uniqueness and Conflict Protection
-- Spec Reference: THUAN_THIEN_RECEPTION_SCHEDULING_TECHLEAD_SPEC_V1.md §17.1

BEGIN;

-- Setup test patient & course
INSERT INTO public.patients (id, patient_code, full_name)
VALUES ('c0000000-0000-0000-0000-000000000001', 'TEST-BN01', 'Bệnh Nhân Test Conflict');

INSERT INTO public.treatment_courses (id, patient_id, course_no, start_date, planned_session_count)
VALUES ('c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 1, CURRENT_DATE, 5);

-- 1. First appointment on date
INSERT INTO public.appointments (
    patient_id,
    treatment_course_id,
    appointment_date,
    scheduled_start_at,
    status
)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000002',
    CURRENT_DATE,
    NOW(),
    'PLANNED'
);

-- 2. Second appointment for same course on same date must fail unique constraint
DO $$
BEGIN
    INSERT INTO public.appointments (
        patient_id,
        treatment_course_id,
        appointment_date,
        scheduled_start_at,
        status
    )
    VALUES (
        'c0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000002',
        CURRENT_DATE,
        NOW() + INTERVAL '2 hours',
        'PLANNED'
    );
    RAISE EXCEPTION 'TEST FAILED: Unique constraint uq_course_appointment_date did not trigger!';
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'TEST PASSED: uq_course_appointment_date successfully prevented duplicate appointments on same date.';
END;
$$;

ROLLBACK;
