-- Migration: Atomic Link Staff Auth Account Direct RPC
-- Spec Reference: GOAL STAFF-AUTH1C-RPC1 — Direct ADMIN-managed Credential Provisioning & Audit

CREATE OR REPLACE FUNCTION public.link_staff_auth_account_direct(
    p_staff_id UUID,
    p_clinic_id UUID,
    p_auth_user_id UUID,
    p_login_username TEXT,
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
    v_target_login_username TEXT;
    v_target_membership_id UUID;
BEGIN
    -- 1. Validate parameters
    IF p_staff_id IS NULL OR p_clinic_id IS NULL OR p_auth_user_id IS NULL OR p_login_username IS NULL OR p_actor_staff_id IS NULL OR p_actor_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_INPUT',
            'message', 'Dữ liệu đầu vào không đầy đủ.'
        );
    END IF;

    -- 2. Validate canonical username format (3-32 characters, lowercase alphanumeric start, allowed chars: a-z, 0-9, ., _, -)
    IF p_login_username !~ '^[a-z0-9][a-z0-9._-]{2,31}$' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_LOGIN_USERNAME',
            'message', 'Tên đăng nhập không đúng định dạng chuẩn (3-32 ký tự, bắt đầu bằng chữ cái thường/số, chỉ gồm chữ thường, số, dấu chấm, gạch dưới, gạch ngang).'
        );
    END IF;

    -- 3. Validate actor Staff integrity and Auth User linkage
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

    -- 4. Validate actor has active membership and ADMIN role at p_clinic_id
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

    -- 5. Lock and validate target Staff (prevents concurrent provisioning)
    SELECT id, staff_code, is_active, user_id, login_username
    INTO v_target_staff_id, v_target_staff_code, v_target_is_active, v_target_user_id, v_target_login_username
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

    IF v_target_login_username IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TARGET_USERNAME_ALREADY_SET',
            'message', 'Nhân viên này đã có tên đăng nhập trong hệ thống.'
        );
    END IF;

    -- 6. Validate target Staff has active membership at p_clinic_id
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

    -- 7. Check if login_username is already taken by another staff row
    IF EXISTS (
        SELECT 1 FROM public.staff
        WHERE login_username = p_login_username
          AND id != p_staff_id
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'LOGIN_USERNAME_ALREADY_EXISTS',
            'message', 'Tên đăng nhập này đã được sử dụng cho một nhân viên khác trong hệ thống.'
        );
    END IF;

    -- 8. Atomically update Staff linkage, username, and direct active setup state
    UPDATE public.staff
    SET
        user_id = p_auth_user_id,
        login_username = p_login_username,
        auth_setup_required = FALSE,
        auth_setup_completed_at = NULL
    WHERE id = p_staff_id;

    -- 9. Insert audit log inside same transaction
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
            'login_username', p_login_username,
            'clinic_id', p_clinic_id,
            'auth_setup_required', FALSE
        )
    );

    -- 10. Return success result
    RETURN jsonb_build_object(
        'success', true,
        'staff_id', p_staff_id,
        'auth_user_id', p_auth_user_id,
        'login_username', p_login_username,
        'auth_setup_required', FALSE,
        'message', 'Cấp tài khoản đăng nhập trực tiếp và ghi nhận audit thành công.'
    );
END;
$$;

-- Security & Permissions: Strict service_role only execution
REVOKE ALL ON FUNCTION public.link_staff_auth_account_direct(UUID, UUID, UUID, TEXT, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_staff_auth_account_direct(UUID, UUID, UUID, TEXT, UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.link_staff_auth_account_direct(UUID, UUID, UUID, TEXT, UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.link_staff_auth_account_direct(UUID, UUID, UUID, TEXT, UUID, UUID) TO service_role;
