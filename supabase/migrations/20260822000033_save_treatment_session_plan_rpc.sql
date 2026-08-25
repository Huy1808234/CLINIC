-- Migration: Atomic Save Treatment Session Plan RPC
-- Spec Reference: GOAL CLINICAL-SERVICE-PLAN1-RPC33 — Doctor Mutation for Treatment Session Plans

CREATE OR REPLACE FUNCTION public.save_treatment_session_plan(
    p_treatment_course_id UUID,
    p_clinic_id UUID,
    p_session_number INTEGER,
    p_service_ids UUID[],
    p_notes TEXT DEFAULT NULL,
    p_actor_staff_id UUID DEFAULT NULL,
    p_actor_user_id UUID DEFAULT NULL
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
    v_planned_session_count INTEGER;
    v_distinct_service_count INTEGER;
    v_total_service_count INTEGER;
    v_valid_service_count INTEGER;
    v_existing_plan_id UUID;
    v_plan_id UUID;
    v_locked_appt_count INTEGER;
BEGIN
    -- 1. Validate required input parameters
    IF p_treatment_course_id IS NULL OR p_clinic_id IS NULL OR p_session_number IS NULL OR p_actor_staff_id IS NULL OR p_actor_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_INPUT',
            'message', 'Dữ liệu đầu vào không đầy đủ.'
        );
    END IF;

    IF p_service_ids IS NULL OR COALESCE(array_length(p_service_ids, 1), 0) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'EMPTY_SERVICES',
            'message', 'Danh sách dịch vụ chỉ định cho buổi điều trị không được để trống.'
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
            'message', 'Chỉ Bác sĩ có tài khoản đang hoạt động tại cơ sở này mới có quyền lập kế hoạch điều trị theo buổi.'
        );
    END IF;

    -- 4. Lock and validate target Treatment Course
    SELECT id, clinic_id, status, planned_session_count
    INTO v_course_id, v_course_clinic_id, v_course_status, v_planned_session_count
    FROM public.treatment_courses
    WHERE id = p_treatment_course_id
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

    IF v_course_status NOT IN ('PLANNED', 'ACTIVE') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'COURSE_NOT_PLAN_ELIGIBLE',
            'message', 'Liệu trình hiện không ở trạng thái có thể chỉnh sửa kế hoạch.'
        );
    END IF;

    IF v_planned_session_count IS NULL OR v_planned_session_count <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'PLAN_COUNT_NOT_ESTABLISHED',
            'message', 'Bác sĩ chưa thiết lập tổng số buổi điều trị cho liệu trình này.'
        );
    END IF;

    -- 5. Validate session_number bounds (1 <= session_number <= planned_session_count)
    IF p_session_number <= 0 OR p_session_number > v_planned_session_count THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_SESSION_NUMBER',
            'message', 'Số thứ tự buổi điều trị phải nằm trong khoảng từ 1 đến ' || v_planned_session_count || '.'
        );
    END IF;

    -- 6. Validate service IDs: no duplicates, all exist and active in service_catalog
    SELECT COUNT(DISTINCT s_id), COUNT(s_id)
    INTO v_distinct_service_count, v_total_service_count
    FROM unnest(p_service_ids) AS s_id;

    IF v_distinct_service_count < v_total_service_count THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'DUPLICATE_SERVICES',
            'message', 'Danh sách dịch vụ không được chứa dịch vụ trùng lặp trong cùng một buổi điều trị.'
        );
    END IF;

    SELECT COUNT(*) INTO v_valid_service_count
    FROM public.service_catalog
    WHERE id = ANY(p_service_ids)
      AND is_active = TRUE;

    IF v_valid_service_count < v_distinct_service_count THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_OR_INACTIVE_SERVICE',
            'message', 'Một hoặc nhiều dịch vụ không tồn tại hoặc đã ngưng hoạt động trong danh mục.'
        );
    END IF;

    -- 7. Check if plan header already exists and verify appointment safety
    SELECT id INTO v_existing_plan_id
    FROM public.treatment_session_plans
    WHERE treatment_course_id = p_treatment_course_id
      AND session_number = p_session_number;

    IF v_existing_plan_id IS NOT NULL THEN
        -- Check if any linked appointment is locked in progress or completed
        SELECT COUNT(*) INTO v_locked_appt_count
        FROM public.appointments
        WHERE treatment_session_plan_id = v_existing_plan_id
          AND status IN ('CHECKED_IN', 'IN_EXAM', 'IN_TREATMENT', 'COMPLETED');

        IF v_locked_appt_count > 0 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'PLAN_MUTATION_LOCKED',
                'message', 'Không thể sửa kế hoạch của buổi điều trị đã hoặc đang được thực hiện.'
            );
        END IF;

        -- Preserve existing plan UUID
        v_plan_id := v_existing_plan_id;

        UPDATE public.treatment_session_plans
        SET
            planned_by_doctor_id = p_actor_staff_id,
            notes = p_notes,
            updated_at = NOW()
        WHERE id = v_plan_id;

        -- Atomically delete old child services
        DELETE FROM public.treatment_session_plan_services
        WHERE session_plan_id = v_plan_id;
    ELSE
        -- Insert new plan header
        INSERT INTO public.treatment_session_plans (
            treatment_course_id,
            session_number,
            planned_by_doctor_id,
            notes,
            created_at,
            updated_at
        ) VALUES (
            p_treatment_course_id,
            p_session_number,
            p_actor_staff_id,
            p_notes,
            NOW(),
            NOW()
        )
        RETURNING id INTO v_plan_id;
    END IF;

    -- 8. Insert ordered child services
    INSERT INTO public.treatment_session_plan_services (
        session_plan_id,
        service_id,
        sequence_no,
        notes,
        created_at
    )
    SELECT
        v_plan_id,
        s_id,
        ord::INTEGER,
        NULL,
        NOW()
    FROM unnest(p_service_ids) WITH ORDINALITY AS t(s_id, ord);

    -- 9. Insert atomic audit log
    INSERT INTO public.audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_data
    ) VALUES (
        p_actor_user_id,
        'TREATMENT_SESSION_PLAN_SAVED',
        'TREATMENT_SESSION_PLAN',
        v_plan_id,
        jsonb_build_object(
            'plan_id', v_plan_id,
            'treatment_course_id', p_treatment_course_id,
            'clinic_id', p_clinic_id,
            'session_number', p_session_number,
            'planned_by_doctor_id', p_actor_staff_id,
            'service_count', v_distinct_service_count,
            'service_ids', p_service_ids,
            'notes', p_notes
        )
    );

    -- 10. Return success response
    RETURN jsonb_build_object(
        'success', true,
        'plan_id', v_plan_id,
        'treatment_course_id', p_treatment_course_id,
        'session_number', p_session_number,
        'service_count', v_distinct_service_count,
        'planned_by_doctor_id', p_actor_staff_id,
        'message', 'Lưu kế hoạch buổi điều trị số ' || p_session_number || ' thành công.'
    );
END;
$$;

-- Security & Permissions: Strict service_role only execution
REVOKE ALL ON FUNCTION public.save_treatment_session_plan(UUID, UUID, INTEGER, UUID[], TEXT, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_treatment_session_plan(UUID, UUID, INTEGER, UUID[], TEXT, UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.save_treatment_session_plan(UUID, UUID, INTEGER, UUID[], TEXT, UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.save_treatment_session_plan(UUID, UUID, INTEGER, UUID[], TEXT, UUID, UUID) TO service_role;
