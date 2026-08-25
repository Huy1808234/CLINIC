import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getPatientHistory } from "@/rsc-data/patients/get-patient-history";
import { getCatalogs } from "@/rsc-data/treatment/get-catalogs";
import { requireApplicationPageAccessContext } from "@/lib/auth/application-access";
import { getCurrentStaffRolesForClinic } from "@/lib/auth/role-resolver";
import { Button } from "@/components/ui/Button";
import { PatientChartWorkspace } from "@/components/clinical/PatientChartWorkspace";

export const dynamic = "force-dynamic";

interface PatientDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default async function PatientDetailsPage({ params }: PatientDetailsPageProps) {
  const { id } = await params;
  const accessContext = await requireApplicationPageAccessContext();

  const [history, catalogs, roles] = await Promise.all([
    getPatientHistory(id),
    getCatalogs(accessContext.clinic.clinic_id),
    getCurrentStaffRolesForClinic(accessContext.clinic.clinic_id),
  ]);

  if (!history) {
    notFound();
  }

  const isDoctor = roles.includes("DOCTOR");

  return (
    <AppShell
      title="Hồ Sơ Bệnh Nhân"
      subtitle={`Mã BN: ${history.patient.patient_code}`}
      actions={
        <Link href="/patients">
          <Button size="sm" variant="outline">
            Quay Lại Danh Sách
          </Button>
        </Link>
      }
    >
      <div className="w-full">
        <PatientChartWorkspace
          history={history}
          diagnosesCatalog={catalogs.diagnoses}
          servicesCatalog={catalogs.services}
          isDoctor={isDoctor}
        />
      </div>
    </AppShell>
  );
}
