import "server-only";
import { createClient } from "@/supabase-clients/server";
import type { ImportBatch } from "@/types/migration";

export interface ImportBatchSummary extends ImportBatch {
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  committed_rows: number;
}

export async function getImportBatches(): Promise<ImportBatchSummary[]> {
  const supabase = await createClient();

  const { data: batches, error } = await supabase
    .from("import_batches")
    .select("*, legacy_source_rows(result_status)")
    .order("started_at", { ascending: false });

  if (error || !batches) {
    return [];
  }

  return (batches as unknown as Array<Record<string, unknown>>).map((b) => {
    const rows = (b.legacy_source_rows as Array<{ result_status: string }>) || [];
    const total = rows.length;
    const valid = rows.filter((r) => r.result_status === "VALID").length;
    const errors = rows.filter((r) => r.result_status === "ERROR").length;
    const committed = rows.filter((r) => r.result_status === "COMMITTED").length;

    return {
      id: b.id as string,
      file_name: b.file_name as string,
      sheet_name: b.sheet_name as string | null,
      started_at: b.started_at as string,
      completed_at: b.completed_at as string | null,
      status: b.status as ImportBatch["status"],
      imported_by: b.imported_by as string | null,
      total_rows: total,
      valid_rows: valid,
      error_rows: errors,
      committed_rows: committed,
    };
  });
}
