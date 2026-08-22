import { z } from "zod";

const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const uuidSchema = z.string().regex(uuidPattern, "ID không hợp lệ");
const optionalUuid = z.preprocess((val) => (val === "" || val === undefined ? null : val), uuidSchema.optional().nullable());

export const recordCourseDiagnosisSchema = z
  .object({
    treatment_course_id: uuidSchema,
    diagnosis_id: optionalUuid,
    raw_code: z.string().optional().nullable(),
    raw_text: z.string().optional().nullable(),
    diagnosis_type: z.string().optional().default("PRIMARY"),
    is_primary: z.boolean().optional().default(true),
  })
  .refine(
    (data) => {
      const hasId = !!data.diagnosis_id;
      const hasCode = !!(data.raw_code && data.raw_code.trim().length > 0);
      const hasText = !!(data.raw_text && data.raw_text.trim().length > 0);
      return hasId || hasCode || hasText;
    },
    {
      message: "Vui lòng chọn chẩn đoán từ danh mục hoặc nhập mã/nội dung chẩn đoán.",
      path: ["diagnosis_id"],
    }
  );

export type RecordCourseDiagnosisInput = z.input<typeof recordCourseDiagnosisSchema>;
export type RecordCourseDiagnosisParsed = z.output<typeof recordCourseDiagnosisSchema>;

export const establishInitialTreatmentPlanSchema = z.object({
  course_id: uuidSchema,
  planned_session_count: z
    .number()
    .int("Số buổi phải là số nguyên")
    .min(1, "Số buổi điều trị phải lớn hơn 0"),
});

export type EstablishInitialTreatmentPlanInput = z.input<typeof establishInitialTreatmentPlanSchema>;
export type EstablishInitialTreatmentPlanParsed = z.output<typeof establishInitialTreatmentPlanSchema>;
