import { z } from "zod";

const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const uuidSchema = z.string().regex(uuidPattern, "ID không hợp lệ");
const optionalUuid = z.preprocess((val) => (val === "" || val === undefined ? null : val), uuidSchema.optional().nullable());

export const autoScheduleSchema = z.object({
  treatment_course_id: uuidSchema,
  doctor_id: uuidSchema,
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày bắt đầu phải theo định dạng YYYY-MM-DD"),
  schedule_count: z.number().int().min(1, "Số lịch muốn xếp phải lớn hơn 0"),
  preferred_time: z.string().regex(/^\d{1,2}:\d{2}(:\d{2})?$/, "Giờ hẹn phải theo định dạng HH:mm").optional().nullable(),
  selected_weekdays: z.array(z.number().int().min(1).max(6)).optional().default([1, 2, 3, 4, 5, 6]),
});

export type AutoScheduleSchemaInput = z.infer<typeof autoScheduleSchema>;

export const createAppointmentSchema = z.object({
  patient_id: uuidSchema,
  treatment_course_id: uuidSchema,
  doctor_id: optionalUuid,
  appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduled_start_at: z.string(),
  notes: z.string().optional().nullable(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const rescheduleAppointmentSchema = z.object({
  appointment_id: uuidSchema,
  new_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  new_start_at: z.string(),
  new_doctor_id: optionalUuid,
  manual_override: z.boolean().default(true),
  notes: z.string().optional().nullable(),
});

export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;

export const updateAppointmentStatusSchema = z.object({
  appointment_id: uuidSchema,
  status: z.enum([
    "PLANNED",
    "CONFIRMED",
    "CHECKED_IN",
    "IN_EXAM",
    "IN_TREATMENT",
    "COMPLETED",
    "NO_SHOW",
    "CANCELLED",
    "RESCHEDULED",
  ]),
  notes: z.string().optional().nullable(),
});

export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusSchema>;
