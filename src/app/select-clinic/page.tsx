import { redirect } from "next/navigation";
import { getCurrentAuthUser } from "@/lib/auth/auth-resolver";
import {
  requireCurrentStaff,
  StaffNotLinkedError,
  StaffInactiveError,
} from "@/lib/auth/staff-resolver";
import { getCurrentStaffClinicMemberships } from "@/lib/auth/clinic-resolver";
import { getCurrentStaffRolesForClinic } from "@/lib/auth/role-resolver";
import { getActiveClinicContext } from "@/lib/auth/clinic-context";
import { getStaffClinicPreference } from "@/lib/auth/staff-preferences";
import { SelectClinicClientView } from "@/components/auth/SelectClinicClientView";
import { AccessDeniedView } from "@/components/auth/AccessDeniedView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Chọn Cơ Sở Làm Việc | Thuận Thiên Clinic",
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

  const rawMemberships = await getCurrentStaffClinicMemberships();
  const preference = await getStaffClinicPreference(staff.id);
  const activeContext = await getActiveClinicContext();

  // Pre-fetch roles in parallel on the server to prevent client-side N+1 waterfalls
  const memberships = await Promise.all(
    rawMemberships.map(async (m) => ({
      ...m,
      roles: await getCurrentStaffRolesForClinic(m.clinic_id),
    }))
  );

  return (
    <SelectClinicClientView
      staffName={staff.full_name}
      staffCode={staff.staff_code}
      memberships={memberships}
      currentActiveClinicId={activeContext?.id || null}
      lastSelectedClinicId={preference?.last_selected_clinic_id || null}
    />
  );
}
