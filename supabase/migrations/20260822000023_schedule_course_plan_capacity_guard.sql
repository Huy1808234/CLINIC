-- Migration: Schedule Treatment Course Plan Capacity Guard & Removal of Clinical Plan Overwrites
-- Spec Reference: GOAL SCHED-PLAN1B — Harden schedule_treatment_course RPC to consume plan without overwriting it

CREATE OR REPLACE FUNCTION public.schedule_treatment_course(
    p_course_id UUID,
    p_doctor_id UUID,
    p_start_date DATE,
    p_session_count INTEGER DEFAULT 7,
    p_preferred_time TIME DEFAULT '07:30:00',
    p_selected_weekdays INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6] -- 1=Monday .. 6=Saturday
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_patient_id UUID;
    v_planned_session_count INTEGER;
    v_completed_session_count INTEGER;
    v_active_allocated_count INTEGER := 0;
    v_allocated_plan_units INTEGER := 0;
    v_remaining_schedulable_slots INTEGER := 0;
    v_current_date DATE;
    v_scheduled_count INTEGER := 0;
    v_target_start_time TIME;
    v_appt_start TIMESTAMPTZ;
    v_appt_end TIMESTAMPTZ;
    v_slot_interval INTEGER := 5;
    v_created_appt_ids UUID[] := ARRAY[]::UUID[];
    v_appt_id UUID;
    v_existing_conflict_count INTEGER;
    v_latest_planned_date DATE;
BEGIN
    -- 1. Validate requested schedule count
    IF p_session_count IS NULL OR p_session_count <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'FAILED',
            'error_code', 'INVALID_SCHEDULE_COUNT',
            'message', 'Số buổi yêu cầu xếp lịch phải lớn hơn 0.'
        );
    END IF;

    -- 2. Lock the treatment course row to prevent concurrent scheduling
    SELECT patient_id, planned_session_count, completed_session_count
    INTO v_patient_id, v_planned_session_count, v_completed_session_count
    FROM public.treatment_courses
    WHERE id = p_course_id
    FOR UPDATE;

    IF v_patient_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'FAILED',
            'error_code', 'COURSE_NOT_FOUND',
            'message', 'Không tìm thấy liệu trình điều trị.'
        );
    END IF;

    -- 3. Plan Guard: Treatment Plan must be established and positive
    IF v_planned_session_count IS NULL OR v_planned_session_count <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'FAILED',
            'error_code', 'PLAN_NOT_ESTABLISHED',
            'message', 'Bác sĩ chưa thiết lập kế hoạch điều trị cho liệu trình này.'
        );
    END IF;

    -- 4. Calculate existing active allocated appointments (excludes CANCELLED and NO_SHOW)
    -- Excludes COMPLETED because completed sessions are represented by completed_session_count
    SELECT COUNT(*) INTO v_active_allocated_count
    FROM public.appointments
    WHERE treatment_course_id = p_course_id
      AND status IN ('PLANNED', 'CONFIRMED', 'CHECKED_IN', 'IN_EXAM', 'IN_TREATMENT', 'RESCHEDULED');

    -- 5. Calculate allocated units and remaining capacity under lock
    v_allocated_plan_units := COALESCE(v_completed_session_count, 0) + v_active_allocated_count;
    v_remaining_schedulable_slots := v_planned_session_count - v_allocated_plan_units;

    -- 6. Refuse over-scheduling
    IF p_session_count > v_remaining_schedulable_slots THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'FAILED',
            'error_code', 'EXCEEDS_PLAN_CAPACITY',
            'message', 'Số buổi yêu cầu xếp lịch vượt quá số buổi còn lại trong kế hoạch điều trị.',
            'planned_session_count', v_planned_session_count,
            'completed_session_count', COALESCE(v_completed_session_count, 0),
            'active_allocated_count', v_active_allocated_count,
            'remaining_schedulable_slots', v_remaining_schedulable_slots,
            'requested_count', p_session_count
        );
    END IF;

    -- 7. Fetch configured slot interval from settings if available
    SELECT COALESCE(slot_interval_minutes, 5) INTO v_slot_interval
    FROM public.scheduling_settings
    LIMIT 1;

    v_target_start_time := COALESCE(p_preferred_time, '07:30:00'::TIME);
    v_current_date := p_start_date;

    -- 8. Loop and generate appointments on valid weekdays up to p_session_count
    WHILE v_scheduled_count < p_session_count LOOP
        -- Check if day of week is allowed (PostgreSQL: 0=Sun, 1=Mon, ..., 6=Sat)
        IF EXTRACT(DOW FROM v_current_date)::INTEGER = ANY(p_selected_weekdays) AND EXTRACT(DOW FROM v_current_date)::INTEGER != 0 THEN
            
            -- Check if course already has an active/pending appointment on this date
            SELECT COUNT(*) INTO v_existing_conflict_count
            FROM public.appointments
            WHERE treatment_course_id = p_course_id 
              AND appointment_date = v_current_date 
              AND status != 'CANCELLED';

            IF v_existing_conflict_count = 0 THEN
                -- Compute start and end timestamps in Asia/Ho_Chi_Minh
                v_appt_start := (v_current_date || ' ' || v_target_start_time)::TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh';
                v_appt_end := v_appt_start + INTERVAL '80 minutes';

                -- Insert appointment (doctor_id assigned per appointment; primary_doctor_id untouched)
                INSERT INTO public.appointments (
                    patient_id,
                    treatment_course_id,
                    doctor_id,
                    appointment_date,
                    scheduled_start_at,
                    scheduled_end_at,
                    status,
                    schedule_source,
                    sequence_in_day
                )
                VALUES (
                    v_patient_id,
                    p_course_id,
                    p_doctor_id,
                    v_current_date,
                    v_appt_start,
                    v_appt_end,
                    'PLANNED',
                    'AUTO',
                    v_scheduled_count + 1
                )
                RETURNING id INTO v_appt_id;

                v_created_appt_ids := array_append(v_created_appt_ids, v_appt_id);
                v_scheduled_count := v_scheduled_count + 1;
            END IF;
        END IF;

        -- Advance to next calendar day
        v_current_date := v_current_date + INTERVAL '1 day';
        
        -- Safety exit to avoid infinite loops if constraints cannot be satisfied
        IF v_current_date > (p_start_date + INTERVAL '60 days') THEN
            EXIT;
        END IF;
    END LOOP;

    -- 9. Maintain scheduling-derived planned_end_date from latest scheduled/delivered appointment
    -- Note: planned_session_count and primary_doctor_id are NEVER overwritten by the scheduler!
    SELECT MAX(appointment_date) INTO v_latest_planned_date
    FROM public.appointments
    WHERE treatment_course_id = p_course_id
      AND status IN ('PLANNED', 'CONFIRMED', 'CHECKED_IN', 'IN_EXAM', 'IN_TREATMENT', 'COMPLETED', 'RESCHEDULED');

    IF v_latest_planned_date IS NOT NULL THEN
        UPDATE public.treatment_courses
        SET planned_end_date = v_latest_planned_date
        WHERE id = p_course_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'status', CASE WHEN v_scheduled_count = p_session_count THEN 'FULL' ELSE 'PARTIAL' END,
        'scheduled_count', v_scheduled_count,
        'requested_count', p_session_count,
        'appointment_ids', to_jsonb(v_created_appt_ids)
    );
END;
$$;

-- Secure Execute Grants: Restricted strictly to service_role only
REVOKE ALL ON FUNCTION public.schedule_treatment_course(UUID, UUID, DATE, INTEGER, TIME, INTEGER[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_treatment_course(UUID, UUID, DATE, INTEGER, TIME, INTEGER[]) FROM anon;
REVOKE ALL ON FUNCTION public.schedule_treatment_course(UUID, UUID, DATE, INTEGER, TIME, INTEGER[]) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.schedule_treatment_course(UUID, UUID, DATE, INTEGER, TIME, INTEGER[]) TO service_role;
