import { z } from "zod";

const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const uuidSchema = z.string().regex(uuidPattern, "ID không hợp lệ");

export const staffRoleEnum = z.enum([
  "DOCTOR",
  "RECEPTIONIST",
  "TECHNICIAN",
  "Y_SI",
  "CSKH",
  "MANAGER",
  "ADMIN",
]);

export type StaffRole = z.infer<typeof staffRoleEnum>;

export const clinicAssignmentSchema = z.object({
  clinic_id: uuidSchema,
  is_primary: z.boolean().default(false),
  roles: z.array(staffRoleEnum).min(1, "Vui lòng chọn ít nhất một vai trò tại cơ sở"),
});

export type ClinicAssignmentInput = z.infer<typeof clinicAssignmentSchema>;

export const createStaffSchema = z.object({
  staff_code: z
    .string()
    .min(2, "Mã nhân viên phải có ít nhất 2 ký tự")
    .max(30, "Mã nhân viên tối đa 30 ký tự")
    .toUpperCase(),
  full_name: z.string().min(2, "Họ tên phải có ít nhất 2 ký tự").max(100),
  role_type: staffRoleEnum.default("DOCTOR"),
  phone: z.string().optional().nullable(),
  email: z
    .string()
    .email("Email không hợp lệ")
    .optional()
    .nullable()
    .or(z.literal("")),
  is_active: z.boolean().default(true),
  clinic_assignments: z
    .array(clinicAssignmentSchema)
    .min(1, "Nhân viên mới phải được phân công ít nhất một cơ sở."),
});

export type CreateStaffInput = z.input<typeof createStaffSchema>;
export type CreateStaffParsed = z.output<typeof createStaffSchema>;

export const updateStaffSchema = z.object({
  id: uuidSchema,
  full_name: z.string().min(2, "Họ tên phải có ít nhất 2 ký tự").max(100).optional(),
  role_type: staffRoleEnum.optional(),
  phone: z.string().optional().nullable(),
  email: z
    .string()
    .email("Email không hợp lệ")
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

export const assignClinicMembershipSchema = z.object({
  staff_id: uuidSchema,
  clinic_id: uuidSchema,
  is_primary: z.boolean().default(false),
  roles: z.array(staffRoleEnum).min(1, "Vui lòng chọn ít nhất một vai trò"),
});

export type AssignClinicMembershipInput = z.infer<typeof assignClinicMembershipSchema>;

export const updateClinicRolesSchema = z.object({
  membership_id: uuidSchema,
  roles: z.array(staffRoleEnum).min(1, "Vui lòng chọn ít nhất một vai trò"),
});

export type UpdateClinicRolesInput = z.infer<typeof updateClinicRolesSchema>;
