import { z } from "zod";
import { patientFormSchema } from "./patient-schemas";

const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const uuidSchema = z.string().regex(uuidPattern, "ID không hợp lệ");
const optionalUuid = z.preprocess((val) => (val === "" || val === undefined ? null : val), uuidSchema.optional().nullable());

export const createReceptionSchema = z.object({
  // Patient details (either existing patient_id or patient form data)
  patient_id: optionalUuid,
  patient_data: patientFormSchema.optional(),

  // Reception details
  reception_source: z.enum(["MANUAL", "HIS_IMPORTED", "PAPER_FILE", "EXCEL_MIGRATION"]).optional().default("MANUAL"),
  patient_relation_type: z.enum(["NEW", "RETURNING"]).optional().default("NEW"),
  reason_for_visit: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),

  // Course configuration if creating / continuing course during reception
  create_course: z.boolean().optional().default(true),
  doctor_id: optionalUuid,
  start_date: z.string().optional().default(() => new Date().toISOString().slice(0, 10)),
  diagnoses: z
    .array(
      z.object({
        diagnosis_id: optionalUuid,
        raw_code: z.string().optional().nullable(),
        raw_text: z.string().optional().nullable(),
        is_primary: z.boolean().optional().default(true),
      })
    )
    .max(0, "Chẩn đoán chính thức phải được bác sĩ ghi nhận trong bước khám.")
    .optional()
    .default([]),
  service_orders: z
    .array(
      z.object({
        service_id: uuidSchema,
        order_source: z.enum(["FIRST_PLAN", "DOCTOR_ACTUAL", "MIGRATION"]).optional().default("FIRST_PLAN"),
        sequence_no: z.number().int().optional().default(1),
        side_or_location: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .max(0, "Chỉ định DVKT phải được thực hiện trong bước khám của bác sĩ.")
    .optional()
    .default([]),
});

export type CreateReceptionInput = z.input<typeof createReceptionSchema>;
export type CreateReceptionParsed = z.output<typeof createReceptionSchema>;
