import "server-only";
import { cache } from "react";
import { createClient } from "@/supabase-clients/server";
import { getActiveClinicContext } from "@/lib/auth/clinic-context";
import type { DiagnosisCatalogItem, ServiceCatalogItem } from "@/types/catalog";

export interface DoctorStaffItem {
  id: string;
  staff_code: string;
  full_name: string;
  role_type: string;
}

/**
 * Loads diagnosis catalog, service catalog, and clinic doctors.
 * Wrapped with React `cache()` for request-scoped deduplication across
 * Server Component render trees in a single HTTP request.
 */
export const getCatalogs = cache(async (clinicId?: string): Promise<{
  diagnoses: DiagnosisCatalogItem[];
  services: ServiceCatalogItem[];
  doctors: DoctorStaffItem[];
}> => {
  const supabase = await createClient();

  let targetClinicId = clinicId;
  if (!targetClinicId) {
    try {
      const activeClinic = await getActiveClinicContext();
      targetClinicId = activeClinic?.id;
    } catch {
      // fallback if not in active clinic context
    }
  }

  const [diagRes, servRes] = await Promise.all([
    supabase
      .from("diagnosis_catalog")
      .select("id, code_system, code, name, traditional_code, traditional_name, description, is_active, metadata")
      .eq("is_active", true)
      .order("code", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("service_catalog")
      .select("id, service_code, service_name, service_group, default_duration_minutes, setup_minutes, cleanup_minutes, required_resource_type, is_active")
      .eq("is_active", true)
      .order("service_code", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  let doctors: DoctorStaffItem[] = [];

  if (targetClinicId) {
    const { data: clinicDocs, error: docErr } = await supabase
      .from("staff")
      .select(`
        id,
        staff_code,
        full_name,
        role_type,
        staff_clinic_memberships!inner (
          id,
          clinic_id,
          is_active,
          staff_clinic_roles!inner (
            role_code
          )
        )
      `)
      .eq("is_active", true)
      .eq("staff_clinic_memberships.clinic_id", targetClinicId)
      .eq("staff_clinic_memberships.is_active", true)
      .eq("staff_clinic_memberships.staff_clinic_roles.role_code", "DOCTOR")
      .order("full_name", { ascending: true });

    if (!docErr && clinicDocs) {
      doctors = clinicDocs.map((d) => ({
        id: d.id,
        staff_code: d.staff_code,
        full_name: d.full_name,
        role_type: d.role_type,
      }));
    }
  }

  // Fallback to active staff with role_type = 'DOCTOR' if zero clinic-scoped doctors found or no clinicId
  if (doctors.length === 0) {
    const { data: fallbackDocs } = await supabase
      .from("staff")
      .select("id, staff_code, full_name, role_type")
      .eq("role_type", "DOCTOR")
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    doctors = (fallbackDocs as unknown as DoctorStaffItem[]) || [];
  }

  return {
    diagnoses: (diagRes.data as unknown as DiagnosisCatalogItem[]) || [],
    services: (servRes.data as unknown as ServiceCatalogItem[]) || [],
    doctors,
  };
});
