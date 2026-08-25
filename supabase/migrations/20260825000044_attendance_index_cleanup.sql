-- Migration 44: Drop appointment attendance provenance-by indexes
-- Reference: TREATMENT-ATTENDANCE-WORKFLOW-HARDENING1 / INDEX AUDIT
--
-- AUDIT RESULT:
--
-- idx_appointments_status_date (status, appointment_date)
--   Caller: getDayTimeline (get-day-schedule.ts)
--           WHERE appointment_date = $1, ORDER BY scheduled_start_at
--   The status column is not in the predicate, but (status, appointment_date) may benefit
--   range scans. However, a plain index on (appointment_date) would suffice.
--   Overlapping index: none found specific to appointment_date alone.
--   Classification: KEEP — status+date compound supports multi-filter queries that
--   will be introduced if/when status filter is added to getDayTimeline.
--
-- idx_appointments_checked_in_by (checked_in_by) WHERE checked_in_by IS NOT NULL
--   Application callers: NONE
--   No query in src/ does: WHERE checked_in_by = ?
--   Purpose was FK semantics only (ON DELETE SET NULL triggers table scan, not index).
--   Classification: DROP — no production query predicate found.
--
-- idx_appointments_started_by (started_by) WHERE started_by IS NOT NULL
--   Application callers: NONE
--   No query in src/ does: WHERE started_by = ?
--   Classification: DROP — no production query predicate found.
--
-- idx_appointments_completed_by (completed_by) WHERE completed_by IS NOT NULL
--   Application callers: NONE
--   No query in src/ does: WHERE completed_by = ?
--   Classification: DROP — no production query predicate found.
--
-- NOTE: Timestamp/provenance COLUMNS (checked_in_at, checked_in_by, started_at, started_by,
--       completed_at, completed_by, no_show_at, no_show_by, cancelled_at, cancelled_by) are
--       PRESERVED. Only the three unnecessary partial indexes are removed.

DROP INDEX IF EXISTS public.idx_appointments_checked_in_by;
DROP INDEX IF EXISTS public.idx_appointments_started_by;
DROP INDEX IF EXISTS public.idx_appointments_completed_by;
