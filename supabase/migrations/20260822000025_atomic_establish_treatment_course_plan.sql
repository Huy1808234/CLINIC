-- Migration: Atomic Establish Treatment Course Plan RPC
-- Spec Reference: GOAL CLINICAL1C2A-FIX1 — Atomic Doctor Treatment Plan Establishment & Audit

CREATE OR REPLACE FUNCTION public.establish_treatment_course_plan(
    p_course_id UUID,
    p_clinic_id UUID,
    p_planned_session_count INTEGER,
    p_actor_staff_id UUID,
    p_actor_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_staff_is_active BOOLEAN;
    v_staff_user_id UUID;
    v_membership_id UUID;
    v_course_id UUID;
    v_course_clinic_id UUID;
    v_course_status TEXT;
    v_existing_plan INTEGER;
    v_planned_at TIMESTAMPTZ;
BEGIN
    -- 1. Validate parameters
    IF p_course_id IS NULL OR p_clinic_id IS NULL OR p_planned_session_count IS NULL OR p_actor_staff_id IS NULL OR p_actor_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_INPUT',
            'message', 'Dữ liệu đầu vào không đầy đủ.'
        );
    END IF;

    IF p_planned_session_count <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_PLAN_COUNT',
            'message', 'Số buổi điều trị phải lớn hơn 0.'
        );
    END IF;

    -- 2. Validate actor Staff integrity and Auth User linkage
    SELECT is_active, user_id INTO v_staff_is_active, v_staff_user_id
    FROM public.staff
    WHERE id = p_actor_staff_id;

    IF v_staff_is_active IS NULL OR v_staff_is_active = FALSE OR v_staff_user_id IS DISTINCT FROM p_actor_user_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_ACTOR',
            'message', 'Tài khoản nhân viên không hợp lệ, không hoạt động hoặc không khớp với tài khoản đăng nhập.'
        );
    END IF;

    -- 3. Validate actor has active membership and DOCTOR role at p_clinic_id
    SELECT scm.id INTO v_membership_id
    FROM public.staff_clinic_memberships scm
    JOIN public.staff_clinic_roles scr ON scr.staff_clinic_membership_id = scm.id
    WHERE scm.staff_id = p_actor_staff_id
      AND scm.clinic_id = p_clinic_id
      AND scm.is_active = TRUE
      AND scr.role_code = 'DOCTOR';

    IF v_membership_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'UNAUTHORIZED_DOCTOR',
            'message', 'Bác sĩ không có quyền thao tác tại cơ sở này.'
        );
    END IF;

    -- 4. Lock and validate target Treatment Course (prevents concurrent plan establishment)
    SELECT id, clinic_id, status, planned_session_count
    INTO v_course_id, v_course_clinic_id, v_course_status, v_existing_plan
    FROM public.treatment_courses
    WHERE id = p_course_id
    FOR UPDATE;

    IF v_course_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'COURSE_NOT_FOUND',
            'message', 'Không tìm thấy liệu trình điều trị.'
        );
    END IF;

    IF v_course_clinic_id IS DISTINCT FROM p_clinic_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'COURSE_NOT_ACCESSIBLE',
            'message', 'Liệu trình không thuộc cơ sở làm việc hiện tại.'
        );
    END IF;

    IF v_existing_plan IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'PLAN_ALREADY_ESTABLISHED',
            'message', 'Kế hoạch điều trị đã được thiết lập trước đó.'
        );
    END IF;

    IF v_course_status NOT IN ('PLANNED', 'ACTIVE') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'COURSE_NOT_PLAN_ELIGIBLE',
            'message', 'Liệu trình hiện không ở trạng thái có thể lập kế hoạch điều trị.'
        );
    END IF;

    -- 5. Atomically update Treatment Course using DB timestamp
    v_planned_at := NOW();

    UPDATE public.treatment_courses
    SET
        planned_session_count = p_planned_session_count,
        planned_by_doctor_id = p_actor_staff_id,
        planned_at = v_planned_at
    WHERE id = p_course_id;

    -- 6. Insert audit log inside same transaction
    INSERT INTO public.audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_data
    ) VALUES (
        p_actor_user_id,
        'ESTABLISH_TREATMENT_PLAN',
        'TREATMENT_COURSE',
        p_course_id,
        jsonb_build_object(
            'course_id', p_course_id,
            'clinic_id', p_clinic_id,
            'planned_session_count', p_planned_session_count,
            'planned_by_doctor_id', p_actor_staff_id,
            'planned_at', v_planned_at
        )
    );

    -- 7. Return success result
    RETURN jsonb_build_object(
        'success', true,
        'course_id', p_course_id,
        'planned_session_count', p_planned_session_count,
        'planned_by_doctor_id', p_actor_staff_id,
        'planned_at', v_planned_at,
        'message', 'Thiết lập kế hoạch điều trị thành công.'
    );
END;
$$;

-- Security & Permissions: Strict service_role only execution
REVOKE ALL ON FUNCTION public.establish_treatment_course_plan(UUID, UUID, INTEGER, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.establish_treatment_course_plan(UUID, UUID, INTEGER, UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.establish_treatment_course_plan(UUID, UUID, INTEGER, UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.establish_treatment_course_plan(UUID, UUID, INTEGER, UUID, UUID) TO service_role;
