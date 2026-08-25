import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

// Simple env parser
const envContent = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf-8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || "";
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Supabase Project URL:", supabaseUrl);

  const tables = [
    "patients",
    "receptions",
    "treatment_courses",
    "appointments",
    "course_service_orders",
    "treatment_sessions",
    "clinical_notes",
    "staff",
    "clinics",
  ];

  console.log("\n--- TABLE ROW COUNTS & MEASURED LATENCY ---");
  for (const table of tables) {
    const start = performance.now();
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    const duration = (performance.now() - start).toFixed(1);
    console.log(`Table ${table.padEnd(25)}: count = ${count ?? "N/A"}, error = ${error?.message ?? "none"} (${duration}ms)`);
  }
}

main().catch(console.error);
