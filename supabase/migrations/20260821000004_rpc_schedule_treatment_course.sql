-- Migration: Atomic Auto-Scheduling RPC Function
-- Spec Reference: THUAN_THIEN_RECEPTION_SCHEDULING_TECHLEAD_SPEC_V1.md §16.7

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
AS $$
DECLARE
    v_patient_id UUID;
    v_current_date DATE;
    v_scheduled_count INTEGER := 0;
    v_target_start_time TIME;
    v_appt_start TIMESTAMPTZ;
    v_appt_end TIMESTAMPTZ;
    v_slot_interval INTEGER := 5;
    v_created_appt_ids UUID[] := ARRAY[]::UUID[];
    v_appt_id UUID;
    v_existing_conflict_count INTEGER;
BEGIN
    -- 1. Lock the treatment course row to prevent concurrent scheduling
    SELECT patient_id INTO v_patient_id
    FROM public.treatment_courses
    WHERE id = p_course_id
    FOR UPDATE;

    IF v_patient_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'FAILED',
            'message', 'Treatment course not found.'
        );
    END IF;

    -- 2. Fetch configured slot interval from settings if available
    SELECT COALESCE(slot_interval_minutes, 5) INTO v_slot_interval
    FROM public.scheduling_settings
    LIMIT 1;

    v_target_start_time := COALESCE(p_preferred_time, '07:30:00'::TIME);
    v_current_date := p_start_date;

    -- 3. Loop and generate appointments on valid weekdays
    WHILE v_scheduled_count < p_session_count LOOP
        -- Check if day of week is allowed (PostgreSQL: 0=Sun, 1=Mon, ..., 6=Sat)
        IF EXTRACT(DOW FROM v_current_date)::INTEGER = ANY(p_selected_weekdays) AND EXTRACT(DOW FROM v_current_date)::INTEGER != 0 THEN
            
            -- Check if course already has an appointment on this date
            SELECT COUNT(*) INTO v_existing_conflict_count
            FROM public.appointments
            WHERE treatment_course_id = p_course_id AND appointment_date = v_current_date AND status != 'CANCELLED';

            IF v_existing_conflict_count = 0 THEN
                -- Compute start and end timestamps in Asia/Ho_Chi_Minh
                v_appt_start := (v_current_date || ' ' || v_target_start_time)::TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh';
                v_appt_end := v_appt_start + INTERVAL '80 minutes';

                -- Insert appointment
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

    -- 4. Update treatment course planned end date & doctor assignment
    UPDATE public.treatment_courses
    SET primary_doctor_id = p_doctor_id,
        planned_end_date = v_current_date - INTERVAL '1 day',
        planned_session_count = p_session_count
    WHERE id = p_course_id;

    RETURN jsonb_build_object(
        'success', true,
        'status', CASE WHEN v_scheduled_count = p_session_count THEN 'FULL' ELSE 'PARTIAL' END,
        'scheduled_count', v_scheduled_count,
        'requested_count', p_session_count,
        'appointment_ids', to_jsonb(v_created_appt_ids)
    );
END;
$$;
