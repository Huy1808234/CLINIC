-- Migration: Add canonical login_username column to public.staff
-- Spec Reference: GOAL STAFF-AUTH1C-USERNAME-SCHEMA1

-- 1. Add nullable login_username column to public.staff
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS login_username TEXT NULL;

COMMENT ON COLUMN public.staff.login_username IS 'Canonical system login identifier for Staff authentication (3-32 characters, lowercase alphanumeric with dots, underscores, hyphens).';

-- 2. Format constraint: Enforce canonical username rules on non-null values
-- Rule: 3–32 characters, starts with lowercase alphanumeric [a-z0-9], allowed characters [a-z0-9._-]
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_staff_login_username_format'
    ) THEN
        ALTER TABLE public.staff
        ADD CONSTRAINT chk_staff_login_username_format
        CHECK (login_username IS NULL OR login_username ~ '^[a-z0-9][a-z0-9._-]{2,31}$');
    END IF;
END $$;

-- 3. Unique index: Global uniqueness among non-null login_username values
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_login_username
ON public.staff(login_username)
WHERE login_username IS NOT NULL;
