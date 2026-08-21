import { redirect } from "next/navigation";
import { getCurrentAuthUser } from "@/lib/auth/auth-resolver";
import {
  requireCurrentStaff,
  StaffNotLinkedError,
  StaffInactiveError,
} from "@/lib/auth/staff-resolver";
import { getCurrentStaffClinicMemberships } from "@/lib/auth/clinic-resolver";
import { getActiveClinicContext } from "@/lib/auth/clinic-context";
import { SelectClinicClientView } from "@/components/auth/SelectClinicClientView";
import { AccessDeniedView } from "@/components/auth/AccessDeniedView";

export const metadata = {
  title: "Chọn Cơ Sở Làm Việc |  Clinic",
  description: "Chọn cơ sở phòng khám làm việc cho phiên đăng nhập hiện tại.",
};

export default async function SelectClinicPage() {
  const authUser = await getCurrentAuthUser();
  if (!authUser) {
    redirect("/login");
  }

  let staff;
  try {
    staff = await requireCurrentStaff();
  } catch (error: unknown) {
    if (error instanceof StaffNotLinkedError) {
      return <AccessDeniedView code="STAFF_NOT_LINKED" />;
    }
    if (error instanceof StaffInactiveError) {
      return <AccessDeniedView code="STAFF_INACTIVE" />;
    }
    throw error;
  }

  const memberships = await getCurrentStaffClinicMemberships();
  const activeContext = await getActiveClinicContext();

  return (
    <SelectClinicClientView
      staffName={staff.full_name}
      staffCode={staff.staff_code}
      memberships={memberships}
      currentActiveClinicId={activeContext?.id || null}
    />
  );
}
