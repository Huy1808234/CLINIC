import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata = {
  title: "Quên Mật Khẩu | Thuận Thiên Clinic",
  description: "Yêu cầu đặt lại mật khẩu cho tài khoản phòng khám Thuận Thiên.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
