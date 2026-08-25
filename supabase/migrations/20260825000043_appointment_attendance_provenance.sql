-- Migration: Appointment Attendance State Transitions and Staff Provenance
-- Spec Reference: GOAL TREATMENT-ATTENDANCE-WORKFLOW1

-- 1. Add attendance lifecycle timestamps and staff actor foreign keys to public.appointments
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS checked_in_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS started_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS no_show_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;

-- 2. Performance indexes for attendance tracking and staff query filtering
CREATE INDEX IF NOT EXISTS idx_appointments_status_date
    ON public.appointments(status, appointment_date);

CREATE INDEX IF NOT EXISTS idx_appointments_checked_in_by
    ON public.appointments(checked_in_by)
    WHERE checked_in_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_started_by
    ON public.appointments(started_by)
    WHERE started_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_completed_by
    ON public.appointments(completed_by)
    WHERE completed_by IS NOT NULL;

-- 3. Update complete_appointment_treatment_session RPC to stamp completed_at & completed_by on appointments
CREATE OR REPLACE FUNCTION public.complete_appointment_treatment_session(
    p_appointment_id UUID,
    p_actor_staff_id UUID,
    p_actor_user_id UUID,
    p_clinical_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_staff_is_active BOOLEAN;
    v_staff_user_id UUID;
    v_appt_id UUID;
    v_appt_status TEXT;
    v_course_id UUID;
    v_appt_date DATE;
    v_appt_notes TEXT;
    v_existing_session_id UUID;
    v_existing_session_course_id UUID;
    v_existing_session_status TEXT;
    v_existing_session_performer UUID;
    v_course_id_check UUID;
    v_course_status TEXT;
    v_course_completed INTEGER;
    v_course_planned INTEGER;
    v_new_session_id UUID;
    v_new_completed INTEGER;
    v_new_course_status TEXT;
BEGIN
    -- 1. Validate actor provenance integrity
    IF p_actor_staff_id IS NULL OR p_actor_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_ACTOR',
            'message', 'Thông tin nhân viên hoặc tài khoản thực hiện không hợp lệ.'
        );
    END IF;

    SELECT is_active, user_id INTO v_staff_is_active, v_staff_user_id
    FROM public.staff
    WHERE id = p_actor_staff_id;

    IF v_staff_is_active IS NULL OR v_staff_is_active = FALSE OR v_staff_user_id IS DISTINCT FROM p_actor_user_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_ACTOR',
            'message', 'Nhân viên thực hiện không hợp lệ, không hoạt động hoặc không khớp với tài khoản đăng nhập.'
        );
    END IF;

    -- 2. Lock target Appointment row (Order: Appointment -> Course)
    SELECT id, status, treatment_course_id, appointment_date, notes
    INTO v_appt_id, v_appt_status, v_course_id, v_appt_date, v_appt_notes
    FROM public.appointments
    WHERE id = p_appointment_id
    FOR UPDATE;

    IF v_appt_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'APPOINTMENT_NOT_FOUND',
            'message', 'Không tìm thấy lịch hẹn.'
        );
    END IF;

    -- 3. Inspect existing Treatment Session linked to this Appointment
    SELECT id, treatment_course_id, status, performed_by_staff_id
    INTO v_existing_session_id, v_existing_session_course_id, v_existing_session_status, v_existing_session_performer
    FROM public.treatment_sessions
    WHERE appointment_id = p_appointment_id;

    -- 4. Evaluate Idempotency and Inconsistent States
    IF v_appt_status = 'COMPLETED' THEN
        IF v_existing_session_id IS NOT NULL THEN
            IF v_existing_session_course_id IS DISTINCT FROM v_course_id OR v_existing_session_status != 'COMPLETED' THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error_code', 'INCONSISTENT_COMPLETION_STATE',
                    'message', 'Lịch hẹn ở trạng thái không nhất quán giữa lịch hẹn và phiên trị liệu.'
                );
            END IF;

            -- Idempotent Success: return existing completion state without duplicate mutation
            SELECT completed_session_count, planned_session_count, status
            INTO v_course_completed, v_course_planned, v_course_status
            FROM public.treatment_courses
            WHERE id = v_course_id;

            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'appointment_id', p_appointment_id,
                'treatment_course_id', v_course_id,
                'treatment_session_id', v_existing_session_id,
                'completed_session_count', v_course_completed,
                'planned_session_count', v_course_planned,
                'course_status', v_course_status,
                'message', 'Lịch hẹn đã được hoàn tất trước đó.'
            );
        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'INCONSISTENT_COMPLETION_STATE',
                'message', 'Lịch hẹn ở trạng thái hoàn tất nhưng thiếu hồ sơ phiên trị liệu.'
            );
        END IF;
    END IF;

    -- For a new completion, Appointment status MUST be IN_TREATMENT
    IF v_appt_status != 'IN_TREATMENT' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_APPOINTMENT_STATE',
            'message', 'Trạng thái lịch hẹn không hợp lệ để hoàn tất trị liệu (yêu cầu trạng thái Đang trị liệu).'
        );
    END IF;

    -- If Appointment is IN_TREATMENT but a Session already exists -> Inconsistent state
    IF v_existing_session_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INCONSISTENT_COMPLETION_STATE',
            'message', 'Phiên trị liệu đã tồn tại nhưng lịch hẹn chưa hoàn tất.'
        );
    END IF;

    -- 5. Lock parent Treatment Course row
    SELECT id, status, completed_session_count, planned_session_count
    INTO v_course_id_check, v_course_status, v_course_completed, v_course_planned
    FROM public.treatment_courses
    WHERE id = v_course_id
    FOR UPDATE;

    IF v_course_id_check IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'COURSE_NOT_FOUND',
            'message', 'Không tìm thấy liệu trình điều trị tương ứng.'
        );
    END IF;

    -- 6. Course Status Guard (Must be ACTIVE for new completion)
    IF v_course_status != 'ACTIVE' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'COURSE_NOT_ACTIVE',
            'message', 'Liệu trình không ở trạng thái hoạt động (ACTIVE).'
        );
    END IF;

    -- 7. Plan Guard (Must be established and positive)
    IF v_course_planned IS NULL OR v_course_planned <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'PLAN_NOT_ESTABLISHED',
            'message', 'Bác sĩ chưa thiết lập số buổi kế hoạch cho liệu trình này.'
        );
    END IF;

    -- 8. Over-completion Guard
    IF v_course_completed >= v_course_planned THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'PLAN_ALREADY_COMPLETED',
            'message', 'Liệu trình đã đạt hoặc vượt quá số buổi kế hoạch.'
        );
    END IF;

    -- 9. Insert exactly ONE Treatment Session with explicit clinical performer
    INSERT INTO public.treatment_sessions (
        treatment_course_id,
        appointment_id,
        service_date,
        status,
        completed_at,
        clinical_note,
        performed_by_staff_id
    )
    VALUES (
        v_course_id,
        p_appointment_id,
        v_appt_date,
        'COMPLETED',
        NOW(),
        p_clinical_note,
        p_actor_staff_id
    )
    RETURNING id INTO v_new_session_id;

    -- 10. Update Appointment to COMPLETED with explicit completion timestamp & performer provenance
    UPDATE public.appointments
    SET status = 'COMPLETED',
        completed_at = NOW(),
        completed_by = p_actor_staff_id,
        notes = COALESCE(p_clinical_note, notes),
        updated_at = NOW()
    WHERE id = p_appointment_id;

    -- 11. Increment Course counter exactly once and update Course status
    v_new_completed := v_course_completed + 1;
    v_new_course_status := CASE WHEN v_new_completed = v_course_planned THEN 'COMPLETED' ELSE 'ACTIVE' END;

    UPDATE public.treatment_courses
    SET completed_session_count = v_new_completed,
        status = v_new_course_status,
        actual_end_date = CASE WHEN v_new_completed = v_course_planned THEN v_appt_date ELSE actual_end_date END
    WHERE id = v_course_id;

    -- 12. Write completion audit event in the same transaction
    INSERT INTO public.audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
    )
    VALUES (
        p_actor_user_id,
        'APPOINTMENT_STATUS_COMPLETED',
        'APPOINTMENT',
        p_appointment_id,
        jsonb_build_object('status', 'IN_TREATMENT'),
        jsonb_build_object(
            'status', 'COMPLETED',
            'treatment_session_id', v_new_session_id,
            'completed_session_count', v_new_completed,
            'course_status', v_new_course_status,
            'performed_by_staff_id', p_actor_staff_id
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'appointment_id', p_appointment_id,
        'treatment_course_id', v_course_id,
        'treatment_session_id', v_new_session_id,
        'completed_session_count', v_new_completed,
        'planned_session_count', v_course_planned,
        'course_status', v_new_course_status,
        'message', 'Hoàn tất buổi điều trị thành công.'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_appointment_treatment_session(UUID, UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_appointment_treatment_session(UUID, UUID, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.complete_appointment_treatment_session(UUID, UUID, UUID, TEXT) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.complete_appointment_treatment_session(UUID, UUID, UUID, TEXT) TO service_role;
