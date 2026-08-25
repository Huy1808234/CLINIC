-- Migration: Finalize Staff Admin Password Reset RPC
-- Spec Reference: GOAL STAFF-AUTH1C-RESET-STATE-RPC1 — Finalize ADMIN-managed Staff Password Reset & Legacy Setup State Conversion

CREATE OR REPLACE FUNCTION public.finalize_staff_admin_password_reset(
    p_staff_id UUID,
    p_clinic_id UUID,
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
    v_target_full_name TEXT;
    v_target_is_active BOOLEAN;
    v_target_user_id UUID;
    v_target_login_username TEXT;
    v_target_setup_required BOOLEAN;
    v_target_setup_completed_at TIMESTAMPTZ;
    v_target_membership_id UUID;
    v_legacy_converted BOOLEAN := FALSE;
BEGIN
    -- 1. Validate parameters
    IF p_staff_id IS NULL OR p_clinic_id IS NULL OR p_actor_staff_id IS NULL OR p_actor_user_id IS NULL THEN
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

    -- 4. Lock and validate target Staff
    SELECT id, staff_code, full_name, is_active, user_id, login_username, auth_setup_required, auth_setup_completed_at
    INTO v_target_staff_id, v_target_staff_code, v_target_full_name, v_target_is_active, v_target_user_id, v_target_login_username, v_target_setup_required, v_target_setup_completed_at
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
            'message', 'Không thể đặt lại mật khẩu cho hồ sơ nhân viên đã bị khóa hoặc ngừng hoạt động.'
        );
    END IF;

    IF v_target_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'AUTH_ACCOUNT_MISSING',
            'message', 'Nhân viên này chưa được liên kết tài khoản đăng nhập.'
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

    -- 6. State transition: If legacy pending account (auth_setup_required = TRUE), transition to FALSE and NULL completed_at
    IF v_target_setup_required = TRUE THEN
        UPDATE public.staff
        SET
            auth_setup_required = FALSE,
            auth_setup_completed_at = NULL
        WHERE id = p_staff_id;

        v_legacy_converted := TRUE;
    ELSE
        v_legacy_converted := FALSE;
    END IF;

    -- 7. Insert audit log atomically in the same transaction
    INSERT INTO public.audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_data
    ) VALUES (
        p_actor_user_id,
        'RESET_STAFF_AUTH_PASSWORD',
        'STAFF',
        p_staff_id,
        jsonb_build_object(
            'staff_id', p_staff_id,
            'staff_code', v_target_staff_code,
            'full_name', v_target_full_name,
            'auth_user_id', v_target_user_id,
            'login_username', v_target_login_username,
            'reset_by_staff_id', p_actor_staff_id,
            'clinic_id', p_clinic_id,
            'legacy_setup_state_converted', v_legacy_converted,
            'reset_at', clock_timestamp()
        )
    );

    -- 8. Return success result
    RETURN jsonb_build_object(
        'success', true,
        'staff_id', p_staff_id,
        'staff_code', v_target_staff_code,
        'full_name', v_target_full_name,
        'auth_user_id', v_target_user_id,
        'login_username', v_target_login_username,
        'legacy_converted', v_legacy_converted,
        'message', 'Hoàn tất cập nhật mật khẩu quản trị và ghi nhận audit thành công.'
    );
END;
$$;

-- Security & Permissions: Strict service_role only execution
REVOKE ALL ON FUNCTION public.finalize_staff_admin_password_reset(UUID, UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_staff_admin_password_reset(UUID, UUID, UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.finalize_staff_admin_password_reset(UUID, UUID, UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_staff_admin_password_reset(UUID, UUID, UUID, UUID) TO service_role;
