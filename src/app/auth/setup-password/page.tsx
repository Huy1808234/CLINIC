import { redirect } from "next/navigation";
import { getCurrentAuthUser } from "@/lib/auth/auth-resolver";
import { getCurrentStaff } from "@/lib/auth/staff-resolver";
import { SetupPasswordForm } from "@/components/auth/SetupPasswordForm";

export const metadata = {
  title: "Thiết Lập Mật Khẩu | Thuận Thiên Clinic",
  description: "Thiết lập mật khẩu ban đầu cho tài khoản nhân viên.",
};

export default async function SetupPasswordPage() {
  const authUser = await getCurrentAuthUser();
  if (!authUser) {
    redirect("/login");
  }

  const staff = await getCurrentStaff();
  if (!staff) {
    // Unlinked user
    redirect("/login");
  }

  // If initial password setup is already completed, redirect to clinic selection
  if (!staff.auth_setup_required) {
    redirect("/select-clinic");
  }

  return <SetupPasswordForm />;
}
