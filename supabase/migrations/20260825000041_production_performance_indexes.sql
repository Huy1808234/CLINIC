-- ==============================================================================
-- Migration: 20260825000041_production_performance_indexes.sql
-- Goal: PERF-QUERY-INDEX-PRODUCTION-HARDENING1
-- Description: Production PostgreSQL composite indexes matching proven hot query access patterns
-- ==============================================================================

-- 1. Receptions Queue & Patient History Composite Indexes
-- Query: WHERE clinic_id = ? AND arrived_at >= ? AND arrived_at < ? ORDER BY arrived_at DESC
CREATE INDEX IF NOT EXISTS idx_receptions_clinic_arrived 
ON public.receptions(clinic_id, arrived_at DESC);

-- Query: WHERE patient_id = ? ORDER BY registered_at DESC
CREATE INDEX IF NOT EXISTS idx_receptions_patient_registered 
ON public.receptions(patient_id, registered_at DESC);

-- 2. Treatment Courses Composite Index
-- Query: WHERE patient_id = ? AND clinic_id = ? ORDER BY course_no DESC
CREATE INDEX IF NOT EXISTS idx_treatment_courses_patient_clinic_course_no 
ON public.treatment_courses(patient_id, clinic_id, course_no DESC);

-- 3. Appointments Schedule & History Composite Indexes
-- Query: WHERE appointment_date BETWEEN ? AND ? ORDER BY scheduled_start_at ASC
CREATE INDEX IF NOT EXISTS idx_appointments_date_start 
ON public.appointments(appointment_date, scheduled_start_at);

-- Query: WHERE patient_id = ? ORDER BY appointment_date DESC
CREATE INDEX IF NOT EXISTS idx_appointments_patient_date 
ON public.appointments(patient_id, appointment_date DESC);

-- 4. Course Service Orders Sequence Composite Index
-- Query: WHERE treatment_course_id IN (...) ORDER BY sequence_no ASC
CREATE INDEX IF NOT EXISTS idx_course_service_orders_course_seq 
ON public.course_service_orders(treatment_course_id, sequence_no ASC);

-- 5. Treatment Sessions Date Composite Index
-- Query: WHERE treatment_course_id IN (...) ORDER BY service_date DESC
CREATE INDEX IF NOT EXISTS idx_treatment_sessions_course_date 
ON public.treatment_sessions(treatment_course_id, service_date DESC);

-- 6. Patients Deterministic Pagination Composite Index
-- Query: ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?
CREATE INDEX IF NOT EXISTS idx_patients_created_id 
ON public.patients(created_at DESC, id DESC);
