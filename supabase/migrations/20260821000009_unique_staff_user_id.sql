-- Migration: Enforce 1-to-1 unique mapping for staff.user_id
-- Spec Reference: AUTH1.8B1 Database Integrity

-- Create unique partial index on public.staff(user_id) where user_id IS NOT NULL.
-- Invariant:
-- 1. Multiple staff rows may have user_id = NULL.
-- 2. One non-null auth.users.id may belong to AT MOST ONE staff row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_user_id_not_null
ON public.staff(user_id)
WHERE user_id IS NOT NULL;
