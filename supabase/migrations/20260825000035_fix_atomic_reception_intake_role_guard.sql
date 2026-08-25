-- Migration: 20260825000035_fix_atomic_reception_intake_role_guard.sql
-- Goal: RECEPTION-ATOMIC-INTAKE1-RPC34-FIX1
-- Spec Reference: Fix Reception Intake Role Guard to restrict actor authorization to RECEPTIONIST and ADMIN only

CREATE OR REPLACE FUNCTION public.process_reception_intake_atomic(
    p_clinic_id UUID,
    p_actor_staff_id UUID,
    p_actor_user_id UUID,
    p_existing_patient_id UUID DEFAULT NULL,
    p_new_patient JSONB DEFAULT NULL,
    p_reception_source TEXT DEFAULT 'MANUAL',
    p_reason_for_visit TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_height_cm NUMERIC DEFAULT NULL,
    p_weight_kg NUMERIC DEFAULT NULL,
    p_create_course BOOLEAN DEFAULT TRUE,
    p_doctor_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_staff_is_active BOOLEAN;
    v_staff_user_id UUID;
    v_actor_membership_id UUID;
    v_org_id UUID;
    v_doctor_membership_id UUID;

    v_patient_id UUID;
    v_patient_code TEXT;
    v_patient_full_name TEXT;
    v_relation_type TEXT;
    v_is_new_patient BOOLEAN;

    v_full_name TEXT;
    v_normalized_name TEXT;
    v_phone TEXT;
    v_citizen_id TEXT;
    v_citizen_id_issued_at DATE;
    v_citizen_id_issued_by TEXT;
    v_birth_date DATE;
    v_birth_year SMALLINT;
    v_dob_precision TEXT;
    v_sex TEXT;
    v_address TEXT;
    v_occupation TEXT;
    v_patient_notes TEXT;

    v_card_number TEXT;
    v_reg_facility_code TEXT;
    v_reg_facility_name TEXT;
    v_benefit_rate NUMERIC;
    v_valid_from DATE;
    v_valid_to DATE;
    v_insurance_card_id UUID;

    v_lock_keys TEXT[];
    v_key TEXT;
    v_matched_by_cccd UUID;
    v_matched_by_bhyt UUID;
    v_bhyt_patient_ids UUID[];

    v_retry_count INTEGER;
    v_diag_constraint TEXT;

    v_measurement_id UUID;
    v_reception_id UUID;
    v_rec_arrived_at TIMESTAMPTZ;
    v_rec_registered_at TIMESTAMPTZ;
    v_rec_source TEXT;
    v_rec_rel_type TEXT;
    v_rec_paper_status TEXT;
    v_rec_his_status TEXT;
    v_rec_reason TEXT;
    v_rec_notes TEXT;
    v_rec_created_at TIMESTAMPTZ;
    v_rec_created_by UUID;

    v_course_id UUID;
    v_next_course_no INTEGER;
    v_crs_no INTEGER;
    v_crs_doctor_id UUID;
    v_crs_planned INTEGER;
    v_crs_completed INTEGER;
    v_crs_status TEXT;
BEGIN
    -- 1. Validate required basic parameters
    IF p_clinic_id IS NULL OR p_actor_staff_id IS NULL OR p_actor_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_INPUT',
            'message', 'Dữ liệu đầu vào không đầy đủ (thiếu mã cơ sở hoặc thông tin người thực hiện).'
        );
    END IF;

    -- 2. Enforce exactly one patient mode (EXISTING vs NEW)
    IF (p_existing_patient_id IS NOT NULL AND p_new_patient IS NOT NULL) OR
       (p_existing_patient_id IS NULL AND p_new_patient IS NULL) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_PATIENT_SELECTION',
            'message', 'Yêu cầu cung cấp chính xác một trong hai: mã bệnh nhân đã có hoặc thông tin bệnh nhân mới.'
        );
    END IF;

    -- 3. Validate actor Staff integrity and Auth User linkage
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

    -- 4. Validate actor has active membership and RECEPTIONIST or ADMIN role at p_clinic_id (MANAGER denied)
    SELECT scm.id INTO v_actor_membership_id
    FROM public.staff_clinic_memberships scm
    JOIN public.staff_clinic_roles scr ON scr.staff_clinic_membership_id = scm.id
    WHERE scm.staff_id = p_actor_staff_id
      AND scm.clinic_id = p_clinic_id
      AND scm.is_active = TRUE
      AND scr.role_code IN ('RECEPTIONIST', 'ADMIN');

    IF v_actor_membership_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'UNAUTHORIZED_RECEPTIONIST',
            'message', 'Nhân viên không có quyền thực hiện tiếp nhận tại cơ sở này.'
        );
    END IF;

    -- 5. Resolve active Clinic & Organization
    SELECT organization_id INTO v_org_id
    FROM public.clinics
    WHERE id = p_clinic_id AND is_active = TRUE;

    IF v_org_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'CLINIC_NOT_FOUND',
            'message', 'Cơ sở phòng khám không tồn tại hoặc đã ngừng hoạt động.'
        );
    END IF;

    -- 6. Validate Doctor target if provided
    IF p_doctor_id IS NOT NULL THEN
        SELECT scm.id INTO v_doctor_membership_id
        FROM public.staff s
        JOIN public.staff_clinic_memberships scm ON scm.staff_id = s.id
        JOIN public.staff_clinic_roles scr ON scr.staff_clinic_membership_id = scm.id
        WHERE s.id = p_doctor_id
          AND s.is_active = TRUE
          AND scm.clinic_id = p_clinic_id
          AND scm.is_active = TRUE
          AND scr.role_code = 'DOCTOR';

        IF v_doctor_membership_id IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'INVALID_DOCTOR_TARGET',
                'message', 'Bác sĩ được chọn không hợp lệ, không hoạt động hoặc không được phân công tại cơ sở này.'
            );
        END IF;
    END IF;

    -- 7. Patient resolution and concurrency protection
    IF p_existing_patient_id IS NOT NULL THEN
        -- Existing Patient mode: Lock patient row and verify existence
        SELECT id, patient_code, full_name INTO v_patient_id, v_patient_code, v_patient_full_name
        FROM public.patients
        WHERE id = p_existing_patient_id
        FOR UPDATE;

        IF v_patient_id IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'PATIENT_NOT_FOUND',
                'message', 'Không tìm thấy hồ sơ bệnh nhân.'
            );
        END IF;

        v_relation_type := 'RETURNING';
        v_is_new_patient := false;
    ELSE
        -- NEW Patient mode: Extract allowed normalized fields
        v_full_name := TRIM(COALESCE(p_new_patient->>'full_name', ''));
        IF v_full_name = '' THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'INVALID_PATIENT_NAME',
                'message', 'Họ và tên bệnh nhân không được để trống.'
            );
        END IF;

        v_normalized_name := NULLIF(TRIM(p_new_patient->>'normalized_name'), '');
        v_phone := NULLIF(TRIM(p_new_patient->>'phone'), '');
        v_citizen_id := NULLIF(TRIM(p_new_patient->>'citizen_id'), '');
        v_citizen_id_issued_at := NULLIF(TRIM(p_new_patient->>'citizen_id_issued_at'), '')::DATE;
        v_citizen_id_issued_by := NULLIF(TRIM(p_new_patient->>'citizen_id_issued_by'), '');
        v_birth_date := NULLIF(TRIM(p_new_patient->>'birth_date'), '')::DATE;
        v_birth_year := NULLIF(TRIM(p_new_patient->>'birth_year'), '')::SMALLINT;
        v_dob_precision := COALESCE(NULLIF(TRIM(p_new_patient->>'dob_precision'), ''), 'UNKNOWN');
        v_sex := NULLIF(TRIM(p_new_patient->>'sex'), '');
        v_address := NULLIF(TRIM(p_new_patient->>'address'), '');
        v_occupation := NULLIF(TRIM(p_new_patient->>'occupation'), '');
        v_patient_notes := NULLIF(TRIM(p_new_patient->>'notes'), '');

        v_card_number := NULLIF(TRIM(p_new_patient->>'insurance_card_number'), '');
        v_reg_facility_code := NULLIF(TRIM(p_new_patient->>'registered_facility_code'), '');
        v_reg_facility_name := NULLIF(TRIM(p_new_patient->>'registered_facility_name'), '');
        v_benefit_rate := NULLIF(TRIM(p_new_patient->>'benefit_rate'), '')::NUMERIC;
        v_valid_from := NULLIF(TRIM(p_new_patient->>'insurance_valid_from'), '')::DATE;
        v_valid_to := NULLIF(TRIM(p_new_patient->>'insurance_valid_to'), '')::DATE;

        -- Concurrency locks for strong exact identifiers
        v_lock_keys := ARRAY[]::TEXT[];
        IF v_citizen_id IS NOT NULL THEN
            v_lock_keys := array_append(v_lock_keys, 'patient_cccd:' || v_citizen_id);
        END IF;
        IF v_card_number IS NOT NULL THEN
            v_lock_keys := array_append(v_lock_keys, 'patient_bhyt:' || v_card_number);
        END IF;

        IF array_length(v_lock_keys, 1) > 1 THEN
            SELECT array_agg(k ORDER BY k ASC) INTO v_lock_keys FROM unnest(v_lock_keys) AS k;
        END IF;

        IF v_lock_keys IS NOT NULL THEN
            FOREACH v_key IN ARRAY v_lock_keys LOOP
                PERFORM pg_advisory_xact_lock(hashtext(v_key));
            END LOOP;
        END IF;

        -- Exact identifier recheck inside lock
        v_matched_by_cccd := NULL;
        v_matched_by_bhyt := NULL;

        IF v_citizen_id IS NOT NULL THEN
            SELECT id INTO v_matched_by_cccd FROM public.patients WHERE citizen_id = v_citizen_id;
        END IF;

        IF v_card_number IS NOT NULL THEN
            SELECT array_agg(DISTINCT patient_id) INTO v_bhyt_patient_ids
            FROM public.patient_insurance_cards
            WHERE card_number = v_card_number;

            IF array_length(v_bhyt_patient_ids, 1) = 1 THEN
                v_matched_by_bhyt := v_bhyt_patient_ids[1];
            ELSIF array_length(v_bhyt_patient_ids, 1) > 1 THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error_code', 'PATIENT_INSURANCE_AMBIGUOUS',
                    'message', 'Số thẻ BHYT đang liên kết với nhiều hồ sơ bệnh nhân khác nhau.'
                );
            END IF;
        END IF;

        -- Check identifier conflict
        IF v_matched_by_cccd IS NOT NULL AND v_matched_by_bhyt IS NOT NULL AND v_matched_by_cccd IS DISTINCT FROM v_matched_by_bhyt THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'PATIENT_IDENTITY_CONFLICT',
                'message', 'Thông tin CCCD và BHYT đang thuộc hai hồ sơ bệnh nhân khác nhau.'
            );
        END IF;

        -- Pivot to existing patient if matched by exact identifier
        IF v_matched_by_cccd IS NOT NULL OR v_matched_by_bhyt IS NOT NULL THEN
            v_patient_id := COALESCE(v_matched_by_cccd, v_matched_by_bhyt);
            SELECT id, patient_code, full_name INTO v_patient_id, v_patient_code, v_patient_full_name
            FROM public.patients
            WHERE id = v_patient_id
            FOR UPDATE;

            v_relation_type := 'RETURNING';
            v_is_new_patient := false;
        ELSE
            -- Truly new Patient: insert with patient_code generation and bounded collision retry
            v_is_new_patient := true;
            v_relation_type := 'NEW';
            v_patient_full_name := v_full_name;

            v_retry_count := 0;
            LOOP
                v_retry_count := v_retry_count + 1;
                v_patient_code := 'BN-' || to_char(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');

                BEGIN
                    INSERT INTO public.patients (
                        patient_code,
                        full_name,
                        normalized_name,
                        phone,
                        citizen_id,
                        citizen_id_issued_at,
                        citizen_id_issued_by,
                        birth_date,
                        birth_year,
                        dob_precision,
                        sex,
                        address,
                        occupation,
                        notes,
                        is_active,
                        created_by
                    ) VALUES (
                        v_patient_code,
                        v_full_name,
                        v_normalized_name,
                        v_phone,
                        v_citizen_id,
                        v_citizen_id_issued_at,
                        v_citizen_id_issued_by,
                        v_birth_date,
                        v_birth_year,
                        v_dob_precision,
                        v_sex,
                        v_address,
                        v_occupation,
                        v_patient_notes,
                        TRUE,
                        p_actor_user_id
                    )
                    RETURNING id INTO v_patient_id;

                    EXIT; -- Successfully inserted new patient
                EXCEPTION
                    WHEN unique_violation THEN
                        GET STACKED DIAGNOSTICS v_diag_constraint = CONSTRAINT_NAME;
                        IF v_diag_constraint LIKE '%patient_code%' OR v_diag_constraint = 'patients_patient_code_key' THEN
                            IF v_retry_count >= 3 THEN
                                RETURN jsonb_build_object(
                                    'success', false,
                                    'error_code', 'PATIENT_CODE_GENERATION_FAILED',
                                    'message', 'Không thể tạo mã bệnh nhân duy nhất sau nhiều lần thử. Vui lòng thử lại.'
                                );
                            END IF;
                            -- Loop and try again with new patient_code
                        ELSE
                            -- Rethrow other constraint violations (e.g. duplicate citizen_id)
                            RAISE;
                        END IF;
                END;
            END LOOP;

            -- Attach Insurance Card for new patient if provided
            IF v_card_number IS NOT NULL THEN
                INSERT INTO public.patient_insurance_cards (
                    patient_id,
                    card_number,
                    registered_facility_code,
                    registered_facility_name,
                    benefit_rate,
                    valid_from,
                    valid_to,
                    is_current
                ) VALUES (
                    v_patient_id,
                    v_card_number,
                    v_reg_facility_code,
                    v_reg_facility_name,
                    v_benefit_rate,
                    v_valid_from,
                    v_valid_to,
                    TRUE
                )
                RETURNING id INTO v_insurance_card_id;
            END IF;

            -- Write audit log for new patient creation
            INSERT INTO public.audit_logs (
                actor_user_id,
                action,
                entity_type,
                entity_id,
                after_data
            ) VALUES (
                p_actor_user_id,
                'CREATE_PATIENT',
                'PATIENT',
                v_patient_id,
                jsonb_build_object(
                    'id', v_patient_id,
                    'patient_code', v_patient_code,
                    'full_name', v_full_name,
                    'created_by', p_actor_user_id
                )
            );
        END IF;
    END IF;

    -- 8. Insurance Card resolution for Existing Patient
    IF v_insurance_card_id IS NULL THEN
        SELECT id INTO v_insurance_card_id
        FROM public.patient_insurance_cards
        WHERE patient_id = v_patient_id AND is_current = TRUE
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    -- 9. Insert Patient Measurements if height or weight provided
    IF p_height_cm IS NOT NULL OR p_weight_kg IS NOT NULL THEN
        INSERT INTO public.patient_measurements (
            patient_id,
            height_cm,
            weight_kg,
            source,
            recorded_by
        ) VALUES (
            v_patient_id,
            p_height_cm,
            p_weight_kg,
            'RECEPTION',
            p_actor_user_id
        )
        RETURNING id INTO v_measurement_id;
    END IF;

    -- 10. Insert Reception Encounter
    INSERT INTO public.receptions (
        clinic_id,
        patient_id,
        insurance_card_id,
        arrived_at,
        registered_at,
        reception_source,
        patient_relation_type,
        reason_for_visit,
        notes,
        created_by
    ) VALUES (
        p_clinic_id,
        v_patient_id,
        v_insurance_card_id,
        NOW(),
        NOW(),
        COALESCE(NULLIF(TRIM(p_reception_source), ''), 'MANUAL'),
        v_relation_type,
        NULLIF(TRIM(p_reason_for_visit), ''),
        NULLIF(TRIM(p_notes), ''),
        p_actor_user_id
    )
    RETURNING id, arrived_at, registered_at, reception_source, patient_relation_type, paper_file_status, his_import_status, reason_for_visit, notes, created_at, created_by
    INTO v_reception_id, v_rec_arrived_at, v_rec_registered_at, v_rec_source, v_rec_rel_type, v_rec_paper_status, v_rec_his_status, v_rec_reason, v_rec_notes, v_rec_created_at, v_rec_created_by;

    -- Write audit log for reception intake
    INSERT INTO public.audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_data
    ) VALUES (
        p_actor_user_id,
        'RECEPTION_INTAKE',
        'RECEPTION',
        v_reception_id,
        jsonb_build_object(
            'id', v_reception_id,
            'clinic_id', p_clinic_id,
            'patient_id', v_patient_id,
            'insurance_card_id', v_insurance_card_id,
            'patient_relation_type', v_relation_type,
            'created_by', p_actor_user_id
        )
    );

    -- 11. Optionally create initial Treatment Course
    IF p_create_course = TRUE THEN
        PERFORM 1 FROM public.patients WHERE id = v_patient_id FOR UPDATE;

        SELECT COALESCE(MAX(course_no), 0) + 1 INTO v_next_course_no
        FROM public.treatment_courses
        WHERE patient_id = v_patient_id;

        INSERT INTO public.treatment_courses (
            clinic_id,
            patient_id,
            reception_id,
            course_no,
            primary_doctor_id,
            start_date,
            planned_session_count,
            completed_session_count,
            status,
            adherence_status,
            notes,
            created_by
        ) VALUES (
            p_clinic_id,
            v_patient_id,
            v_reception_id,
            v_next_course_no,
            p_doctor_id,
            COALESCE(p_start_date, CURRENT_DATE),
            NULL,
            0,
            'ACTIVE',
            'NORMAL',
            NULLIF(TRIM(p_notes), ''),
            p_actor_user_id
        )
        RETURNING id, course_no, primary_doctor_id, planned_session_count, completed_session_count, status
        INTO v_course_id, v_crs_no, v_crs_doctor_id, v_crs_planned, v_crs_completed, v_crs_status;

        -- Write audit log for treatment course creation
        INSERT INTO public.audit_logs (
            actor_user_id,
            action,
            entity_type,
            entity_id,
            after_data
        ) VALUES (
            p_actor_user_id,
            'CREATE_TREATMENT_COURSE',
            'TREATMENT_COURSE',
            v_course_id,
            jsonb_build_object(
                'id', v_course_id,
                'clinic_id', p_clinic_id,
                'patient_id', v_patient_id,
                'reception_id', v_reception_id,
                'course_no', v_next_course_no,
                'primary_doctor_id', p_doctor_id,
                'created_by', p_actor_user_id
            )
        );
    END IF;

    -- 12. Return composite successful payload
    RETURN jsonb_build_object(
        'success', true,
        'reception', jsonb_build_object(
            'id', v_reception_id,
            'patient_id', v_patient_id,
            'insurance_card_id', v_insurance_card_id,
            'arrived_at', v_rec_arrived_at,
            'registered_at', v_rec_registered_at,
            'reception_source', v_rec_source,
            'patient_relation_type', v_rec_rel_type,
            'paper_file_status', v_rec_paper_status,
            'his_import_status', v_rec_his_status,
            'reason_for_visit', v_rec_reason,
            'notes', v_rec_notes,
            'created_by', v_rec_created_by,
            'created_at', v_rec_created_at
        ),
        'patient', jsonb_build_object(
            'id', v_patient_id,
            'patient_code', v_patient_code,
            'full_name', v_patient_full_name
        ),
        'course', CASE WHEN v_course_id IS NOT NULL THEN jsonb_build_object(
            'id', v_course_id,
            'course_no', v_crs_no,
            'primary_doctor_id', v_crs_doctor_id,
            'planned_session_count', v_crs_planned,
            'completed_session_count', v_crs_completed,
            'status', v_crs_status
        ) ELSE NULL END,
        'is_new_patient', v_is_new_patient
    );
END;
$$;

-- Security & Permissions: Strict service_role only execution
REVOKE ALL ON FUNCTION public.process_reception_intake_atomic(UUID, UUID, UUID, UUID, JSONB, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, UUID, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_reception_intake_atomic(UUID, UUID, UUID, UUID, JSONB, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, UUID, DATE) FROM anon;
REVOKE ALL ON FUNCTION public.process_reception_intake_atomic(UUID, UUID, UUID, UUID, JSONB, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, UUID, DATE) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_reception_intake_atomic(UUID, UUID, UUID, UUID, JSONB, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, UUID, DATE) TO service_role;
