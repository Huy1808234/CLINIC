"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/supabase-clients/server";
import { executeMigrationImport } from "@/lib/migration/migration-importer";

export async function processMigrationAction(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    const isDryRunStr = formData.get("isDryRun") as string;
    const isDryRun = isDryRunStr === "true";
    const monthStr = (formData.get("monthStr") as string) || new Date().toISOString().slice(0, 7);

    if (!file) {
      return { success: false, error: "Vui lòng chọn tệp Excel" };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const supabase = await createClient();
    const result = await executeMigrationImport(supabase, {
      fileName: file.name,
      buffer,
      monthStr,
      isDryRun,
    });

    revalidatePath("/migration");
    revalidatePath("/patients");
    revalidatePath("/schedule");

    return { success: true, data: result };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message || "Lỗi xử lý tệp Excel" };
  }
}
