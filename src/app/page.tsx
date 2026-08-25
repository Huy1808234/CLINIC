import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getReceptionStats } from "@/rsc-data/reception/get-reception-stats";
import { requireApplicationPageAccessContext } from "@/lib/auth/application-access";
import { getCurrentStaffRolesForClinic } from "@/lib/auth/role-resolver";
import { DashboardClientView } from "@/components/dashboard/DashboardClientView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tổng Quan | Thuận Thiên Clinic",
  description: "Bảng điều khiển hoạt động trung tâm phòng khám Thuận Thiên.",
};

export default async function HomePage() {
  const accessContext = await requireApplicationPageAccessContext();
  const [activeRoles, stats] = await Promise.all([
    getCurrentStaffRolesForClinic(accessContext.clinic.clinic_id),
    getReceptionStats(),
  ]);

  return (
    <AppShell
      title="Thuận Thiên Clinic"
      subtitle="Hệ thống quản lý phòng khám"
    >
      <DashboardClientView
        staff={accessContext.staff}
        clinic={accessContext.clinic}
        activeRoles={activeRoles}
        stats={stats}
      />
    </AppShell>
  );
}
