import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireApplicationPageAccessContext } from "@/lib/auth/application-access";
import { getCurrentStaffRolesForClinic } from "@/lib/auth/role-resolver";
import { getDiagnosisCatalogPage } from "@/lib/master-data/diagnosis-catalog-service";
import { diagnosisCatalogSearchQuerySchema } from "@/lib/validation/diagnosis-catalog-schemas";
import { DiagnosisCatalogClientView } from "@/components/master-data/DiagnosisCatalogClientView";

export const dynamic = "force-dynamic";

interface DiagnosisMasterDataPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DiagnosisMasterDataPage({
  searchParams,
}: DiagnosisMasterDataPageProps) {
  const [accessContext, rawParams] = await Promise.all([
    requireApplicationPageAccessContext(),
    searchParams,
  ]);

  // Safe normalized query parsing
  const parsed = diagnosisCatalogSearchQuerySchema.safeParse({
    search: typeof rawParams.search === "string" ? rawParams.search : undefined,
    codeSystem: typeof rawParams.codeSystem === "string" ? rawParams.codeSystem : undefined,
    status: typeof rawParams.status === "string" ? rawParams.status : undefined,
    page: typeof rawParams.page === "string" ? rawParams.page : undefined,
    pageSize: typeof rawParams.pageSize === "string" ? rawParams.pageSize : undefined,
    sortBy: typeof rawParams.sortBy === "string" ? rawParams.sortBy : undefined,
    sortDirection: typeof rawParams.sortDirection === "string" ? rawParams.sortDirection : undefined,
  });

  const query = parsed.success
    ? parsed.data
    : {
        search: "",
        codeSystem: "ALL",
        status: "ALL" as const,
        page: 1,
        pageSize: 20 as const,
        sortBy: "code" as const,
        sortDirection: "asc" as const,
      };

  const [roles, pageResult] = await Promise.all([
    getCurrentStaffRolesForClinic(accessContext.clinic.clinic_id),
    getDiagnosisCatalogPage(query),
  ]);

  return (
    <AppShell
      title="Danh Mục Lâm Sàng"
      subtitle="Danh mục mã bệnh và chuẩn đoán YHCT / ICD-10"
    >
      <div className="w-full">
        <DiagnosisCatalogClientView
          pageResult={pageResult}
          userRoles={roles}
        />
      </div>
    </AppShell>
  );
}
