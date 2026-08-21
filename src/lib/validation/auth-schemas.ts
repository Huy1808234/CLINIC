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
