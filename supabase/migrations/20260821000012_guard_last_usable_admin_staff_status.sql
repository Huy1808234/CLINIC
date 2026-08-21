-- Migration: Atomic Last-Usable-ADMIN Governance Guard for Staff Status Mutation
-- Spec Reference: STAFF-GOV1B Database Governance Invariant

CREATE OR REPLACE FUNCTION public.set_staff_active_with_admin_guard(
    p_staff_id UUID,
    p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_current_active BOOLEAN;
    v_affected_clinic_ids UUID[];
    v_clinic_id UUID;
    v_remaining_admin_count INTEGER;
BEGIN
    -- 1. Resolve and lock the target staff row
    SELECT is_active INTO v_current_active
    FROM public.staff
    WHERE id = p_staff_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TARGET_STAFF_NOT_FOUND',
            'message', 'Không tìm thấy hồ sơ nhân viên.'
        );
    END IF;

    -- 2. Idempotency / No-Op check
    -- If target staff already has the requested status, return success safely without mutation
    IF v_current_active = p_is_active THEN
        RETURN jsonb_build_object(
            'success', true,
            'data', jsonb_build_object(
                'id', p_staff_id,
                'is_active', v_current_active
            )
        );
    END IF;

    -- 3. Activation Case (p_is_active = TRUE)
    -- Increasing or restoring administrative availability is always safe
    IF p_is_active = TRUE THEN
        UPDATE public.staff
        SET is_active = TRUE
        WHERE id = p_staff_id;

        RETURN jsonb_build_object(
            'success', true,
            'data', jsonb_build_object(
                'id', p_staff_id,
                'is_active', true
            )
        );
    END IF;

    -- 4. Deactivation Case (p_is_active = FALSE)
    -- Determine every ACTIVE clinic where the target staff currently contributes a USABLE ADMIN role
    SELECT COALESCE(array_agg(DISTINCT c.id ORDER BY c.id), ARRAY[]::UUID[])
    INTO v_affected_clinic_ids
    FROM public.staff_clinic_memberships scm
    JOIN public.clinics c ON c.id = scm.clinic_id
    JOIN public.staff_clinic_roles scr ON scr.staff_clinic_membership_id = scm.id
    WHERE scm.staff_id = p_staff_id
      AND scm.is_active = TRUE
      AND c.is_active = TRUE
      AND scr.role_code = 'ADMIN';

    -- 5. If target staff holds no usable ADMIN role at any active clinic, deactivation is safe
    IF array_length(v_affected_clinic_ids, 1) IS NULL OR array_length(v_affected_clinic_ids, 1) = 0 THEN
        UPDATE public.staff
        SET is_active = FALSE
        WHERE id = p_staff_id;

        RETURN jsonb_build_object(
            'success', true,
            'data', jsonb_build_object(
                'id', p_staff_id,
                'is_active', false
            )
        );
    END IF;

    -- 6. Concurrency Guard: Lock affected clinics in deterministic order (ORDER BY id) to prevent deadlocks
    PERFORM 1
    FROM public.clinics
    WHERE id = ANY(v_affected_clinic_ids)
    ORDER BY id
    FOR UPDATE;

    -- 7. For each affected active clinic, verify that at least ONE other usable ADMIN remains
    FOREACH v_clinic_id IN ARRAY v_affected_clinic_ids LOOP
        SELECT COUNT(DISTINCT s.id)
        INTO v_remaining_admin_count
        FROM public.staff s
        JOIN public.staff_clinic_memberships scm ON scm.staff_id = s.id
        JOIN public.clinics c ON c.id = scm.clinic_id
        JOIN public.staff_clinic_roles scr ON scr.staff_clinic_membership_id = scm.id
        WHERE scm.clinic_id = v_clinic_id
          AND s.id <> p_staff_id
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
                'message', 'Không thể khóa nhân viên vì đây là Quản trị viên (ADMIN) đang hoạt động duy nhất của một hoặc nhiều cơ sở.'
            );
        END IF;
    END LOOP;

    -- 8. All affected clinics retain >= 1 other usable ADMIN: perform atomic update
    UPDATE public.staff
    SET is_active = FALSE
    WHERE id = p_staff_id;

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'id', p_staff_id,
            'is_active', false
        )
    );
END;
$$;

-- 9. Secure Execute Grants: Revoke from public/anon, grant only to authenticated/service_role
REVOKE EXECUTE ON FUNCTION public.set_staff_active_with_admin_guard(UUID, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_staff_active_with_admin_guard(UUID, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_staff_active_with_admin_guard(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_staff_active_with_admin_guard(UUID, BOOLEAN) TO service_role;
