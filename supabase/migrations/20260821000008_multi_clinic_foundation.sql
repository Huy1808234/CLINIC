-- Migration: Multi-Clinic Domain Foundation
-- Spec Reference: GOAL G-MC1 — Multi-Clinic Domain Foundation

-- 1. Organizations Table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_code ON public.organizations(code);

-- 2. Clinics Table
CREATE TABLE IF NOT EXISTS public.clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    clinic_code TEXT NOT NULL,
    name TEXT NOT NULL,
    short_name TEXT,
    address TEXT,
    phone TEXT,
    timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_clinics_org_clinic_code UNIQUE (organization_id, clinic_code)
);

CREATE INDEX IF NOT EXISTS idx_clinics_organization ON public.clinics(organization_id);
CREATE INDEX IF NOT EXISTS idx_clinics_code ON public.clinics(clinic_code);

-- 3. Staff Clinic Memberships Table
CREATE TABLE IF NOT EXISTS public.staff_clinic_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    joined_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_staff_clinic_membership UNIQUE (staff_id, clinic_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_clinic_memberships_staff ON public.staff_clinic_memberships(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_clinic_memberships_clinic ON public.staff_clinic_memberships(clinic_id);

-- 4. Staff Clinic Roles Table
CREATE TABLE IF NOT EXISTS public.staff_clinic_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_clinic_membership_id UUID NOT NULL REFERENCES public.staff_clinic_memberships(id) ON DELETE CASCADE,
    role_code TEXT NOT NULL CHECK (role_code IN ('DOCTOR', 'RECEPTIONIST', 'TECHNICIAN', 'Y_SI', 'CSKH', 'MANAGER', 'ADMIN')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_staff_clinic_membership_role UNIQUE (staff_clinic_membership_id, role_code)
);

CREATE INDEX IF NOT EXISTS idx_staff_clinic_roles_membership ON public.staff_clinic_roles(staff_clinic_membership_id);
CREATE INDEX IF NOT EXISTS idx_staff_clinic_roles_role_code ON public.staff_clinic_roles(role_code);

-- 5. Enable Row Level Security (RLS) on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_clinic_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_clinic_roles ENABLE ROW LEVEL SECURITY;

-- Minimal schema-safe RLS policies for authenticated & anon operational access
CREATE POLICY "Anon can manage organizations"
    ON public.organizations FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "Authenticated can manage organizations"
    ON public.organizations FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "Anon can manage clinics"
    ON public.clinics FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "Authenticated can manage clinics"
    ON public.clinics FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "Anon can manage staff_clinic_memberships"
    ON public.staff_clinic_memberships FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "Authenticated can manage staff_clinic_memberships"
    ON public.staff_clinic_memberships FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "Anon can manage staff_clinic_roles"
    ON public.staff_clinic_roles FOR ALL
    TO anon
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "Authenticated can manage staff_clinic_roles"
    ON public.staff_clinic_roles FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

-- 6. Seed Default Organization
INSERT INTO public.organizations (code, name, is_active)
VALUES ('THUAN_THIEN', 'Thuận Thiên', TRUE)
ON CONFLICT (code) DO NOTHING;
