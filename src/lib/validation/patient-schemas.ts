import { z } from "zod";

const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const uuidSchema = z.string().regex(uuidPattern, "ID không hợp lệ");

export const patientFormSchema = z.object({
  full_name: z.string().min(2, "Họ tên phải có ít nhất 2 ký tự").max(100),
  phone: z.string().optional().nullable(),
  citizen_id: z.string().optional().nullable(),
  citizen_id_issued_at: z.string().optional().nullable(),
  citizen_id_issued_by: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  birth_year: z.number().int().min(1900).max(2100).optional().nullable(),
  dob_precision: z.enum(["DATE", "YEAR_ONLY", "UNKNOWN"]).default("DATE"),
  sex: z.enum(["NAM", "NU", "KHAC"]).optional().nullable(),
  address: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),

  // Optional attached Insurance Card
  insurance_card_number: z.string().optional().nullable(),
  registered_facility_code: z.string().optional().nullable(),
  registered_facility_name: z.string().optional().nullable(),
  benefit_rate: z.number().min(0).max(100).optional().nullable(),
  insurance_valid_from: z.string().optional().nullable(),
  insurance_valid_to: z.string().optional().nullable(),

  // Optional attached initial measurements
  height_cm: z.number().min(30).max(250).optional().nullable(),
  weight_kg: z.number().min(2).max(300).optional().nullable(),
});

export type PatientFormInput = z.infer<typeof patientFormSchema>;

export const patientSearchSchema = z.object({
  query: z.string().min(1, "Vui lòng nhập từ khóa tìm kiếm"),
  limit: z.number().int().min(1).max(50).default(20),
});

export type PatientSearchInput = z.infer<typeof patientSearchSchema>;

export const measurementSchema = z.object({
  patient_id: uuidSchema,
  height_cm: z.number().min(30).max(250).optional().nullable(),
  weight_kg: z.number().min(2).max(300).optional().nullable(),
  source: z.string().default("MANUAL"),
});

export type MeasurementInput = z.infer<typeof measurementSchema>;

export const patientAlertSchema = z.object({
  patient_id: uuidSchema,
  category: z.string().default("GENERAL"),
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]).default("INFO"),
  message: z.string().min(1, "Nội dung cảnh báo không được để trống"),
});

export type PatientAlertInput = z.infer<typeof patientAlertSchema>;
