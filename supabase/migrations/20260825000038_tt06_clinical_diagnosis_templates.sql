-- Migration: TT06 Clinical Diagnosis Templates, Items, and Cycle Codings
-- Spec Reference: CURRENT_GOAL = DIAGNOSIS-DVKT-TEMPLATE-STAGEB1

-- 1. Table: clinical_diagnosis_templates
CREATE TABLE IF NOT EXISTS public.clinical_diagnosis_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    diagnosis_id UUID NOT NULL REFERENCES public.diagnosis_catalog(id) ON DELETE RESTRICT,
    source_regulation TEXT NOT NULL DEFAULT 'TT_06_2026',
    source_version TEXT,
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_clinical_diag_tpl_dates CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CONSTRAINT uq_clinical_diag_template UNIQUE (organization_id, diagnosis_id, source_regulation, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_clinical_diag_tpl_org ON public.clinical_diagnosis_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_clinical_diag_tpl_diag ON public.clinical_diagnosis_templates(diagnosis_id);
CREATE INDEX IF NOT EXISTS idx_clinical_diag_tpl_dates ON public.clinical_diagnosis_templates(effective_from, effective_to);

-- 2. Table: clinical_diagnosis_template_items
CREATE TABLE IF NOT EXISTS public.clinical_diagnosis_template_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.clinical_diagnosis_templates(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.service_catalog(id) ON DELETE RESTRICT,
    sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
    indication_notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_clinical_diag_tpl_item_service UNIQUE (template_id, service_id),
    CONSTRAINT uq_clinical_diag_tpl_item_seq UNIQUE (template_id, sequence_no)
);

CREATE INDEX IF NOT EXISTS idx_clinical_diag_tpl_item_tpl ON public.clinical_diagnosis_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_clinical_diag_tpl_item_svc ON public.clinical_diagnosis_template_items(service_id);

-- 3. Table: clinical_template_cycle_codings
CREATE TABLE IF NOT EXISTS public.clinical_template_cycle_codings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_item_id UUID NOT NULL REFERENCES public.clinical_diagnosis_template_items(id) ON DELETE CASCADE,
    cycle_number INTEGER NOT NULL CHECK (cycle_number > 0),
    diagnosis_id UUID NOT NULL REFERENCES public.diagnosis_catalog(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_clinical_tpl_cycle UNIQUE (template_item_id, cycle_number)
);

CREATE INDEX IF NOT EXISTS idx_clinical_tpl_cycle_item ON public.clinical_template_cycle_codings(template_item_id);
CREATE INDEX IF NOT EXISTS idx_clinical_tpl_cycle_diag ON public.clinical_template_cycle_codings(diagnosis_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.clinical_diagnosis_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_diagnosis_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_template_cycle_codings ENABLE ROW LEVEL SECURITY;

-- 5. RLS Read Policies (Doctor/Staff query access)
CREATE POLICY "Allow authenticated read clinical_diagnosis_templates"
    ON public.clinical_diagnosis_templates FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Allow anon read clinical_diagnosis_templates"
    ON public.clinical_diagnosis_templates FOR SELECT
    TO anon
    USING (TRUE);

CREATE POLICY "Allow authenticated read clinical_diagnosis_template_items"
    ON public.clinical_diagnosis_template_items FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Allow anon read clinical_diagnosis_template_items"
    ON public.clinical_diagnosis_template_items FOR SELECT
    TO anon
    USING (TRUE);

CREATE POLICY "Allow authenticated read clinical_template_cycle_codings"
    ON public.clinical_template_cycle_codings FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Allow anon read clinical_template_cycle_codings"
    ON public.clinical_template_cycle_codings FOR SELECT
    TO anon
    USING (TRUE);

-- 6. Helper Function & Seed of TT06 Clinical Diagnosis Templates
CREATE OR REPLACE FUNCTION public._seed_tt06_template_entry(
    p_org_id UUID,
    p_primary_code TEXT,
    p_s1_code TEXT, p_s1_notes TEXT, p_s1_c1 TEXT, p_s1_c2 TEXT, p_s1_c3 TEXT,
    p_s2_code TEXT, p_s2_notes TEXT, p_s2_c1 TEXT, p_s2_c2 TEXT, p_s2_c3 TEXT,
    p_s3_code TEXT, p_s3_notes TEXT, p_s3_c1 TEXT, p_s3_c2 TEXT, p_s3_c3 TEXT
) RETURNS VOID AS $$
DECLARE
    v_diag_id UUID;
    v_tpl_id UUID;
    v_svc_id UUID;
    v_item_id UUID;
    v_cycle_diag_id UUID;
BEGIN
    -- Resolve primary diagnosis
    SELECT id INTO v_diag_id FROM public.diagnosis_catalog WHERE code_system = 'ICD10_YHCT' AND code = p_primary_code LIMIT 1;
    IF v_diag_id IS NULL THEN
        RAISE EXCEPTION 'Primary diagnosis code % not found in diagnosis_catalog', p_primary_code;
    END IF;

    -- Insert or update template
    INSERT INTO public.clinical_diagnosis_templates (organization_id, diagnosis_id, source_regulation, source_version, effective_from, is_active)
    VALUES (p_org_id, v_diag_id, 'TT_06_2026', NULL, DATE '2026-08-01', TRUE)
    ON CONFLICT (organization_id, diagnosis_id, source_regulation, effective_from)
    DO UPDATE SET is_active = EXCLUDED.is_active, updated_at = NOW()
    RETURNING id INTO v_tpl_id;

    -- === ITEM 1 ===
    SELECT id INTO v_svc_id FROM public.service_catalog WHERE service_code = p_s1_code LIMIT 1;
    IF v_svc_id IS NULL THEN RAISE EXCEPTION 'Service code % not found in service_catalog', p_s1_code; END IF;

    INSERT INTO public.clinical_diagnosis_template_items (template_id, service_id, sequence_no, indication_notes, is_active)
    VALUES (v_tpl_id, v_svc_id, 1, p_s1_notes, TRUE)
    ON CONFLICT (template_id, service_id)
    DO UPDATE SET sequence_no = EXCLUDED.sequence_no, indication_notes = EXCLUDED.indication_notes, is_active = EXCLUDED.is_active
    RETURNING id INTO v_item_id;

    IF p_s1_c1 IS NOT NULL THEN
        SELECT id INTO v_cycle_diag_id FROM public.diagnosis_catalog WHERE code_system = 'ICD10_YHCT' AND code = p_s1_c1 LIMIT 1;
        IF v_cycle_diag_id IS NULL THEN RAISE EXCEPTION 'Cycle diag code % not found', p_s1_c1; END IF;
        INSERT INTO public.clinical_template_cycle_codings (template_item_id, cycle_number, diagnosis_id)
        VALUES (v_item_id, 1, v_cycle_diag_id)
        ON CONFLICT (template_item_id, cycle_number) DO UPDATE SET diagnosis_id = EXCLUDED.diagnosis_id;
    END IF;
    IF p_s1_c2 IS NOT NULL THEN
        SELECT id INTO v_cycle_diag_id FROM public.diagnosis_catalog WHERE code_system = 'ICD10_YHCT' AND code = p_s1_c2 LIMIT 1;
        IF v_cycle_diag_id IS NULL THEN RAISE EXCEPTION 'Cycle diag code % not found', p_s1_c2; END IF;
        INSERT INTO public.clinical_template_cycle_codings (template_item_id, cycle_number, diagnosis_id)
        VALUES (v_item_id, 2, v_cycle_diag_id)
        ON CONFLICT (template_item_id, cycle_number) DO UPDATE SET diagnosis_id = EXCLUDED.diagnosis_id;
    END IF;
    IF p_s1_c3 IS NOT NULL THEN
        SELECT id INTO v_cycle_diag_id FROM public.diagnosis_catalog WHERE code_system = 'ICD10_YHCT' AND code = p_s1_c3 LIMIT 1;
        IF v_cycle_diag_id IS NULL THEN RAISE EXCEPTION 'Cycle diag code % not found', p_s1_c3; END IF;
        INSERT INTO public.clinical_template_cycle_codings (template_item_id, cycle_number, diagnosis_id)
        VALUES (v_item_id, 3, v_cycle_diag_id)
        ON CONFLICT (template_item_id, cycle_number) DO UPDATE SET diagnosis_id = EXCLUDED.diagnosis_id;
    END IF;

    -- === ITEM 2 ===
    SELECT id INTO v_svc_id FROM public.service_catalog WHERE service_code = p_s2_code LIMIT 1;
    IF v_svc_id IS NULL THEN RAISE EXCEPTION 'Service code % not found in service_catalog', p_s2_code; END IF;

    INSERT INTO public.clinical_diagnosis_template_items (template_id, service_id, sequence_no, indication_notes, is_active)
    VALUES (v_tpl_id, v_svc_id, 2, p_s2_notes, TRUE)
    ON CONFLICT (template_id, service_id)
    DO UPDATE SET sequence_no = EXCLUDED.sequence_no, indication_notes = EXCLUDED.indication_notes, is_active = EXCLUDED.is_active
    RETURNING id INTO v_item_id;

    IF p_s2_c1 IS NOT NULL THEN
        SELECT id INTO v_cycle_diag_id FROM public.diagnosis_catalog WHERE code_system = 'ICD10_YHCT' AND code = p_s2_c1 LIMIT 1;
        IF v_cycle_diag_id IS NULL THEN RAISE EXCEPTION 'Cycle diag code % not found', p_s2_c1; END IF;
        INSERT INTO public.clinical_template_cycle_codings (template_item_id, cycle_number, diagnosis_id)
        VALUES (v_item_id, 1, v_cycle_diag_id)
        ON CONFLICT (template_item_id, cycle_number) DO UPDATE SET diagnosis_id = EXCLUDED.diagnosis_id;
    END IF;
    IF p_s2_c2 IS NOT NULL THEN
        SELECT id INTO v_cycle_diag_id FROM public.diagnosis_catalog WHERE code_system = 'ICD10_YHCT' AND code = p_s2_c2 LIMIT 1;
        IF v_cycle_diag_id IS NULL THEN RAISE EXCEPTION 'Cycle diag code % not found', p_s2_c2; END IF;
        INSERT INTO public.clinical_template_cycle_codings (template_item_id, cycle_number, diagnosis_id)
        VALUES (v_item_id, 2, v_cycle_diag_id)
        ON CONFLICT (template_item_id, cycle_number) DO UPDATE SET diagnosis_id = EXCLUDED.diagnosis_id;
    END IF;
    IF p_s2_c3 IS NOT NULL THEN
        SELECT id INTO v_cycle_diag_id FROM public.diagnosis_catalog WHERE code_system = 'ICD10_YHCT' AND code = p_s2_c3 LIMIT 1;
        IF v_cycle_diag_id IS NULL THEN RAISE EXCEPTION 'Cycle diag code % not found', p_s2_c3; END IF;
        INSERT INTO public.clinical_template_cycle_codings (template_item_id, cycle_number, diagnosis_id)
        VALUES (v_item_id, 3, v_cycle_diag_id)
        ON CONFLICT (template_item_id, cycle_number) DO UPDATE SET diagnosis_id = EXCLUDED.diagnosis_id;
    END IF;

    -- === ITEM 3 ===
    SELECT id INTO v_svc_id FROM public.service_catalog WHERE service_code = p_s3_code LIMIT 1;
    IF v_svc_id IS NULL THEN RAISE EXCEPTION 'Service code % not found in service_catalog', p_s3_code; END IF;

    INSERT INTO public.clinical_diagnosis_template_items (template_id, service_id, sequence_no, indication_notes, is_active)
    VALUES (v_tpl_id, v_svc_id, 3, p_s3_notes, TRUE)
    ON CONFLICT (template_id, service_id)
    DO UPDATE SET sequence_no = EXCLUDED.sequence_no, indication_notes = EXCLUDED.indication_notes, is_active = EXCLUDED.is_active
    RETURNING id INTO v_item_id;

    IF p_s3_c1 IS NOT NULL THEN
        SELECT id INTO v_cycle_diag_id FROM public.diagnosis_catalog WHERE code_system = 'ICD10_YHCT' AND code = p_s3_c1 LIMIT 1;
        IF v_cycle_diag_id IS NULL THEN RAISE EXCEPTION 'Cycle diag code % not found', p_s3_c1; END IF;
        INSERT INTO public.clinical_template_cycle_codings (template_item_id, cycle_number, diagnosis_id)
        VALUES (v_item_id, 1, v_cycle_diag_id)
        ON CONFLICT (template_item_id, cycle_number) DO UPDATE SET diagnosis_id = EXCLUDED.diagnosis_id;
    END IF;
    IF p_s3_c2 IS NOT NULL THEN
        SELECT id INTO v_cycle_diag_id FROM public.diagnosis_catalog WHERE code_system = 'ICD10_YHCT' AND code = p_s3_c2 LIMIT 1;
        IF v_cycle_diag_id IS NULL THEN RAISE EXCEPTION 'Cycle diag code % not found', p_s3_c2; END IF;
        INSERT INTO public.clinical_template_cycle_codings (template_item_id, cycle_number, diagnosis_id)
        VALUES (v_item_id, 2, v_cycle_diag_id)
        ON CONFLICT (template_item_id, cycle_number) DO UPDATE SET diagnosis_id = EXCLUDED.diagnosis_id;
    END IF;
    IF p_s3_c3 IS NOT NULL THEN
        SELECT id INTO v_cycle_diag_id FROM public.diagnosis_catalog WHERE code_system = 'ICD10_YHCT' AND code = p_s3_c3 LIMIT 1;
        IF v_cycle_diag_id IS NULL THEN RAISE EXCEPTION 'Cycle diag code % not found', p_s3_c3; END IF;
        INSERT INTO public.clinical_template_cycle_codings (template_item_id, cycle_number, diagnosis_id)
        VALUES (v_item_id, 3, v_cycle_diag_id)
        ON CONFLICT (template_item_id, cycle_number) DO UPDATE SET diagnosis_id = EXCLUDED.diagnosis_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. Execute Seeds for Organization THUAN_THIEN
DO $$
DECLARE
    v_org_id UUID;
BEGIN
    SELECT id INTO v_org_id FROM public.organizations WHERE code = 'THUAN_THIEN' LIMIT 1;
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'ORGANIZATION_SEED_KEY_REQUIRED: Organization with code THUAN_THIEN not found.';
    END IF;

    -- Template 1: U62.151.8 (Các thoái hoá đa khớp khác)
    PERFORM public._seed_tt06_template_entry(
        v_org_id, 'U62.151.8',
        'BO_THUOC', 'THK GỐI', 'U62.261.1', 'U62.261.5', 'U62.261.1',
        'DIEN_CHAM', 'THK LƯNG, VAI GÁY', 'U62.151.8', 'U62.151.8', 'U62.151.8',
        'NGAM_THUOC', 'MẤT NGỦ', 'U55.621.0', 'U55.621.8', 'U55.621.8'
    );

    -- Template 2: U59.401.3 (Viêm mũi dị ứng khác)
    PERFORM public._seed_tt06_template_entry(
        v_org_id, 'U59.401.3',
        'BO_THUOC', 'THK GỐI', 'U62.261.1', 'U62.261.5', 'U62.261.5',
        'DIEN_CHAM', 'VIÊM MŨI XOANG', 'U59.401.3', 'U59.401.3', 'U59.401.3',
        'NGAM_THUOC', 'MẤT NGỦ', 'U55.621.0', 'U55.621.8', 'U55.621.8'
    );

    -- Template 3: U59.431.8 (Viêm xoang mạn tính khác)
    PERFORM public._seed_tt06_template_entry(
        v_org_id, 'U59.431.8',
        'BO_THUOC', 'THK GỐI', 'U62.261.1', 'U62.261.5', 'U62.261.5',
        'DIEN_CHAM', 'VIÊM MŨI XOANG', 'U59.431.8', 'U59.431.8', 'U59.431.8',
        'NGAM_THUOC', 'MẤT NGỦ', 'U55.621.0', 'U55.621.8', 'U55.621.8'
    );

    -- Template 4: U57.011.8 (Rối loạn chức năng tiền đình khác)
    PERFORM public._seed_tt06_template_entry(
        v_org_id, 'U57.011.8',
        'BO_THUOC', 'THK GỐI', 'U62.261.1', 'U62.261.5', 'U62.261.1',
        'DIEN_CHAM', 'TIỀN ĐÌNH', 'U57.011.8', 'U57.011.9', 'U57.011.8',
        'NGAM_THUOC', 'MẤT NGỦ', 'U55.621.0', 'U55.621.8', 'U55.621.8'
    );

    -- Template 5: U57.011.9 (Rối loạn chức năng tiền đình không đặc hiệu)
    PERFORM public._seed_tt06_template_entry(
        v_org_id, 'U57.011.9',
        'BO_THUOC', 'THK GỐI', 'U62.261.1', 'U62.261.5', 'U62.261.1',
        'DIEN_CHAM', 'TIỀN ĐÌNH', 'U57.011.8', 'U57.011.9', 'U57.011.8',
        'NGAM_THUOC', 'MẤT NGỦ', 'U55.621.0', 'U55.621.8', 'U55.621.8'
    );

    -- Template 6: U55.561.3 (Co thắt và giật nửa mặt)
    PERFORM public._seed_tt06_template_entry(
        v_org_id, 'U55.561.3',
        'BO_THUOC', 'THK GỐI', 'U62.261.1', 'U62.261.5', 'U62.261.1',
        'DIEN_CHAM', 'TIC CƠ MẶT', 'U55.561.3', 'U55.561.3', 'U55.561.3',
        'NGAM_THUOC', 'MẤT NGỦ', 'U55.621.0', 'U55.621.8', 'U55.621.8'
    );

    -- Template 7: U62.031.9 (Viêm khớp dạng thấp không đặc hiệu)
    PERFORM public._seed_tt06_template_entry(
        v_org_id, 'U62.031.9',
        'BO_THUOC', 'THK GỐI', 'U62.261.1', 'U62.261.5', 'U62.261.1',
        'THUY_CHAM', 'VIÊM KHỚP DT', 'U62.031.9', 'U62.031.9', 'U62.031.9',
        'NGAM_THUOC', 'MẤT NGỦ', 'U55.621.0', 'U55.621.8', 'U55.621.8'
    );

    -- Template 8: U55.451.9 (Bệnh đa dây thần kinh, không đặc hiệu)
    PERFORM public._seed_tt06_template_entry(
        v_org_id, 'U55.451.9',
        'BO_THUOC', 'THK GỐI', 'U62.261.1', 'U62.261.5', 'U62.261.1',
        'HAO_CHAM', 'BỆNH ĐA DÂY TK', 'U55.451.9', 'U55.451.9', 'U55.451.9',
        'NGAM_THUOC', 'MẤT NGỦ', 'U55.621.0', 'U55.621.8', 'U55.621.8'
    );

    -- Template 9: U55.481.2 (Đau đầu do căng thẳng)
    PERFORM public._seed_tt06_template_entry(
        v_org_id, 'U55.481.2',
        'BO_THUOC', 'THK GỐI', 'U62.261.1', 'U62.261.5', 'U62.261.1',
        'HAO_CHAM', 'ĐAU ĐẦU', 'U55.481.2', 'U55.481.2', 'U55.481.2',
        'NGAM_THUOC', 'MẤT NGỦ', 'U55.621.0', 'U55.621.8', 'U55.621.8'
    );

    -- Template 10: U55.561.8 (Bệnh khác của dây thần kinh mặt)
    PERFORM public._seed_tt06_template_entry(
        v_org_id, 'U55.561.8',
        'BO_THUOC', 'THK GỐI', 'U62.261.1', 'U62.261.5', 'U62.261.1',
        'HAO_CHAM', 'LIỆT MẶT', 'U55.561.8', 'U55.561.8', 'U55.561.8',
        'NGAM_THUOC', 'MẤT NGỦ', 'U55.621.0', 'U55.621.8', 'U55.621.8'
    );

    -- Template 11: U55.141.1 (Liệt chi dưới mã phụ)
    PERFORM public._seed_tt06_template_entry(
        v_org_id, 'U55.141.1',
        'XOA_BOP', 'LIỆT CHI DƯỚI', 'U55.141.1', 'U55.141.1', 'U55.141.1',
        'DIEN_CHAM', 'THK LƯNG, VAI GÁY', 'U62.151.8', 'U62.151.8', 'U62.151.8',
        'NGAM_THUOC', 'MẤT NGỦ', 'U55.621.0', 'U55.621.8', 'U55.621.8'
    );

    -- Template 12: U55.141.2 (Liệt chi trên mã phụ)
    PERFORM public._seed_tt06_template_entry(
        v_org_id, 'U55.141.2',
        'XOA_BOP', 'LIỆT CHI TRÊN', 'U55.141.2', 'U55.141.2', 'U55.141.2',
        'DIEN_CHAM', 'THK LƯNG, VAI GÁY', 'U62.151.8', 'U62.151.8', 'U62.151.8',
        'NGAM_THUOC', 'MẤT NGỦ', 'U55.621.0', 'U55.621.8', 'U55.621.8'
    );

    -- Template 13: U55.481.1 (Đau đầu)
    PERFORM public._seed_tt06_template_entry(
        v_org_id, 'U55.481.1',
        'XOA_BOP', 'ĐAU ĐẦU', 'U55.481.1', 'U55.481.1', 'U55.481.1',
        'DIEN_CHAM', 'VIÊM MŨI XOANG', 'U59.431.8', 'U59.431.8', 'U59.431.8',
        'NGAM_THUOC', 'MẤT NGỦ', 'U55.621.0', 'U55.621.8', 'U55.621.8'
    );

    -- Template 14: U55.501.0 (Đau dây thần kinh V)
    PERFORM public._seed_tt06_template_entry(
        v_org_id, 'U55.501.0',
        'XOA_BOP', 'ĐAU DÂY TK V', 'U55.501.0', 'U55.501.0', 'U55.501.0',
        'THUY_CHAM', 'VIÊM KHỚP DT', 'U62.031.9', 'U62.031.9', 'U62.031.9',
        'NGAM_THUOC', 'MẤT NGỦ', 'U55.621.0', 'U55.621.8', 'U55.621.8'
    );

    -- Template 15: U62.151.9 (Thoái hoá đa khớp khác, không đặc hiệu)
    PERFORM public._seed_tt06_template_entry(
        v_org_id, 'U62.151.9',
        'XOA_BOP', 'THOÁI HÓA KHỚP', 'U62.151.9', 'U62.261.5', 'U62.261.1',
        'HAO_CHAM', 'LIỆT MẶT', 'U55.561.8', 'U55.561.8', 'U55.561.8',
        'NGAM_THUOC', 'MẤT NGỦ', 'U55.621.0', 'U55.621.8', 'U55.621.8'
    );
END $$;

-- 8. Drop Temporary Seed Helper Function
DROP FUNCTION IF EXISTS public._seed_tt06_template_entry;
