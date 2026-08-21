import "server-only";
import { createClient } from "@/supabase-clients/server";
import type { ImportBatch, LegacySourceRow } from "@/types/migration";

export interface BatchDetailView {
  batch: ImportBatch;
  rows: LegacySourceRow[];
  stats: {
    total: number;
    valid: number;
    errors: number;
    committed: number;
  };
}

export async function getBatchDetails(batchId: string): Promise<BatchDetailView | null> {
  const supabase = await createClient();

  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .select("*")
    .eq("id", batchId)
    .maybeSingle();

  if (batchError || !batch) {
    return null;
  }

  const { data: rows, error: rowsError } = await supabase
    .from("legacy_source_rows")
    .select("*")
    .eq("import_batch_id", batchId)
    .order("excel_row_no", { ascending: true });

  if (rowsError) {
    return null;
  }

  const typedRows = (rows as unknown as LegacySourceRow[]) || [];
  const total = typedRows.length;
  const valid = typedRows.filter((r) => r.result_status === "VALID").length;
  const errors = typedRows.filter((r) => r.result_status === "ERROR").length;
  const committed = typedRows.filter((r) => r.result_status === "COMMITTED").length;

  return {
    batch: batch as unknown as ImportBatch,
    rows: typedRows,
    stats: {
      total,
      valid,
      errors,
      committed,
    },
  };
}
