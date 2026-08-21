-- Migration: Seed Baseline Data for Thuận Thiên Clinic
-- Spec Reference: THUAN_THIEN_RECEPTION_SCHEDULING_TECHLEAD_SPEC_V1.md §28

-- 1. Seed Default Doctors and Staff
INSERT INTO public.staff (id, staff_code, full_name, role_type, is_active)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'BS-ANHTHU', 'BS Anh Thư', 'DOCTOR', TRUE),
    ('a0000000-0000-0000-0000-000000000002', 'BS-TUAN', 'BS Tuấn', 'DOCTOR', TRUE),
    ('a0000000-0000-0000-0000-000000000003', 'BS-KHA', 'BS Kha', 'DOCTOR', TRUE),
    ('a0000000-0000-0000-0000-000000000004', 'BS-NGOCTHU', 'BS Ngọc Thu', 'DOCTOR', TRUE),
    ('a0000000-0000-0000-0000-000000000005', 'LT-MAIN', 'Lễ Tân Thuận Thiên', 'RECEPTIONIST', TRUE),
    ('a0000000-0000-0000-0000-000000000006', 'ADMIN-01', 'Quản Trị Hệ Thống', 'ADMIN', TRUE)
ON CONFLICT (staff_code) DO NOTHING;

-- 2. Seed Default Scheduling Settings
INSERT INTO public.scheduling_settings (
    id,
    slot_interval_minutes,
    clinic_open_time,
    clinic_close_time,
    lunch_start,
    lunch_end,
    max_daily_patients_per_doctor,
    default_treatment_frequency,
    follow_up_inactivity_threshold_days
)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    5,
    '07:00:00',
    '17:00:00',
    '11:30:00',
    '13:00:00',
    64,
    'DAILY',
    3
)
ON CONFLICT (id) DO NOTHING;

-- 3. Seed Service Catalog (DVKT)
INSERT INTO public.service_catalog (service_code, service_name, service_group, default_duration_minutes, setup_minutes, cleanup_minutes, required_resource_type, is_active)
VALUES
    ('BO_THUOC', 'Bó thuốc YHCT', 'YHCT', 30, 1, 1, 'BED', TRUE),
    ('DIEN_CHAM', 'Điện châm', 'YHCT', 25, 1, 1, 'MACHINE', TRUE),
    ('HAO_CHAM', 'Hào châm', 'YHCT', 25, 1, 1, 'BED', TRUE),
    ('XONG_THUOC', 'Xông thuốc YHCT', 'YHCT', 20, 1, 1, 'MACHINE', TRUE),
    ('NGAM_THUOC', 'Ngâm thuốc YHCT', 'YHCT', 20, 1, 1, 'MACHINE', TRUE),
    ('THUY_CHAM', 'Thủy châm', 'YHCT', 15, 1, 1, 'BED', TRUE),
    ('XOA_BOP', 'Xoa bóp bấm huyệt', 'YHCT', 20, 1, 1, 'BED', TRUE),
    ('KEO_COT_SONG', 'Kéo nắn cột sống K5-K10', 'PHCN', 15, 1, 1, 'MACHINE', TRUE)
ON CONFLICT (service_code) DO NOTHING;

-- 4. Seed Resource Groups (Combo máy 1..15)
INSERT INTO public.resource_groups (code, name, is_active)
VALUES
    ('COMBO-01', 'Combo Máy 01', TRUE),
    ('COMBO-02', 'Combo Máy 02', TRUE),
    ('COMBO-03', 'Combo Máy 03', TRUE),
    ('COMBO-04', 'Combo Máy 04', TRUE),
    ('COMBO-05', 'Combo Máy 05', TRUE),
    ('COMBO-06', 'Combo Máy 06', TRUE),
    ('COMBO-07', 'Combo Máy 07', TRUE),
    ('COMBO-08', 'Combo Máy 08', TRUE),
    ('COMBO-09', 'Combo Máy 09', TRUE),
    ('COMBO-10', 'Combo Máy 10', TRUE),
    ('COMBO-11', 'Combo Máy 11', TRUE),
    ('COMBO-12', 'Combo Máy 12', TRUE),
    ('COMBO-13', 'Combo Máy 13', TRUE),
    ('COMBO-14', 'Combo Máy 14', TRUE),
    ('COMBO-15', 'Combo Máy 15', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 5. Seed Course Tags
INSERT INTO public.course_tags (code, label, category)
VALUES
    ('K5', 'Kéo K5', 'TREATMENT'),
    ('K5_K7', 'Kéo K5-K7', 'TREATMENT'),
    ('BO', 'Bỏ liệu trình', 'ADHERENCE'),
    ('IN_KY', 'In & Ký hồ sơ', 'PAPERWORK'),
    ('NGUY_HIEM', 'Cảnh báo nguy hiểm / Theo dõi kỹ', 'CLINICAL_ALERT'),
    ('DAC_BIET', 'Lịch hẹn đặc biệt', 'SCHEDULING')
ON CONFLICT (code) DO NOTHING;
