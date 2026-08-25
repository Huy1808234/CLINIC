-- Migration: Seed Verified TT06 YHCT Diagnoses into Diagnosis Catalog
-- Spec Reference: CURRENT_GOAL = DIAGNOSIS-CATALOG-TT06-IMPORT1

-- 1. Ensure unique constraint on (code_system, code) exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_diag_code_system'
    ) THEN
        ALTER TABLE public.diagnosis_catalog
        ADD CONSTRAINT uq_diag_code_system UNIQUE (code_system, code);
    END IF;
END $$;

-- 2. Idempotent Seed of 21 Verified TT06 YHCT Diagnoses
INSERT INTO public.diagnosis_catalog (code_system, code, name, is_active)
VALUES
    ('ICD10_YHCT', 'U55.141.1', 'Liệt chi dưới (Mã phụ)', TRUE),
    ('ICD10_YHCT', 'U55.141.2', 'Liệt chi trên (Mã phụ)', TRUE),
    ('ICD10_YHCT', 'U55.451.9', 'Bệnh đa dây thần kinh, không đặc hiệu', TRUE),
    ('ICD10_YHCT', 'U55.481.1', 'Đau đầu do căng thẳng (Đau đầu mạn tính)', TRUE),
    ('ICD10_YHCT', 'U55.481.2', 'Đau đầu do căng thẳng', TRUE),
    ('ICD10_YHCT', 'U55.501.0', 'Đau dây thần kinh V (Đau dây thần kinh sinh ba)', TRUE),
    ('ICD10_YHCT', 'U55.531', 'Tổn thương thần kinh liên sườn (Đau thần kinh liên sườn)', TRUE),
    ('ICD10_YHCT', 'U55.561.3', 'Co thắt và giật nửa mặt (Tic cơ mặt)', TRUE),
    ('ICD10_YHCT', 'U55.561.8', 'Bệnh khác của dây thần kinh mặt (Liệt mặt)', TRUE),
    ('ICD10_YHCT', 'U55.621.0', 'Rối loạn giấc ngủ (Mất ngủ)', TRUE),
    ('ICD10_YHCT', 'U55.621.8', 'Rối loạn giấc ngủ khác (Mất ngủ khác)', TRUE),
    ('ICD10_YHCT', 'U57.011.8', 'Rối loạn chức năng tiền đình khác', TRUE),
    ('ICD10_YHCT', 'U57.011.9', 'Rối loạn chức năng tiền đình, không đặc hiệu', TRUE),
    ('ICD10_YHCT', 'U59.401.3', 'Viêm mũi dị ứng khác', TRUE),
    ('ICD10_YHCT', 'U59.431.8', 'Viêm xoang mạn tính khác', TRUE),
    ('ICD10_YHCT', 'U59.431.9', 'Viêm mũi xoang mạn tính khác (Xông mũi xoang)', TRUE),
    ('ICD10_YHCT', 'U62.031.9', 'Viêm khớp dạng thấp không đặc hiệu', TRUE),
    ('ICD10_YHCT', 'U62.151.8', 'Các thoái hoá đa khớp khác', TRUE),
    ('ICD10_YHCT', 'U62.151.9', 'Thoái hoá đa khớp khác, không đặc hiệu', TRUE),
    ('ICD10_YHCT', 'U62.261.1', 'Thoái hoá khớp gối (Bó thuốc / Điện châm khớp gối)', TRUE),
    ('ICD10_YHCT', 'U62.261.5', 'Thoái hoá khớp gối khác (Bó thuốc / Điện châm khớp gối)', TRUE)
ON CONFLICT (code_system, code) DO UPDATE
SET
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

COMMENT ON TABLE public.diagnosis_catalog IS 'Canonical medical diagnosis catalog supporting ICD-10 and TT06 YHCT standards.';
