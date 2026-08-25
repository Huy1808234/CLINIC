import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireApplicationPageAccessContext } from "@/lib/auth/application-access";
import { getStaffList, getClinicsList } from "@/rsc-data/staff/get-staff";
import { StaffClientView } from "@/components/staff/StaffClientView";

export default async function StaffPage() {
  await requireApplicationPageAccessContext();
  const [staffList, clinics] = await Promise.all([
    getStaffList(),
    getClinicsList(),
  ]);

  return (
    <AppShell
      title="Quản Lý Nhân Sự & Phân Công Cơ Sở"
      subtitle="Quản lý nhân viên, tài khoản đăng nhập, vai trò và phân công cơ sở."
    >
      <StaffClientView initialStaff={staffList} clinics={clinics} />
    </AppShell>
  );
}
