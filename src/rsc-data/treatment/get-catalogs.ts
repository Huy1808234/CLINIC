import "server-only";
import { createClient } from "@/supabase-clients/server";
import type { DiagnosisCatalogItem, ServiceCatalogItem } from "@/types/catalog";

export interface DoctorStaffItem {
  id: string;
  staff_code: string;
  full_name: string;
  role_type: string;
}

export async function getCatalogs(): Promise<{
  diagnoses: DiagnosisCatalogItem[];
  services: ServiceCatalogItem[];
  doctors: DoctorStaffItem[];
}> {
  const supabase = await createClient();

  const [diagRes, servRes, docRes] = await Promise.all([
    supabase
      .from("diagnosis_catalog")
      .select("*")
      .eq("is_active", true)
      .order("code", { ascending: true }),
    supabase
      .from("service_catalog")
      .select("*")
      .eq("is_active", true)
      .order("service_code", { ascending: true }),
    supabase
      .from("staff")
      .select("id, staff_code, full_name, role_type")
      .eq("role_type", "DOCTOR")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
  ]);

  return {
    diagnoses: (diagRes.data as unknown as DiagnosisCatalogItem[]) || [],
    services: (servRes.data as unknown as ServiceCatalogItem[]) || [],
    doctors: (docRes.data as unknown as DoctorStaffItem[]) || [],
  };
}
