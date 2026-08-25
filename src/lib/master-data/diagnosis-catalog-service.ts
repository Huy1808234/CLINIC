import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { DiagnosisCatalogItem } from "@/types/catalog";
import type { DiagnosisCatalogSearchQuery } from "@/lib/validation/diagnosis-catalog-schemas";

function getAdminClient(overrideClient?: SupabaseClient<Database>): SupabaseClient<Database> {
  if (overrideClient) return overrideClient;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-url.supabase.co";
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-secret-key";
  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface DiagnosisCatalogQueryFilter {
  search?: string;
  code_system?: string;
  is_active?: boolean;
}

export interface DiagnosisCatalogPageResult {
  items: DiagnosisCatalogItem[];
  total: number;
  activeCount: number;
  codeSystems: string[];
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateDiagnosisCatalogInput {
  code_system: string;
  code: string;
  name: string;
  traditional_code?: string | null;
  traditional_name?: string | null;
  is_active?: boolean;
}

export interface UpdateDiagnosisCatalogInput {
  name?: string;
  traditional_code?: string | null;
  traditional_name?: string | null;
  is_active?: boolean;
}

export interface DiagnosisImportRowItem {
  code_system?: string;
  code?: string;
  name?: string;
  traditional_code?: string | null;
  traditional_name?: string | null;
  [key: string]: unknown;
}

export type DiagnosisImportStatus = "NEW" | "EXISTING" | "CONFLICT" | "ERROR";

export interface DiagnosisImportValidationResultItem {
  row_index: number;
  code_system: string;
  code: string;
  name: string;
  status: DiagnosisImportStatus;
  status_label: string;
  error_message?: string;
  existing_name?: string;
}

export interface DiagnosisImportPreviewResult {
  total_rows: number;
  new_count: number;
  existing_count: number;
  conflict_count: number;
  error_count: number;
  items: DiagnosisImportValidationResultItem[];
}

export interface DiagnosisImportCommitResult {
  success: boolean;
  inserted_count: number;
  skipped_count: number;
  error_count: number;
  message: string;
}

/**
 * Server-side paginated, filtered, and sorted query for diagnosis catalog.
 * Executes all filtering, ordering, and slicing inside PostgreSQL.
 */
export async function getDiagnosisCatalogPage(
  query: DiagnosisCatalogSearchQuery,
  supabaseOverride?: SupabaseClient<Database>
): Promise<DiagnosisCatalogPageResult> {
  const supabase = getAdminClient(supabaseOverride);

  const page = Math.max(1, query.page || 1);
  const pageSize = [10, 20, 50].includes(query.pageSize || 20) ? (query.pageSize || 20) : 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Selected minimal columns
  let dbQuery = supabase
    .from("diagnosis_catalog")
    .select("id, code_system, code, name, traditional_code, traditional_name, is_active", {
      count: "exact",
    });

  // Filter: code_system
  if (query.codeSystem && query.codeSystem !== "ALL") {
    dbQuery = dbQuery.eq("code_system", query.codeSystem);
  }

  // Filter: status
  if (query.status === "ACTIVE") {
    dbQuery = dbQuery.eq("is_active", true);
  } else if (query.status === "INACTIVE") {
    dbQuery = dbQuery.eq("is_active", false);
  }

  // Filter: search (safe sanitized partial match in code, name, traditional_code, traditional_name)
  if (query.search && query.search.trim()) {
    const rawQ = query.search.trim().replace(/[%,_]/g, "\\$&");
    dbQuery = dbQuery.or(
      `code.ilike.%${rawQ}%,name.ilike.%${rawQ}%,traditional_code.ilike.%${rawQ}%,traditional_name.ilike.%${rawQ}%`
    );
  }

  // Sorting
  const sortBy = query.sortBy || "code";
  const ascending = query.sortDirection === "asc";
  dbQuery = dbQuery.order(sortBy, { ascending });

  // Pagination range
  dbQuery = dbQuery.range(from, to);

  // Parallel query for activeCount total
  const [listRes, activeRes, codeSystemRes] = await Promise.all([
    dbQuery,
    supabase
      .from("diagnosis_catalog")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("diagnosis_catalog")
      .select("code_system")
      .order("code_system", { ascending: true }),
  ]);

  if (listRes.error) {
    throw new Error(`Failed to load diagnosis catalog page: ${listRes.error.message}`);
  }

  const items = (listRes.data as unknown as DiagnosisCatalogItem[]) || [];
  const total = listRes.count ?? 0;
  const activeCount = activeRes.count ?? 0;
  const codeSystems = Array.from(
    new Set(
      ((codeSystemRes.data as Array<{ code_system: string }> | null) || [])
        .map((item) => item.code_system)
        .filter((codeSystem) => codeSystem.trim().length > 0)
    )
  );
  const totalPages = Math.ceil(total / pageSize) || 1;

  return {
    items,
    total,
    activeCount,
    codeSystems,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Fetch all diagnosis catalog entries with optional filters (for dropdowns/doctor drawers).
 */
export async function getDiagnosisCatalogList(
  filter?: DiagnosisCatalogQueryFilter,
  supabaseOverride?: SupabaseClient<Database>
): Promise<DiagnosisCatalogItem[]> {
  const supabase = getAdminClient(supabaseOverride);

  let query = supabase
    .from("diagnosis_catalog")
    .select("id, code_system, code, name, traditional_code, traditional_name, is_active")
    .order("code", { ascending: true });

  if (filter?.code_system) {
    query = query.eq("code_system", filter.code_system);
  }

  if (filter?.is_active !== undefined) {
    query = query.eq("is_active", filter.is_active);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load diagnosis catalog: ${error.message}`);
  }

  let items = (data as unknown as DiagnosisCatalogItem[]) || [];

  if (filter?.search) {
    const q = filter.search.toLowerCase().trim();
    items = items.filter(
      (item) =>
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        (item.traditional_code && item.traditional_code.toLowerCase().includes(q)) ||
        (item.traditional_name && item.traditional_name.toLowerCase().includes(q))
    );
  }

  return items;
}

/**
 * Create a new diagnosis catalog entry.
 */
export async function createDiagnosisCatalogEntry(
  input: CreateDiagnosisCatalogInput,
  supabaseOverride?: SupabaseClient<Database>
): Promise<DiagnosisCatalogItem> {
  const code_system = input.code_system.trim().toUpperCase();
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();

  if (!code_system) {
    throw new Error("Hệ thống mã là bắt buộc.");
  }
  if (!code) {
    throw new Error("Mã bệnh là bắt buộc.");
  }
  if (!name) {
    throw new Error("Tên bệnh là bắt buộc.");
  }

  const supabase = getAdminClient(supabaseOverride);

  // Check uniqueness of (code_system, code)
  const { data: existing } = await supabase
    .from("diagnosis_catalog")
    .select("id, code, name")
    .eq("code_system", code_system)
    .eq("code", code)
    .maybeSingle();

  if (existing) {
    throw new Error(`Mã bệnh '${code}' (${code_system}) đã tồn tại trong hệ thống.`);
  }

  const { data, error } = await supabase
    .from("diagnosis_catalog")
    .insert({
      code_system,
      code,
      name,
      traditional_code: input.traditional_code?.trim() || null,
      traditional_name: input.traditional_name?.trim() || null,
      is_active: input.is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Lỗi khi tạo mã bệnh: ${error.message}`);
  }

  return data as unknown as DiagnosisCatalogItem;
}

/**
 * Update an existing diagnosis catalog entry.
 */
export async function updateDiagnosisCatalogEntry(
  id: string,
  input: UpdateDiagnosisCatalogInput,
  supabaseOverride?: SupabaseClient<Database>
): Promise<DiagnosisCatalogItem> {
  const supabase = getAdminClient(supabaseOverride);

  const { data: existing, error: findError } = await supabase
    .from("diagnosis_catalog")
    .select("id, code_system, code, name, is_active")
    .eq("id", id)
    .maybeSingle();

  if (findError || !existing) {
    throw new Error("Không tìm thấy mã bệnh trong danh mục.");
  }

  const updates: Database["public"]["Tables"]["diagnosis_catalog"]["Update"] = {};

  if (input.name !== undefined) {
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error("Tên bệnh không được để trống.");
    }
    updates.name = trimmedName;
  }

  if (input.traditional_code !== undefined) {
    updates.traditional_code = input.traditional_code?.trim() || null;
  }

  if (input.traditional_name !== undefined) {
    updates.traditional_name = input.traditional_name?.trim() || null;
  }

  if (input.is_active !== undefined) {
    updates.is_active = input.is_active;
  }

  const { data, error } = await supabase
    .from("diagnosis_catalog")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Lỗi khi cập nhật mã bệnh: ${error.message}`);
  }

  return data as unknown as DiagnosisCatalogItem;
}

/**
 * Set active status (deactivate / reactivate) of a diagnosis.
 * Preserves the row and UUID completely.
 */
export async function setDiagnosisCatalogActiveStatus(
  id: string,
  isActive: boolean,
  supabaseOverride?: SupabaseClient<Database>
): Promise<DiagnosisCatalogItem> {
  return updateDiagnosisCatalogEntry(id, { is_active: isActive }, supabaseOverride);
}

/**
 * Hard-delete a diagnosis catalog entry ONLY if it is completely unreferenced.
 * Checks server-side references in course_diagnoses, clinical_diagnosis_templates,
 * and clinical_template_cycle_codings before deletion.
 */
export async function deleteDiagnosisCatalogEntry(
  id: string,
  supabaseOverride?: SupabaseClient<Database>
): Promise<{ success: boolean; id: string }> {
  const supabase = getAdminClient(supabaseOverride);

  // 1. Verify existence
  const { data: existing, error: findError } = await supabase
    .from("diagnosis_catalog")
    .select("id, code, name")
    .eq("id", id)
    .maybeSingle();

  if (findError || !existing) {
    throw new Error("Không tìm thấy mã bệnh trong danh mục.");
  }

  // 2. Check clinical references in parallel
  const [courseDiagRes, templateRes, cycleCodingRes] = await Promise.all([
    supabase
      .from("course_diagnoses")
      .select("id", { count: "exact", head: true })
      .eq("diagnosis_id", id),
    supabase
      .from("clinical_diagnosis_templates")
      .select("id", { count: "exact", head: true })
      .eq("diagnosis_id", id),
    supabase
      .from("clinical_template_cycle_codings")
      .select("id", { count: "exact", head: true })
      .eq("diagnosis_id", id),
  ]);

  const courseDiagCount = courseDiagRes.count ?? 0;
  const templateCount = templateRes.count ?? 0;
  const cycleCodingCount = cycleCodingRes.count ?? 0;

  if (courseDiagCount > 0 || templateCount > 0 || cycleCodingCount > 0) {
    throw new Error(
      "DIAGNOSIS_IN_USE: Không thể xóa mã bệnh vì mã này đã được sử dụng trong hồ sơ điều trị hoặc phác đồ mẫu. Bạn có thể chọn 'Ngừng sử dụng' để ẩn mã khỏi các chỉ định mới."
    );
  }

  // 3. Delete unreferenced row
  const { error: deleteError } = await supabase
    .from("diagnosis_catalog")
    .delete()
    .eq("id", id);

  if (deleteError) {
    throw new Error(`Lỗi khi xóa mã bệnh: ${deleteError.message}`);
  }

  return { success: true, id };
}

/**
 * Validate and preview diagnosis records before Excel import.
 */
export async function previewExcelDiagnosisImport(
  rawRows: DiagnosisImportRowItem[],
  supabaseOverride?: SupabaseClient<Database>
): Promise<DiagnosisImportPreviewResult> {
  const supabase = getAdminClient(supabaseOverride);

  // Load all current catalog entries for quick comparison
  const { data: allCatalog } = await supabase
    .from("diagnosis_catalog")
    .select("code_system, code, name");

  const existingMap = new Map<string, string>();
  ((allCatalog as Array<{ code_system: string; code: string; name: string }>) || []).forEach(
    (item) => {
      const key = `${item.code_system.toUpperCase()}::${item.code.toUpperCase()}`;
      existingMap.set(key, item.name);
    }
  );

  const seenInFile = new Set<string>();
  const items: DiagnosisImportValidationResultItem[] = [];

  let newCount = 0;
  let existingCount = 0;
  let conflictCount = 0;
  let errorCount = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i];
    // Map multiple potential header names
    const rawCodeSystem =
      (r["code_system"] || r["Hệ thống mã"] || r["Code System"] || "ICD10_YHCT") as string;
    const rawCode =
      (r["code"] || r["Mã bệnh"] || r["Mã YHCT"] || r["Mã ICD"] || r["Code"] || "") as string;
    const rawName =
      (r["name"] || r["Tên bệnh"] || r["Tên chẩn đoán"] || r["Name"] || "") as string;

    const code_system = String(rawCodeSystem || "ICD10_YHCT").trim().toUpperCase();
    const code = String(rawCode || "").trim().toUpperCase();
    const name = String(rawName || "").trim();

    const rowIndex = i + 1;

    if (!code) {
      errorCount++;
      items.push({
        row_index: rowIndex,
        code_system,
        code: "—",
        name: name || "—",
        status: "ERROR",
        status_label: "Lỗi",
        error_message: "Thiếu mã bệnh.",
      });
      continue;
    }

    if (!name) {
      errorCount++;
      items.push({
        row_index: rowIndex,
        code_system,
        code,
        name: "—",
        status: "ERROR",
        status_label: "Lỗi",
        error_message: "Thiếu tên bệnh.",
      });
      continue;
    }

    const fileKey = `${code_system}::${code}`;

    if (seenInFile.has(fileKey)) {
      errorCount++;
      items.push({
        row_index: rowIndex,
        code_system,
        code,
        name,
        status: "ERROR",
        status_label: "Lỗi",
        error_message: "Trùng lặp mã trong cùng file Excel.",
      });
      continue;
    }
    seenInFile.add(fileKey);

    const existingName = existingMap.get(fileKey);

    if (existingName !== undefined) {
      if (existingName.trim().toLowerCase() === name.toLowerCase()) {
        existingCount++;
        items.push({
          row_index: rowIndex,
          code_system,
          code,
          name,
          status: "EXISTING",
          status_label: "Đã tồn tại",
          existing_name: existingName,
        });
      } else {
        conflictCount++;
        items.push({
          row_index: rowIndex,
          code_system,
          code,
          name,
          status: "CONFLICT",
          status_label: "Xung đột",
          existing_name: existingName,
          error_message: `Mã đã có tên khác trong CSDL: '${existingName}'`,
        });
      }
    } else {
      newCount++;
      items.push({
        row_index: rowIndex,
        code_system,
        code,
        name,
        status: "NEW",
        status_label: "Mới",
      });
    }
  }

  return {
    total_rows: rawRows.length,
    new_count: newCount,
    existing_count: existingCount,
    conflict_count: conflictCount,
    error_count: errorCount,
    items,
  };
}

/**
 * Perform batch commit of valid new diagnosis catalog records.
 * Conflicts and duplicates are skipped safely without silent overwrites.
 */
export async function importDiagnosisCatalogBatch(
  rows: CreateDiagnosisCatalogInput[],
  supabaseOverride?: SupabaseClient<Database>
): Promise<DiagnosisImportCommitResult> {
  if (!rows || rows.length === 0) {
    return {
      success: true,
      inserted_count: 0,
      skipped_count: 0,
      error_count: 0,
      message: "Không có dữ liệu hợp lệ để nhập.",
    };
  }

  const supabase = getAdminClient(supabaseOverride);

  // Load existing records to filter out duplicates
  const { data: allCatalog } = await supabase
    .from("diagnosis_catalog")
    .select("code_system, code");

  const existingSet = new Set<string>();
  ((allCatalog as Array<{ code_system: string; code: string }>) || []).forEach((item) => {
    existingSet.add(`${item.code_system.toUpperCase()}::${item.code.toUpperCase()}`);
  });

  const toInsert: Array<{
    code_system: string;
    code: string;
    name: string;
    traditional_code: string | null;
    traditional_name: string | null;
    is_active: boolean;
  }> = [];

  let skippedCount = 0;
  const seenBatch = new Set<string>();

  for (const r of rows) {
    const code_system = r.code_system.trim().toUpperCase();
    const code = r.code.trim().toUpperCase();
    const name = r.name.trim();

    if (!code || !name) {
      skippedCount++;
      continue;
    }

    const key = `${code_system}::${code}`;
    if (existingSet.has(key) || seenBatch.has(key)) {
      skippedCount++;
      continue;
    }

    seenBatch.add(key);
    toInsert.push({
      code_system,
      code,
      name,
      traditional_code: r.traditional_code?.trim() || null,
      traditional_name: r.traditional_name?.trim() || null,
      is_active: r.is_active ?? true,
    });
  }

  if (toInsert.length === 0) {
    return {
      success: true,
      inserted_count: 0,
      skipped_count: skippedCount,
      error_count: 0,
      message: `Tất cả ${skippedCount} bản ghi đã tồn tại hoặc không hợp lệ. Không có mã mới được thêm.`,
    };
  }

  const { error } = await supabase.from("diagnosis_catalog").insert(toInsert);

  if (error) {
    throw new Error(`Lỗi khi nhập dữ liệu: ${error.message}`);
  }

  return {
    success: true,
    inserted_count: toInsert.length,
    skipped_count: skippedCount,
    error_count: 0,
    message: `Đã nhập thành công ${toInsert.length} mã bệnh mới (${skippedCount} bản ghi trùng lặp được bỏ qua).`,
  };
}
