import { z } from "zod";

const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const uuidSchema = z.string().regex(uuidPattern, "ID không hợp lệ");
const optionalUuid = z.preprocess((val) => (val === "" || val === undefined ? null : val), uuidSchema.optional().nullable());

export const createTreatmentCourseSchema = z.object({
  patient_id: uuidSchema,
  reception_id: optionalUuid,
  primary_doctor_id: optionalUuid,
  start_date: z.string().default(() => new Date().toISOString().slice(0, 10)),
  planned_session_count: z.number().int().min(1).nullable().optional().default(null),
  notes: z.string().optional().nullable(),
  diagnoses: z.array(
    z.object({
      diagnosis_id: optionalUuid,
      raw_code: z.string().optional().nullable(),
      raw_text: z.string().optional().nullable(),
      diagnosis_type: z.string().default("PRIMARY"),
      is_primary: z.boolean().default(true),
    })
  ).optional().default([]),
  service_orders: z.array(
    z.object({
      service_id: uuidSchema,
      ordered_by_doctor_id: optionalUuid,
      order_source: z.enum(["FIRST_PLAN", "DOCTOR_ACTUAL", "MIGRATION"]).default("FIRST_PLAN"),
      sequence_no: z.number().int().default(1),
      side_or_location: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    })
  ).optional().default([]),
  tags: z.array(
    z.object({
      tag_id: uuidSchema,
      note: z.string().optional().nullable(),
    })
  ).optional().default([]),
});

export type CreateTreatmentCourseInput = z.input<typeof createTreatmentCourseSchema>;
export type CreateTreatmentCourseParsed = z.output<typeof createTreatmentCourseSchema>;

export const updateTreatmentCourseSchema = z.object({
  status: z.enum(["PLANNED", "ACTIVE", "PAUSED", "COMPLETED", "DROPPED", "CANCELLED"]).optional(),
  adherence_status: z.enum(["NORMAL", "AT_RISK", "DROPPED"]).optional(),
  primary_doctor_id: optionalUuid,
  planned_session_count: z.number().int().min(1).max(30).optional(),
  notes: z.string().optional().nullable(),
});

export type UpdateTreatmentCourseInput = z.infer<typeof updateTreatmentCourseSchema>;
