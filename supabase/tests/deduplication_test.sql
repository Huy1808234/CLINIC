-- Supabase DB Test: Patient Uniqueness Strategy
-- Spec Reference: THUAN_THIEN_RECEPTION_SCHEDULING_TECHLEAD_SPEC_V1.md §2.1, §3.2

BEGIN;

-- 1. Patient Code uniqueness test
INSERT INTO public.patients (id, patient_code, full_name, citizen_id)
VALUES ('d0000000-0000-0000-0000-000000000001', 'BN-0001', 'Nguyễn Văn A', '082068001773');

DO $$
BEGIN
    INSERT INTO public.patients (id, patient_code, full_name)
    VALUES ('d0000000-0000-0000-0000-000000000002', 'BN-0001', 'Nguyễn Văn B');
    RAISE EXCEPTION 'TEST FAILED: Duplicate patient_code allowed!';
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'TEST PASSED: patient_code uniqueness enforced.';
END;
$$;

-- 2. Citizen ID (CCCD) partial uniqueness test
DO $$
BEGIN
    INSERT INTO public.patients (id, patient_code, full_name, citizen_id)
    VALUES ('d0000000-0000-0000-0000-000000000003', 'BN-0002', 'Nguyễn Văn C', '082068001773');
    RAISE EXCEPTION 'TEST FAILED: Duplicate citizen_id allowed!';
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'TEST PASSED: citizen_id uniqueness enforced.';
END;
$$;

-- 3. Null citizen_id allowed multiple times
INSERT INTO public.patients (id, patient_code, full_name, citizen_id)
VALUES
    ('d0000000-0000-0000-0000-000000000004', 'BN-0003', 'Bệnh Nhân Không CCCD 1', NULL),
    ('d0000000-0000-0000-0000-000000000005', 'BN-0004', 'Bệnh Nhân Không CCCD 2', NULL);

RAISE NOTICE 'TEST PASSED: Multiple NULL citizen_id records allowed.';

ROLLBACK;
