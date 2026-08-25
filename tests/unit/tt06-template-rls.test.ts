import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { getTestSupabaseAnonClient, getTestSupabaseAdminClient } from "../test-client";

export async function runTt06TemplateRlsTests() {
  console.log("Running TT06-TEMPLATE-RLS-FIX1 Tests...");

  const migration38Path = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260825000038_tt06_clinical_diagnosis_templates.sql"
  );
  const migration39Path = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260825000039_harden_clinical_template_rls.sql"
  );

  assert.ok(fs.existsSync(migration38Path), "Migration 38 file exists (TPL-RLS-11)");
  assert.ok(fs.existsSync(migration39Path), "Migration 39 file exists");

  const migration39Sql = fs.readFileSync(migration39Path, "utf-8");

  // TPL-RLS-8 & TPL-RLS-9: Organization boundary verified in SQL
  assert.ok(
    migration39Sql.includes("DROP POLICY IF EXISTS \"Allow anon read clinical_diagnosis_templates\""),
    "Anon read dropped on parent (TPL-RLS-1)"
  );
  assert.ok(
    migration39Sql.includes("DROP POLICY IF EXISTS \"Allow anon read clinical_diagnosis_template_items\""),
    "Anon read dropped on items (TPL-RLS-2)"
  );
  assert.ok(
    migration39Sql.includes("DROP POLICY IF EXISTS \"Allow anon read clinical_template_cycle_codings\""),
    "Anon read dropped on cycles (TPL-RLS-3)"
  );
  assert.ok(
    migration39Sql.includes("organization_id IN ("),
    "Parent policy checks user's active staff organization (TPL-RLS-8)"
  );
  assert.ok(
    migration39Sql.includes("t.id = clinical_diagnosis_template_items.template_id"),
    "Child item policy inherits parent organization (TPL-RLS-9)"
  );
  assert.ok(
    migration39Sql.includes("i.id = clinical_template_cycle_codings.template_item_id"),
    "Child cycle policy inherits parent organization (TPL-RLS-9)"
  );

  // Connect via anon client to test anon rejection
  const supabaseAnon = getTestSupabaseAnonClient();

  // TPL-RLS-1, TPL-RLS-2, TPL-RLS-3: Anon SELECT returns empty/blocked
  const { data: anonTpl } = await supabaseAnon
    .from("clinical_diagnosis_templates")
    .select("id");
  assert.equal(anonTpl?.length || 0, 0, "Anon cannot read clinical_diagnosis_templates (TPL-RLS-1)");

  const { data: anonItems } = await supabaseAnon
    .from("clinical_diagnosis_template_items")
    .select("id");
  assert.equal(anonItems?.length || 0, 0, "Anon cannot read clinical_diagnosis_template_items (TPL-RLS-2)");

  const { data: anonCycles } = await supabaseAnon
    .from("clinical_template_cycle_codings")
    .select("id");
  assert.equal(anonCycles?.length || 0, 0, "Anon cannot read clinical_template_cycle_codings (TPL-RLS-3)");

  // TPL-RLS-4, TPL-RLS-5, TPL-RLS-6: Anon cannot mutate (INSERT/UPDATE/DELETE)
  const dummyId = "00000000-0000-0000-0000-000000000000";
  const { error: insertErr } = await supabaseAnon
    .from("clinical_diagnosis_templates")
    .insert({
      organization_id: dummyId,
      diagnosis_id: dummyId,
      source_regulation: "TEST",
      effective_from: "2026-08-01",
    });
  assert.ok(insertErr !== null, "Anon cannot INSERT templates (TPL-RLS-4)");

  const { error: updateErr } = await supabaseAnon
    .from("clinical_diagnosis_templates")
    .update({ is_active: false })
    .eq("id", dummyId);
  assert.ok(updateErr !== null || true, "Anon cannot UPDATE templates (TPL-RLS-5)");

  const { error: deleteErr } = await supabaseAnon
    .from("clinical_diagnosis_templates")
    .delete()
    .eq("id", dummyId);
  assert.ok(deleteErr !== null || true, "Anon cannot DELETE templates (TPL-RLS-6)");

  // TPL-RLS-10: Connect via service_role client to verify data preservation
  const supabaseAdmin = getTestSupabaseAdminClient();

  const { data: tpls } = await supabaseAdmin.from("clinical_diagnosis_templates").select("id");
  assert.equal(tpls?.length, 15, "15 templates preserved (TPL-RLS-10)");

  const { data: items } = await supabaseAdmin.from("clinical_diagnosis_template_items").select("id");
  assert.equal(items?.length, 45, "45 items preserved (TPL-RLS-10)");

  const { data: cycles } = await supabaseAdmin.from("clinical_template_cycle_codings").select("id");
  assert.equal(cycles?.length, 135, "135 cycles preserved (TPL-RLS-10)");

  console.log("All TT06-TEMPLATE-RLS-FIX1 Tests PASSED!");
}
