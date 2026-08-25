-- ==============================================================================
-- Migration: 20260825000042_performance_index_corrections.sql
-- Goal: PERF-PRODUCTION-EVIDENCE-INDEX-FINAL1
-- Description: Production PostgreSQL composite index corrections and redundant index cleanup
-- ==============================================================================

-- 1. Replace treatment_courses composite index to match actual query:
-- Query: WHERE patient_id = ? ORDER BY course_no DESC
-- (removes intermediate clinic_id that prevented B-tree sort usage for cross-clinic patient chart)
DROP INDEX IF EXISTS idx_treatment_courses_patient_clinic_course_no;
DROP INDEX IF EXISTS idx_treatment_courses_patient;

CREATE INDEX IF NOT EXISTS idx_treatment_courses_patient_course_no 
ON public.treatment_courses(patient_id, course_no DESC);

-- 2. Drop redundant single-column index on course_service_orders 
-- (idx_course_service_orders_course_seq on (treatment_course_id, sequence_no ASC) already covers treatment_course_id prefix)
DROP INDEX IF EXISTS idx_course_services_course;
