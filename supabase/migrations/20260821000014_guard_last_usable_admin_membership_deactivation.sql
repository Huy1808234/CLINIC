-- Migration: Atomic Last-Usable-ADMIN Governance Guard for Membership Deactivation
-- Spec Reference: STAFF-GOV1D1 Database Governance Invariant

CREATE OR REPLACE FUNCTION public.deactivate_staff_membership_with_admin_guard(
    p_membership_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_staff_id UUID;
    v_clinic_id UUID;
    v_is_active BOOLEAN;
    v_clinic_is_active BOOLEAN;
    v_holds_admin BOOLEAN;
    v_remaining_admin_count INTEGER;
BEGIN
    -- 1. Resolve target membership record
    SELECT staff_id, clinic_id, is_active
    INTO v_staff_id, v_clinic_id, v_is_active
    FROM public.staff_clinic_memberships
    WHERE id = p_membership_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TARGET_MEMBERSHIP_NOT_FOUND',
            'message', 'Không tìm thấy thông tin phân công cơ sở cần hủy.'
        );
    END IF;

    -- 2. Idempotency / No-Op check
    IF v_is_active = FALSE THEN
        RETURN jsonb_build_object(
            'success', true,
            'data', jsonb_build_object(
                'id', p_membership_id,
                'is_active', false
            )
        );
    END IF;

    -- 3. Compatible Lock Protocol (Acquires locks in identical sequence to status guard)
    -- 3a. Lock target public.staff row
    PERFORM 1
    FROM public.staff
    WHERE id = v_staff_id
    FOR UPDATE;

    -- 3b. Lock target public.clinics row
    SELECT is_active INTO v_clinic_is_active
    FROM public.clinics
    WHERE id = v_clinic_id
    FOR UPDATE;

    -- 4. If target clinic is inactive, deactivation is safe (inactive clinics don't require admin retention)
    IF v_clinic_is_active = FALSE THEN
        UPDATE public.staff_clinic_memberships
        SET is_active = FALSE,
            left_at = NOW(),
            updated_at = NOW()
        WHERE id = p_membership_id;

        RETURN jsonb_build_object(
            'success', true,
            'data', jsonb_build_object(
                'id', p_membership_id,
                'is_active', false
            )
        );
    END IF;

    -- 5. Check if target membership holds an active ADMIN role
    SELECT EXISTS (
        SELECT 1
        FROM public.staff_clinic_roles
        WHERE staff_clinic_membership_id = p_membership_id
          AND role_code = 'ADMIN'
    ) INTO v_holds_admin;

    -- 6. If target membership holds no ADMIN role, deactivation is safe
    IF v_holds_admin = FALSE THEN
        UPDATE public.staff_clinic_memberships
        SET is_active = FALSE,
            left_at = NOW(),
            updated_at = NOW()
        WHERE id = p_membership_id;

        RETURN jsonb_build_object(
            'success', true,
            'data', jsonb_build_object(
                'id', p_membership_id,
                'is_active', false
            )
        );
    END IF;

    -- 7. Post-Mutation Governance Invariant Check
    -- Verify that at least ONE other usable ADMIN remains at this clinic
    SELECT COUNT(DISTINCT s.id)
    INTO v_remaining_admin_count
    FROM public.staff s
    JOIN public.staff_clinic_memberships scm ON scm.staff_id = s.id
    JOIN public.clinics c ON c.id = scm.clinic_id
    JOIN public.staff_clinic_roles scr ON scr.staff_clinic_membership_id = scm.id
    WHERE scm.clinic_id = v_clinic_id
      AND scm.id <> p_membership_id
      AND s.is_active = TRUE
      AND s.user_id IS NOT NULL
      AND scm.is_active = TRUE
      AND c.is_active = TRUE
      AND scr.role_code = 'ADMIN';

    IF v_remaining_admin_count < 1 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'LAST_USABLE_ADMIN',
            'clinic_id', v_clinic_id,
            'message', 'Không thể hủy phân công vì đây là Quản trị viên (ADMIN) đang hoạt động duy nhất của cơ sở này.'
        );
    END IF;

    -- 8. Atomic Mutation
    UPDATE public.staff_clinic_memberships
    SET is_active = FALSE,
        left_at = NOW(),
        updated_at = NOW()
    WHERE id = p_membership_id;

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'id', p_membership_id,
            'is_active', false
        )
    );
END;
$$;

-- 9. Secure Execute Grants: Restricted to service_role only
REVOKE EXECUTE ON FUNCTION public.deactivate_staff_membership_with_admin_guard(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.deactivate_staff_membership_with_admin_guard(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.deactivate_staff_membership_with_admin_guard(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_staff_membership_with_admin_guard(UUID) TO service_role;
