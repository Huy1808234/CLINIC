import type { ResourceType } from "./database";

export interface DiagnosisCatalogItem {
  id: string;
  code_system: string;
  code: string;
  name: string;
  traditional_code: string | null;
  traditional_name: string | null;
  is_active: boolean;
}

export interface ServiceCatalogItem {
  id: string;
  service_code: string;
  service_name: string;
  service_group: string | null;
  default_duration_minutes: number;
  setup_minutes: number;
  cleanup_minutes: number;
  required_resource_type: ResourceType | null;
  is_active: boolean;
}
