import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getReceptionStats } from "@/rsc-data/reception/get-reception-stats";
import { getTodayReceptions } from "@/rsc-data/reception/get-receptions";
import { getCatalogs } from "@/rsc-data/treatment/get-catalogs";
import { ReceptionClientView } from "@/components/reception/ReceptionClientView";
import { requireApplicationPageAccessContext } from "@/lib/auth/application-access";
import { getCurrentStaffRolesForClinic } from "@/lib/auth/role-resolver";

export default async function ReceptionPage() {
  const accessContext = await requireApplicationPageAccessContext();
  const activeRoles = await getCurrentStaffRolesForClinic(accessContext.clinic.clinic_id);
  const isDoctor = activeRoles.includes("DOCTOR");

  const [stats, queue, catalogs] = await Promise.all([
    getReceptionStats(),
    getTodayReceptions(),
    getCatalogs(),
  ]);

  return (
    <AppShell
      title="Tiếp Nhận & Đăng Ký Khám Bệnh"
      subtitle="Quản lý hàng đợi tiếp đón và chỉ định bác sĩ điều trị Y Học Cổ Truyền"
    >
      <ReceptionClientView
        initialStats={stats}
        initialQueue={queue}
        catalogs={catalogs}
        isDoctor={isDoctor}
      />
    </AppShell>
  );
}
