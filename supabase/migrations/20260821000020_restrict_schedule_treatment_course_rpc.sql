-- Migration: Restrict schedule_treatment_course RPC to service_role and set safe search_path
-- Spec Reference: GOAL SCHED-GOV1A — Harden Database Execution Boundary

-- 1. Explicitly revoke execute from PUBLIC, anon, and authenticated
REVOKE ALL ON FUNCTION public.schedule_treatment_course(UUID, UUID, DATE, INTEGER, TIME, INTEGER[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_treatment_course(UUID, UUID, DATE, INTEGER, TIME, INTEGER[]) FROM anon;
REVOKE ALL ON FUNCTION public.schedule_treatment_course(UUID, UUID, DATE, INTEGER, TIME, INTEGER[]) FROM authenticated;

-- 2. Explicitly grant execute ONLY to service_role
GRANT EXECUTE ON FUNCTION public.schedule_treatment_course(UUID, UUID, DATE, INTEGER, TIME, INTEGER[]) TO service_role;

-- 3. Fix SECURITY DEFINER search_path to prevent schema hijacking
ALTER FUNCTION public.schedule_treatment_course(UUID, UUID, DATE, INTEGER, TIME, INTEGER[])
    SET search_path = public, pg_temp;
