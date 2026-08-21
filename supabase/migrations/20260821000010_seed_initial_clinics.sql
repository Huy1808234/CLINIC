-- Migration: Seed Initial Confirmed Thuận Thiên Clinics
-- Spec Reference: GOAL MC-DATA1 — Initial Clinic Master Data

DO $$
DECLARE
    org_id UUID;
BEGIN
    -- 1. Resolve Organization ID for THUAN_THIEN
    SELECT id INTO org_id FROM public.organizations WHERE code = 'THUAN_THIEN' AND is_active = TRUE LIMIT 1;

    IF org_id IS NULL THEN
        RAISE EXCEPTION 'Organization THUAN_THIEN does not exist or is not active.';
    END IF;

    -- 2. Insert the 5 confirmed initial clinics (with NULL address and phone as unconfirmed)
    INSERT INTO public.clinics (organization_id, clinic_code, name, short_name, address, phone, timezone, is_active)
    VALUES
        (org_id, 'TT01', 'Thuận Thiên', 'Thuận Thiên', NULL, NULL, 'Asia/Ho_Chi_Minh', TRUE),
        (org_id, 'PN01', 'Phúc Nguyên', 'Phúc Nguyên', NULL, NULL, 'Asia/Ho_Chi_Minh', TRUE),
        (org_id, 'TP01', 'Tâm Phúc', 'Tâm Phúc', NULL, NULL, 'Asia/Ho_Chi_Minh', TRUE),
        (org_id, 'HP01', 'Hồng Phúc', 'Hồng Phúc', NULL, NULL, 'Asia/Ho_Chi_Minh', TRUE),
        (org_id, 'MD01', 'Minh Đức', 'Minh Đức', NULL, NULL, 'Asia/Ho_Chi_Minh', TRUE)
    ON CONFLICT (organization_id, clinic_code) DO NOTHING;
END $$;
