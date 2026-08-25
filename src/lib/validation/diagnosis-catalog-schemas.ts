import { z } from "zod";

export const diagnosisCatalogSearchQuerySchema = z.object({
  search: z.string().optional().default(""),
  codeSystem: z.string().optional().default("ALL"),
  status: z.enum(["ALL", "ACTIVE", "INACTIVE"]).optional().default("ALL"),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z
    .coerce
    .number()
    .int()
    .refine((val) => [10, 20, 50].includes(val), {
      message: "pageSize must be 10, 20, or 50",
    })
    .optional()
    .default(20),
  sortBy: z
    .enum(["code", "name", "code_system", "is_active"])
    .optional()
    .default("code"),
  sortDirection: z.enum(["asc", "desc"]).optional().default("asc"),
});

export type DiagnosisCatalogSearchQuery = z.infer<
  typeof diagnosisCatalogSearchQuerySchema
>;
