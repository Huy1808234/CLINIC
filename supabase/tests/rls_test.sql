-- Supabase DB Test: Row Level Security (RLS) Verification
-- Spec Reference: THUAN_THIEN_RECEPTION_SCHEDULING_TECHLEAD_SPEC_V1.md §21

BEGIN;

-- 1. Verify RLS is enabled on all required tables
DO $$
DECLARE
    v_missing_rls_tables TEXT[];
BEGIN
    SELECT array_agg(tablename::TEXT)
    INTO v_missing_rls_tables
    FROM pg_tables
    WHERE schemaname = 'public'
      AND rowsecurity = FALSE
      AND tablename IN (
          'patients',
          'patient_insurance_cards',
          'patient_measurements',
          'patient_alerts',
          'staff',
          'receptions',
          'treatment_courses',
          'course_diagnoses',
          'course_service_orders',
          'appointments',
          'treatment_sessions',
          'follow_up_cases',
          'audit_logs'
      );

    IF v_missing_rls_tables IS NOT NULL AND array_length(v_missing_rls_tables, 1) > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Tables missing RLS: %', v_missing_rls_tables;
    ELSE
        RAISE NOTICE 'TEST PASSED: All sensitive tables have Row Level Security enabled.';
    END IF;
END;
$$;

ROLLBACK;
