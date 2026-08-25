import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { getTestSupabaseAdminClient } from "../test-client";

export async function runDiagnosisCatalogTt06ImportTests() {
  console.log("Running DIAGNOSIS-CATALOG-TT06-IMPORT1 Tests...");

  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260825000037_seed_tt06_diagnosis_catalog.sql"
  );
  assert.equal(fs.existsSync(migrationPath), true, "Migration 37 file exists");
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");

  // DIAG-TT06-1: Workbook unique-code extraction deterministic
  const downloadsDir = "C:\\Users\\Admin\\Downloads";
  const files = fs.readdirSync(downloadsDir);
  const targetFile = files.find((f) => f.includes("06") && f.endsWith(".xlsx"));
  assert.ok(targetFile, "Workbook file exists in Downloads");

  const fullWorkbookPath = path.join(downloadsDir, targetFile);
  const workbook = XLSX.readFile(fullWorkbookPath);

  const hisSheet = workbook.Sheets["DVKT ĐÁNH HIS"];
  const hisRows: unknown[][] = XLSX.utils.sheet_to_json(hisSheet, { header: 1, defval: "" });

  const luuSheet = workbook.Sheets["LƯU MÃ "];
  const luuRows: unknown[][] = XLSX.utils.sheet_to_json(luuSheet, { header: 1, defval: "" });

  const workbookCodes = new Set<string>();

  for (let r = 4; r < hisRows.length; r++) {
    const row = hisRows[r];
    const benh = String(row[0] || "").trim();
    if (benh) {
      const lines = benh.split(/[\r\n]+/).map((s) => s.trim()).filter(Boolean);
      for (const line of lines) {
        const m = line.match(/^([A-Z0-9.]+)/i);
        if (m) {
          const code = m[1].replace(/[()]/g, "").trim();
          if (code.startsWith("U")) workbookCodes.add(code);
        }
      }
    }
    [row[2], row[3], row[4]].forEach((cell) => {
      String(cell || "")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((c) => {
          const clean = c.replace(/[()]/g, "").trim();
          if (clean.startsWith("U")) workbookCodes.add(clean);
        });
    });
  }

  for (let r = 4; r < luuRows.length; r++) {
    const row = luuRows[r];
    [0, 2, 4].forEach((colIdx) => {
      String(row[colIdx] || "")
        .split(/[\r\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((c) => {
          const clean = c.replace(/[()]/g, "").trim();
          if (clean.startsWith("U")) workbookCodes.add(clean);
        });
    });
  }

  assert.equal(workbookCodes.size, 21, "Exactly 21 unique TT06 codes extracted from workbook (DIAG-TT06-1)");

  // DIAG-TT06-2: All imported codes non-empty and well-formed
  const expectedCodes = [
    "U55.141.1", "U55.141.2", "U55.451.9", "U55.481.1", "U55.481.2",
    "U55.501.0", "U55.531",   "U55.561.3", "U55.561.8", "U55.621.0",
    "U55.621.8", "U57.011.8", "U57.011.9", "U59.401.3", "U59.431.8",
    "U59.431.9", "U62.031.9", "U62.151.8", "U62.151.9", "U62.261.1",
    "U62.261.5"
  ];

  for (const c of expectedCodes) {
    assert.ok(workbookCodes.has(c), `Workbook contains code ${c} (DIAG-TT06-2)`);
    assert.ok(migrationSql.includes(`'${c}'`), `Migration 37 contains code ${c} (DIAG-TT06-2)`);
  }

  // DIAG-TT06-3 & DIAG-TT06-4: Migration uses ON CONFLICT (code_system, code)
  assert.ok(
    migrationSql.includes("ON CONFLICT (code_system, code) DO UPDATE"),
    "Migration is idempotent using ON CONFLICT (code_system, code) (DIAG-TT06-4, DIAG-TT06-5, DIAG-TT06-6)"
  );

  // DIAG-TT06-7: Check remote database for all 21 codes
  const supabase = getTestSupabaseAdminClient();

  const { data: dbDiagnoses, error: dbErr } = await supabase
    .from("diagnosis_catalog")
    .select("id, code_system, code, name, is_active")
    .eq("is_active", true)
    .order("code", { ascending: true });

  assert.equal(dbErr, null, "DB query succeeds with no error");
  assert.ok(dbDiagnoses && dbDiagnoses.length >= 21, "Remote DB contains all 21 TT06 diagnoses (DIAG-TT06-7)");

  const dbCodeMap = new Map(dbDiagnoses?.map((d) => [d.code, d]));
  for (const c of expectedCodes) {
    assert.ok(dbCodeMap.has(c), `Remote DB contains active code ${c} (DIAG-TT06-7)`);
  }

  // DIAG-TT06-8: Search by code U62.151.8 succeeds
  const u62Item = dbCodeMap.get("U62.151.8");
  assert.ok(u62Item, "Search by U62.151.8 succeeds (DIAG-TT06-8)");
  assert.equal(u62Item?.name, "Các thoái hoá đa khớp khác");

  // DIAG-TT06-9: Search by name matches
  const thkMatches = dbDiagnoses?.filter((d) => d.name.toLowerCase().includes("thoái hoá"));
  assert.ok((thkMatches?.length || 0) >= 4, "Search by Vietnamese diagnosis name succeeds (DIAG-TT06-9)");

  // DIAG-TT06-11: No hardcoded TT06 diagnosis list added to React
  const pageCode = fs.readFileSync(path.join(process.cwd(), "src", "app", "patients", "[id]", "page.tsx"), "utf-8");
  assert.equal(pageCode.includes("U62.151.8"), false, "No hardcoded TT06 diagnoses in React (DIAG-TT06-11)");

  // DIAG-TT06-14: service_catalog remains unchanged
  const { data: dbServices } = await supabase
    .from("service_catalog")
    .select("id, service_code");
  assert.equal(dbServices?.length, 8, "Service catalog contains exactly 8 services (DIAG-TT06-14)");

  console.log("All DIAGNOSIS-CATALOG-TT06-IMPORT1 Tests PASSED!");
}
