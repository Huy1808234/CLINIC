-- Migration: Atomic Link Staff Auth Account RPC
-- Spec Reference: GOAL STAFF-AUTH1A-FIX2 — Atomic Application Database Staff Auth Provisioning & Audit

CREATE OR REPLACE FUNCTION public.link_staff_auth_account(
    p_staff_id UUID,
    p_clinic_id UUID,
    p_auth_user_id UUID,
    p_login_email TEXT,
    p_actor_staff_id UUID,
    p_actor_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_is_active BOOLEAN;
    v_actor_user_id UUID;
    v_actor_membership_id UUID;
    v_target_staff_id UUID;
    v_target_staff_code TEXT;
    v_target_is_active BOOLEAN;
    v_target_user_id UUID;
    v_target_membership_id UUID;
BEGIN
    -- 1. Validate parameters
    IF p_staff_id IS NULL OR p_clinic_id IS NULL OR p_auth_user_id IS NULL OR p_login_email IS NULL OR p_actor_staff_id IS NULL OR p_actor_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_INPUT',
            'message', 'Dữ liệu đầu vào không đầy đủ.'
        );
    END IF;

    -- 2. Validate actor Staff integrity and Auth User linkage
    SELECT is_active, user_id INTO v_actor_is_active, v_actor_user_id
    FROM public.staff
    WHERE id = p_actor_staff_id;

    IF v_actor_is_active IS NULL OR v_actor_is_active = FALSE OR v_actor_user_id IS DISTINCT FROM p_actor_user_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_ACTOR',
            'message', 'Tài khoản người thực hiện không hợp lệ, không hoạt động hoặc không khớp với tài khoản đăng nhập.'
        );
    END IF;

    -- 3. Validate actor has active membership and ADMIN role at p_clinic_id
    SELECT scm.id INTO v_actor_membership_id
    FROM public.staff_clinic_memberships scm
    JOIN public.staff_clinic_roles scr ON scr.staff_clinic_membership_id = scm.id
    WHERE scm.staff_id = p_actor_staff_id
      AND scm.clinic_id = p_clinic_id
      AND scm.is_active = TRUE
      AND scr.role_code = 'ADMIN';

    IF v_actor_membership_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'UNAUTHORIZED_ADMIN',
            'message', 'Bạn không có quyền quản trị (ADMIN) tại cơ sở này.'
        );
    END IF;

    -- 4. Lock and validate target Staff (prevents concurrent provisioning)
    SELECT id, staff_code, is_active, user_id
    INTO v_target_staff_id, v_target_staff_code, v_target_is_active, v_target_user_id
    FROM public.staff
    WHERE id = p_staff_id
    FOR UPDATE;

    IF v_target_staff_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TARGET_STAFF_NOT_FOUND',
            'message', 'Không tìm thấy thông tin hồ sơ nhân viên.'
        );
    END IF;

    IF v_target_is_active = FALSE THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TARGET_STAFF_INACTIVE',
            'message', 'Không thể cấp tài khoản cho hồ sơ nhân viên đã bị khóa hoặc ngừng hoạt động.'
        );
    END IF;

    IF v_target_user_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ACCOUNT_ALREADY_LINKED',
            'message', 'Nhân viên này đã được liên kết với một tài khoản đăng nhập.'
        );
    END IF;

    -- 5. Validate target Staff has active membership at p_clinic_id
    SELECT scm.id INTO v_target_membership_id
    FROM public.staff_clinic_memberships scm
    WHERE scm.staff_id = p_staff_id
      AND scm.clinic_id = p_clinic_id
      AND scm.is_active = TRUE;

    IF v_target_membership_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TARGET_STAFF_NOT_ACCESSIBLE',
            'message', 'Nhân viên không có phân công làm việc đang hoạt động tại cơ sở hiện tại.'
        );
    END IF;

    -- 6. Atomically update Staff linkage and setup state
    UPDATE public.staff
    SET
        user_id = p_auth_user_id,
        auth_setup_required = TRUE,
        auth_setup_completed_at = NULL
    WHERE id = p_staff_id;

    -- 7. Insert audit log inside same transaction
    INSERT INTO public.audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_data
    ) VALUES (
        p_actor_user_id,
        'PROVISION_STAFF_AUTH_ACCOUNT',
        'STAFF',
        p_staff_id,
        jsonb_build_object(
            'staff_id', p_staff_id,
            'staff_code', v_target_staff_code,
            'auth_user_id', p_auth_user_id,
            'login_email', p_login_email,
            'clinic_id', p_clinic_id,
            'auth_setup_required', TRUE
        )
    );

    -- 8. Return success result
    RETURN jsonb_build_object(
        'success', true,
        'staff_id', p_staff_id,
        'auth_user_id', p_auth_user_id,
        'auth_setup_required', TRUE,
        'message', 'Liên kết tài khoản đăng nhập và ghi nhận audit thành công.'
    );
END;
$$;

-- Security & Permissions: Strict service_role only execution
REVOKE ALL ON FUNCTION public.link_staff_auth_account(UUID, UUID, UUID, TEXT, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_staff_auth_account(UUID, UUID, UUID, TEXT, UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.link_staff_auth_account(UUID, UUID, UUID, TEXT, UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.link_staff_auth_account(UUID, UUID, UUID, TEXT, UUID, UUID) TO service_role;
