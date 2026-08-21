import { redirect } from "next/navigation";
import { getCurrentAuthUser } from "@/lib/auth/auth-resolver";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = {
  title: "Đăng Nhập | Thuận Thiên Clinic",
  description: "Đăng nhập hệ thống quản lý phòng khám Thuận Thiên.",
};

export default async function LoginPage() {
  const authUser = await getCurrentAuthUser();
  if (authUser) {
    redirect("/select-clinic");
  }

  return <LoginForm />;
}
