-- Migration: Atomic Last-Usable-ADMIN Governance Guard for Staff Clinic Role Assignment
-- Spec Reference: STAFF-GOV1E1 Database Governance Invariant

CREATE OR REPLACE FUNCTION public.assign_staff_clinic_roles_with_admin_guard(
    p_staff_id UUID,
    p_clinic_id UUID,
    p_roles TEXT[],
    p_is_primary BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_staff_is_active BOOLEAN;
    v_clinic_is_active BOOLEAN;
    v_membership_id UUID;
    v_membership_is_active BOOLEAN;
    v_currently_has_admin BOOLEAN := FALSE;
    v_new_has_admin BOOLEAN := FALSE;
    v_remaining_admin_count INTEGER;
    v_role TEXT;
    v_clean_roles TEXT[];
BEGIN
    -- 1. Validate Roles Input
    IF p_roles IS NULL OR array_length(p_roles, 1) IS NULL OR array_length(p_roles, 1) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_ROLES',
            'message', 'Vui lòng chọn ít nhất một vai trò hợp lệ.'
        );
    END IF;

    -- Validate each role against canonical allowed values
    FOREACH v_role IN ARRAY p_roles LOOP
        IF NOT (v_role = ANY(ARRAY['DOCTOR', 'RECEPTIONIST', 'TECHNICIAN', 'Y_SI', 'CSKH', 'MANAGER', 'ADMIN'])) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'INVALID_ROLES',
                'message', 'Vai trò không hợp lệ: ' || v_role
            );
        END IF;
    END LOOP;

    -- Deduplicate roles
    SELECT ARRAY(SELECT DISTINCT unnest(p_roles)) INTO v_clean_roles;

    -- 2. Compatible Lock Protocol (Acquires locks in identical sequence: Staff -> Clinic)
    -- 2a. Lock target public.staff row
    SELECT is_active INTO v_staff_is_active
    FROM public.staff
    WHERE id = p_staff_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TARGET_STAFF_NOT_FOUND',
            'message', 'Không tìm thấy hồ sơ nhân viên cần phân công.'
        );
    END IF;

    -- 2b. Lock target public.clinics row
    SELECT is_active INTO v_clinic_is_active
    FROM public.clinics
    WHERE id = p_clinic_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TARGET_CLINIC_NOT_FOUND',
            'message', 'Không tìm thấy cơ sở phòng khám cần phân công.'
        );
    END IF;

    -- 3. Check existing membership record
    SELECT id, is_active
    INTO v_membership_id, v_membership_is_active
    FROM public.staff_clinic_memberships
    WHERE staff_id = p_staff_id AND clinic_id = p_clinic_id;

    -- 4. Check if target staff currently holds an active ADMIN role at this clinic
    IF v_membership_id IS NOT NULL AND v_membership_is_active = TRUE AND v_clinic_is_active = TRUE THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.staff_clinic_roles
            WHERE staff_clinic_membership_id = v_membership_id
              AND role_code = 'ADMIN'
        ) INTO v_currently_has_admin;
    END IF;

    -- Check if the replacement role set contains ADMIN
    v_new_has_admin := 'ADMIN' = ANY(v_clean_roles);

    -- 5. Post-Mutation Governance Invariant Check
    -- If removing an existing ADMIN role at an active clinic, ensure at least ONE other usable ADMIN remains
    IF v_currently_has_admin = TRUE AND v_new_has_admin = FALSE AND v_clinic_is_active = TRUE THEN
        SELECT COUNT(DISTINCT s.id)
        INTO v_remaining_admin_count
        FROM public.staff s
        JOIN public.staff_clinic_memberships scm ON scm.staff_id = s.id
        JOIN public.clinics c ON c.id = scm.clinic_id
        JOIN public.staff_clinic_roles scr ON scr.staff_clinic_membership_id = scm.id
        WHERE scm.clinic_id = p_clinic_id
          AND scm.id <> v_membership_id
          AND s.is_active = TRUE
          AND s.user_id IS NOT NULL
          AND scm.is_active = TRUE
          AND c.is_active = TRUE
          AND scr.role_code = 'ADMIN';

        IF v_remaining_admin_count < 1 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'LAST_USABLE_ADMIN',
                'clinic_id', p_clinic_id,
                'message', 'Không thể gỡ vai trò Quản trị viên (ADMIN) vì đây là Quản trị viên đang hoạt động duy nhất của cơ sở này.'
            );
        END IF;
    END IF;

    -- 6. Atomic Mutation: Upsert/Reactivate membership
    IF v_membership_id IS NOT NULL THEN
        UPDATE public.staff_clinic_memberships
        SET is_primary = p_is_primary,
            is_active = TRUE,
            left_at = NULL,
            updated_at = NOW()
        WHERE id = v_membership_id;
    ELSE
        INSERT INTO public.staff_clinic_memberships (
            staff_id,
            clinic_id,
            is_primary,
            is_active,
            joined_at
        )
        VALUES (
            p_staff_id,
            p_clinic_id,
            p_is_primary,
            TRUE,
            NOW()
        )
        RETURNING id INTO v_membership_id;
    END IF;

    -- 7. Atomically Replace Roles: Delete old roles and insert complete replacement set
    DELETE FROM public.staff_clinic_roles
    WHERE staff_clinic_membership_id = v_membership_id;

    INSERT INTO public.staff_clinic_roles (staff_clinic_membership_id, role_code)
    SELECT v_membership_id, unnest(v_clean_roles);

    RETURN jsonb_build_object(
        'success', true,
        'membership_id', v_membership_id,
        'data', jsonb_build_object(
            'staff_id', p_staff_id,
            'clinic_id', p_clinic_id,
            'membership_id', v_membership_id,
            'roles', to_jsonb(v_clean_roles)
        )
    );
END;
$$;

-- 8. Secure Execute Grants: Restricted to service_role only
REVOKE EXECUTE ON FUNCTION public.assign_staff_clinic_roles_with_admin_guard(UUID, UUID, TEXT[], BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_staff_clinic_roles_with_admin_guard(UUID, UUID, TEXT[], BOOLEAN) FROM anon;
REVOKE EXECUTE ON FUNCTION public.assign_staff_clinic_roles_with_admin_guard(UUID, UUID, TEXT[], BOOLEAN) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.assign_staff_clinic_roles_with_admin_guard(UUID, UUID, TEXT[], BOOLEAN) TO service_role;
