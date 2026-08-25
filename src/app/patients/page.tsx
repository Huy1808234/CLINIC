import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireApplicationPageAccessContext } from "@/lib/auth/application-access";
import { getRecentPatients } from "@/rsc-data/patients/search-patients";
import { PatientClientView } from "@/components/patients/PatientClientView";

export default async function PatientsPage() {
  await requireApplicationPageAccessContext();
  const initialPatients = await getRecentPatients(50);

  return (
    <AppShell
      title="Quản Lý Hồ Sơ Bệnh Nhân"
      subtitle="Danh bạ bệnh nhân chuẩn hóa, thẻ bảo hiểm y tế và lịch sử trị liệu"
    >
      <PatientClientView initialPatients={initialPatients} />
    </AppShell>
  );
}
