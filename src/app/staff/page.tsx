import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getStaffList, getClinicsList } from "@/rsc-data/staff/get-staff";
import { StaffClientView } from "@/components/staff/StaffClientView";

export default async function StaffPage() {
  const [staffList, clinics] = await Promise.all([
    getStaffList(),
    getClinicsList(),
  ]);

  return (
    <AppShell
      title="Quản Lý Nhân Sự & Phân Công Cơ Sở"
      subtitle="Hồ sơ nhân viên, phân quyền đa vai trò và phân công làm việc tại các cơ sở phòng khám"
    >
      <div className="max-w-7xl mx-auto">
        <StaffClientView initialStaff={staffList} clinics={clinics} />
      </div>
    </AppShell>
  );
}
