-- Migration: Assign System Admin to All 5 Confirmed Thuận Thiên Clinics with ADMIN Role
-- Spec Reference: GOAL ADMIN-CL1 — System Admin Multi-Clinic Membership & Roles

DO $$
DECLARE
    admin_staff_id UUID;
    clinic_record RECORD;
    membership_id UUID;
BEGIN
    -- 1. Resolve canonical Staff record for ADMIN-01
    SELECT id INTO admin_staff_id
    FROM public.staff
    WHERE staff_code = 'ADMIN-01' AND is_active = TRUE
    LIMIT 1;

    IF admin_staff_id IS NULL THEN
        RAISE EXCEPTION 'Active staff record for ADMIN-01 does not exist.';
    END IF;

    -- 2. Assign active membership and ADMIN role at each of the 5 confirmed clinics
    FOR clinic_record IN
        SELECT c.id AS clinic_id, c.clinic_code
        FROM public.clinics c
        JOIN public.organizations o ON o.id = c.organization_id
        WHERE o.code = 'THUAN_THIEN'
          AND c.clinic_code IN ('TT01', 'PN01', 'TP01', 'HP01', 'MD01')
          AND c.is_active = TRUE
        ORDER BY c.clinic_code
    LOOP
        -- Insert or retrieve membership (is_primary = FALSE to avoid guessing primary clinic)
        INSERT INTO public.staff_clinic_memberships (staff_id, clinic_id, is_primary, is_active)
        VALUES (admin_staff_id, clinic_record.clinic_id, FALSE, TRUE)
        ON CONFLICT (staff_id, clinic_id)
        DO UPDATE SET is_active = TRUE
        RETURNING id INTO membership_id;

        -- Assign ADMIN role to this membership
        INSERT INTO public.staff_clinic_roles (staff_clinic_membership_id, role_code)
        VALUES (membership_id, 'ADMIN')
        ON CONFLICT (staff_clinic_membership_id, role_code)
        DO NOTHING;
    END LOOP;
END $$;
