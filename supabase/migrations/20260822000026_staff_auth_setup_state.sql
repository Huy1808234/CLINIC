-- Migration: Add staff auth setup state and atomic completion RPC
-- Goals: STAFF-AUTH1A-FIX1 (Self-owned password setup for provisioned staff)

-- 1. Add auth_setup_required and auth_setup_completed_at columns to public.staff
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS auth_setup_required BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auth_setup_completed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.staff.auth_setup_required IS 'Indicates whether the provisioned staff member must complete initial password setup before gaining normal application access.';
COMMENT ON COLUMN public.staff.auth_setup_completed_at IS 'Timestamp when the staff member completed their initial password setup.';

-- 2. Create atomic completion RPC for completing staff auth setup
CREATE OR REPLACE FUNCTION public.complete_staff_auth_setup(
    p_actor_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_staff_id UUID;
    v_staff_code TEXT;
    v_is_active BOOLEAN;
    v_setup_required BOOLEAN;
BEGIN
    IF p_actor_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_ACTOR',
            'message', 'Thông tin người dùng không hợp lệ.'
        );
    END IF;

    -- 1. Lock and verify staff record linked to p_actor_user_id
    SELECT id, staff_code, is_active, auth_setup_required
    INTO v_staff_id, v_staff_code, v_is_active, v_setup_required
    FROM public.staff
    WHERE user_id = p_actor_user_id
    FOR UPDATE;

    IF v_staff_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'STAFF_NOT_FOUND',
            'message', 'Không tìm thấy hồ sơ nhân viên liên kết với tài khoản này.'
        );
    END IF;

    IF v_is_active = FALSE THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'STAFF_INACTIVE',
            'message', 'Hồ sơ nhân viên đã bị khóa hoặc ngừng hoạt động.'
        );
    END IF;

    IF v_setup_required = FALSE THEN
        -- Idempotent: already completed
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'staff_id', v_staff_id,
            'message', 'Tài khoản đã hoàn tất thiết lập trước đó.'
        );
    END IF;

    -- 2. Update staff setup state
    UPDATE public.staff
    SET auth_setup_required = FALSE,
        auth_setup_completed_at = NOW()
    WHERE id = v_staff_id;

    -- 3. Write audit log
    INSERT INTO public.audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_data
    ) VALUES (
        p_actor_user_id,
        'COMPLETE_STAFF_AUTH_SETUP',
        'STAFF',
        v_staff_id,
        jsonb_build_object(
            'staff_id', v_staff_id,
            'staff_code', v_staff_code,
            'auth_user_id', p_actor_user_id,
            'completed_at', NOW()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'staff_id', v_staff_id,
        'message', 'Hoàn tất thiết lập tài khoản thành công.'
    );
END;
$$;

-- 3. Restrict execute permissions
REVOKE ALL ON FUNCTION public.complete_staff_auth_setup(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_staff_auth_setup(UUID) TO service_role;
