import { z } from "zod";

export const signInSchema = z.object({
  email: z.preprocess(
    (val) => (typeof val === "string" ? val.trim().toLowerCase() : val),
    z
      .string()
      .min(1, "Vui lòng nhập địa chỉ email.")
      .email("Định dạng email không hợp lệ.")
  ),
  password: z.string().min(1, "Vui lòng nhập mật khẩu."),
});

export type SignInInput = z.input<typeof signInSchema>;
export type SignInParsed = z.output<typeof signInSchema>;

export const forgotPasswordSchema = z.object({
  email: z.preprocess(
    (val) => (typeof val === "string" ? val.trim().toLowerCase() : val),
    z
      .string()
      .min(1, "Vui lòng nhập địa chỉ email.")
      .email("Định dạng email không hợp lệ.")
  ),
});

export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;
export type ForgotPasswordParsed = z.output<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự."),
    confirm_password: z.string().min(1, "Vui lòng nhập xác nhận mật khẩu."),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Mật khẩu xác nhận không khớp.",
    path: ["confirm_password"],
  });

export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
export type ResetPasswordParsed = z.output<typeof resetPasswordSchema>;
