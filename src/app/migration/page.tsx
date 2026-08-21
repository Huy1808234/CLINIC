import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getImportBatches } from "@/rsc-data/migration/get-batches";
import { MigrationClientView } from "@/components/migration/MigrationClientView";

export default async function MigrationPage() {
  const batches = await getImportBatches();

  return (
    <AppShell
      title="Di Chuyển Dữ Liệu Excel Sang Hệ Thống"
      subtitle="Chuyển đổi sổ theo dõi Excel 4 bác sĩ, kiểm tra chuẩn hóa và nạp dữ liệu"
    >
      <div className="max-w-7xl mx-auto">
        <MigrationClientView initialBatches={batches} />
      </div>
    </AppShell>
  );
}
