import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function runHotQueries() {
  console.log("==================================================");
  console.log("EXECUTING PRODUCTION QUERY BENCHMARKS ON REMOTE SUPABASE");
  console.log("==================================================");

  // 1. Patient list query
  const p1 = performance.now();
  const { data: pData, count: pCount, error: pErr } = await supabase
    .from("patients")
    .select("id", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(0, 19);
  const pDur = (performance.now() - p1).toFixed(1);
  console.log(`1. Patient list (.range(0, 19)): ${pDur}ms, count=${pCount}, rows=${pData?.length}, err=${pErr?.message ?? "none"}`);

  // Fetch a sample patientId
  const samplePatientId = pData?.[0]?.id || "00000000-0000-0000-0000-000000000000";

  // 2. Reception today query
  const startUtc = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const endUtc = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const r1 = performance.now();
  const { data: rData, error: rErr } = await supabase
    .from("receptions")
    .select("id, patient_id, clinic_id, insurance_card_id, arrived_at, registered_at, reception_source, patient_relation_type, paper_file_status, his_import_status, reason_for_visit, notes, created_by, created_at")
    .gte("arrived_at", startUtc)
    .lt("arrived_at", endUtc)
    .order("arrived_at", { ascending: false })
    .order("id", { ascending: false });
  const rDur = (performance.now() - r1).toFixed(1);
  console.log(`2. Reception range query: ${rDur}ms, rows=${rData?.length}, err=${rErr?.message ?? "none"}`);

  // 3. Patient courses query
  const c1 = performance.now();
  const { data: cData, error: cErr } = await supabase
    .from("treatment_courses")
    .select("id, patient_id, clinic_id, course_no, start_date, status, adherence_status, primary_doctor_id, planned_by_doctor_id, planned_session_count, completed_session_count, planned_at, planned_end_date, actual_end_date, notes, created_at")
    .eq("patient_id", samplePatientId)
    .order("course_no", { ascending: false });
  const cDur = (performance.now() - c1).toFixed(1);
  console.log(`3. Patient courses query: ${cDur}ms, rows=${cData?.length}, err=${cErr?.message ?? "none"}`);

  // 4. Schedule day query
  const todayStr = new Date().toISOString().slice(0, 10);
  const s1 = performance.now();
  const { data: sData, error: sErr } = await supabase
    .from("appointments")
    .select("id, patient_id, treatment_course_id, doctor_id, appointment_date, scheduled_start_at, scheduled_end_at, status, schedule_source, sequence_in_day, priority, manual_override, notes, created_at, updated_at")
    .eq("appointment_date", todayStr)
    .neq("status", "CANCELLED")
    .order("scheduled_start_at", { ascending: true })
    .order("id", { ascending: true });
  const sDur = (performance.now() - s1).toFixed(1);
  console.log(`4. Schedule day query: ${sDur}ms, rows=${sData?.length}, err=${sErr?.message ?? "none"}`);

  // 5. Patient appointments query
  const a1 = performance.now();
  const { data: aData, error: aErr } = await supabase
    .from("appointments")
    .select("id, patient_id, treatment_course_id, doctor_id, appointment_date, scheduled_start_at, scheduled_end_at, status, schedule_source, notes, created_at")
    .eq("patient_id", samplePatientId)
    .order("appointment_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(20);
  const aDur = (performance.now() - a1).toFixed(1);
  console.log(`5. Patient appointments query: ${aDur}ms, rows=${aData?.length}, err=${aErr?.message ?? "none"}`);

  // Warm vs Cold measurement (3 sequential runs of same query)
  console.log("\n--- COLD VS WARM QUERIES (Patient list 3 sequential requests) ---");
  for (let i = 1; i <= 3; i++) {
    const t0 = performance.now();
    await supabase.from("patients").select("id").range(0, 19);
    console.log(`Request #${i}: ${(performance.now() - t0).toFixed(1)}ms`);
  }
}

runHotQueries().catch(console.error);
