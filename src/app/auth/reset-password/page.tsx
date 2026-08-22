import { getCurrentAuthUser } from "@/lib/auth/auth-resolver";
import { verifyRecoveryContextCookie } from "@/lib/auth/recovery-context";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata = {
  title: "Đặt Lại Mật Khẩu | Thuận Thiên Clinic",
  description: "Đặt lại mật khẩu cho tài khoản phòng khám Thuận Thiên.",
};

export default async function ResetPasswordPage() {
  const authUser = await getCurrentAuthUser();
  const hasRecoveryContext = authUser ? await verifyRecoveryContextCookie(authUser.id) : false;
  return <ResetPasswordForm isAuthenticated={!!authUser && hasRecoveryContext} />;
}
