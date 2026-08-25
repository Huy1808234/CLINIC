"use server";

import { revalidatePath } from "next/cache";
import { requireApplicationAccessContext } from "@/lib/auth/application-access";
import { requireActionAuthorization } from "@/lib/auth/action-authorization";
import {
  getDiagnosisCatalogList,
  createDiagnosisCatalogEntry,
  updateDiagnosisCatalogEntry,
  setDiagnosisCatalogActiveStatus,
  deleteDiagnosisCatalogEntry,
  previewExcelDiagnosisImport,
  importDiagnosisCatalogBatch,
  type DiagnosisCatalogQueryFilter,
  type CreateDiagnosisCatalogInput,
  type UpdateDiagnosisCatalogInput,
  type DiagnosisImportRowItem,
  type DiagnosisImportPreviewResult,
  type DiagnosisImportCommitResult,
} from "@/lib/master-data/diagnosis-catalog-service";
import type { DiagnosisCatalogItem } from "@/types/catalog";

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Fetch diagnosis catalog entries with optional filters.
 */
export async function getDiagnosisCatalogListAction(
  filter?: DiagnosisCatalogQueryFilter
): Promise<ActionResponse<DiagnosisCatalogItem[]>> {
  try {
    await requireApplicationAccessContext();
    const items = await getDiagnosisCatalogList(filter);
    return { success: true, data: items };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi không xác định khi tải danh mục mã bệnh.",
    };
  }
}

/**
 * Create a new diagnosis catalog record (Admin / Manager only).
 */
export async function createDiagnosisCatalogEntryAction(
  input: CreateDiagnosisCatalogInput
): Promise<ActionResponse<DiagnosisCatalogItem>> {
  try {
    await requireActionAuthorization({ requiredRoles: ["ADMIN", "MANAGER"] });
    const item = await createDiagnosisCatalogEntry(input);
    revalidatePath("/master-data/diagnoses");
    return { success: true, data: item };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi khi tạo mã bệnh.",
    };
  }
}

/**
 * Update an existing diagnosis catalog record (Admin / Manager only).
 */
export async function updateDiagnosisCatalogEntryAction(
  id: string,
  input: UpdateDiagnosisCatalogInput
): Promise<ActionResponse<DiagnosisCatalogItem>> {
  try {
    await requireActionAuthorization({ requiredRoles: ["ADMIN", "MANAGER"] });
    const item = await updateDiagnosisCatalogEntry(id, input);
    revalidatePath("/master-data/diagnoses");
    return { success: true, data: item };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi khi cập nhật mã bệnh.",
    };
  }
}

/**
 * Toggle active status of a diagnosis catalog record (Admin / Manager only).
 */
export async function setDiagnosisCatalogActiveAction(
  id: string,
  isActive: boolean
): Promise<ActionResponse<DiagnosisCatalogItem>> {
  try {
    await requireActionAuthorization({ requiredRoles: ["ADMIN", "MANAGER"] });
    const item = await setDiagnosisCatalogActiveStatus(id, isActive);
    revalidatePath("/master-data/diagnoses");
    return { success: true, data: item };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi khi thay đổi trạng thái mã bệnh.",
    };
  }
}

/**
 * Preview Excel rows for diagnosis import.
 */
export async function previewExcelDiagnosisImportAction(
  rows: DiagnosisImportRowItem[]
): Promise<ActionResponse<DiagnosisImportPreviewResult>> {
  try {
    await requireActionAuthorization({ requiredRoles: ["ADMIN", "MANAGER"] });
    const preview = await previewExcelDiagnosisImport(rows);
    return { success: true, data: preview };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi khi kiểm tra file Excel.",
    };
  }
}

/**
 * Confirm and batch-import diagnosis catalog rows.
 */
export async function importDiagnosisCatalogAction(
  rows: CreateDiagnosisCatalogInput[]
): Promise<ActionResponse<DiagnosisImportCommitResult>> {
  try {
    await requireActionAuthorization({ requiredRoles: ["ADMIN", "MANAGER"] });
    const result = await importDiagnosisCatalogBatch(rows);
    revalidatePath("/master-data/diagnoses");
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi khi nhập dữ liệu mã bệnh.",
    };
  }
}

/**
 * Hard-delete a diagnosis catalog entry if completely unreferenced (Admin / Manager only).
 */
export async function deleteDiagnosisCatalogEntryAction(
  id: string
): Promise<ActionResponse<{ success: boolean; id: string }>> {
  try {
    await requireActionAuthorization({ requiredRoles: ["ADMIN", "MANAGER"] });
    const result = await deleteDiagnosisCatalogEntry(id);
    revalidatePath("/master-data/diagnoses");
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Lỗi khi xóa mã bệnh.",
    };
  }
}

