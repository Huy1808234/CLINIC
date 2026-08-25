import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { getTestSupabaseAdminClient } from "../test-client";

export async function runDiagnosisDvktTemplateStageBTests() {
  console.log("Running DIAGNOSIS-DVKT-TEMPLATE-STAGEB1 Tests...");

  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260825000038_tt06_clinical_diagnosis_templates.sql"
  );
  assert.equal(fs.existsSync(migrationPath), true, "Migration 38 file exists");
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");

  // Verify constraints in migration SQL
  assert.ok(
    migrationSql.includes("CONSTRAINT uq_clinical_diag_template UNIQUE (organization_id, diagnosis_id, source_regulation, effective_from)"),
    "Template unique constraint present in migration (TT06-TPL-6)"
  );
  assert.ok(
    migrationSql.includes("CONSTRAINT uq_clinical_diag_tpl_item_service UNIQUE (template_id, service_id)"),
    "Template item service uniqueness present (TT06-TPL-7)"
  );
  assert.ok(
    migrationSql.includes("CONSTRAINT uq_clinical_diag_tpl_item_seq UNIQUE (template_id, sequence_no)"),
    "Template item sequence uniqueness present (TT06-TPL-8)"
  );
  assert.ok(
    migrationSql.includes("CONSTRAINT uq_clinical_tpl_cycle UNIQUE (template_item_id, cycle_number)"),
    "Cycle uniqueness constraint present (TT06-TPL-9)"
  );
  assert.ok(
    migrationSql.includes("cycle_number INTEGER NOT NULL CHECK (cycle_number > 0)"),
    "Cycle number allows positive unbounded values (TT06-TPL-10)"
  );
  assert.ok(
    !migrationSql.includes("CHECK (cycle_number IN (1, 2, 3))"),
    "No hardcoded 1/2/3 check on cycle_number column (TT06-TPL-10)"
  );

  // Connect to Supabase to verify live database state
  const supabase = getTestSupabaseAdminClient();

  // Resolve THUAN_THIEN organization
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id, code")
    .eq("code", "THUAN_THIEN")
    .single();
  assert.equal(orgErr, null, "Organization THUAN_THIEN exists");
  assert.ok(org, "Org resolved (TT06-TPL-5)");

  // TT06-TPL-1 & TT06-TPL-5: Query all templates
  const { data: templates, error: tplErr } = await supabase
    .from("clinical_diagnosis_templates")
    .select(`
      id,
      organization_id,
      diagnosis_id,
      source_regulation,
      source_version,
      effective_from,
      effective_to,
      is_active,
      diagnosis_catalog (
        id,
        code,
        name
      )
    `)
    .eq("organization_id", org.id);

  assert.equal(tplErr, null, "Templates query succeeds");
  assert.ok(templates && templates.length === 15, `Found exactly 15 primary templates, got ${templates?.length} (TT06-TPL-1, TT06-TPL-5)`);

  for (const tpl of templates || []) {
    assert.equal(tpl.organization_id, org.id, "Template belongs to THUAN_THIEN (TT06-TPL-5)");
    assert.equal(tpl.source_regulation, "TT_06_2026", "source_regulation is TT_06_2026 (TT06-TPL-17)");
    assert.equal(tpl.effective_from, "2026-08-01", "effective_from is 2026-08-01 (TT06-TPL-16)");
    assert.equal(tpl.effective_to, null, "effective_to is null (no overlap)");
    assert.equal(tpl.is_active, true, "template is active");
    assert.ok(tpl.diagnosis_catalog, "Primary diagnosis resolved from diagnosis_catalog (TT06-TPL-1)");
  }

  // TT06-TPL-3, TT06-TPL-4, TT06-TPL-7, TT06-TPL-8: Query template items
  const { data: items, error: itemsErr } = await supabase
    .from("clinical_diagnosis_template_items")
    .select(`
      id,
      template_id,
      service_id,
      sequence_no,
      indication_notes,
      is_active,
      service_catalog (
        id,
        service_code,
        service_name
      )
    `)
    .order("sequence_no", { ascending: true });

  assert.equal(itemsErr, null, "Template items query succeeds");
  assert.equal(items?.length, 45, `Found exactly 45 items (15 templates * 3 items), got ${items?.length} (TT06-TPL-8)`);

  for (const it of items || []) {
    assert.ok(it.service_catalog, "Service resolved from service_catalog (TT06-TPL-3)");
    assert.ok([1, 2, 3].includes(it.sequence_no), "Item sequence_no is 1, 2, or 3 (TT06-TPL-8)");
  }

  // TT06-TPL-4: Verify service_catalog unchanged
  const { data: services } = await supabase.from("service_catalog").select("id");
  assert.equal(services?.length, 8, "service_catalog still contains exactly 8 rows (TT06-TPL-4)");

  // TT06-TPL-2, TT06-TPL-9, TT06-TPL-11, TT06-TPL-12: Query cycle codings
  const { data: cycles, error: cycleErr } = await supabase
    .from("clinical_template_cycle_codings")
    .select(`
      id,
      template_item_id,
      cycle_number,
      diagnosis_id,
      diagnosis_catalog (
        id,
        code,
        name
      )
    `);

  assert.equal(cycleErr, null, "Cycle codings query succeeds");
  assert.equal(cycles?.length, 135, `Found exactly 135 cycle rows (45 items * 3 cycles), got ${cycles?.length} (TT06-TPL-11)`);

  for (const c of cycles || []) {
    assert.ok(c.diagnosis_catalog, "Cycle diagnosis code resolved from diagnosis_catalog (TT06-TPL-2)");
    assert.ok([1, 2, 3].includes(c.cycle_number), "cycle_number is valid (TT06-TPL-11)");
  }

  // TT06-TPL-20: Test example queries
  const checkExample = async (code: string) => {
    const diag = (await supabase
      .from("diagnosis_catalog")
      .select("id, code, name")
      .eq("code", code)
      .single()).data;

    assert.ok(diag, `Diagnosis ${code} exists in catalog`);

    const { data: tpl } = await supabase
      .from("clinical_diagnosis_templates")
      .select(`
        id,
        diagnosis_id,
        clinical_diagnosis_template_items (
          id,
          sequence_no,
          indication_notes,
          service_catalog (
            service_code,
            service_name
          ),
          clinical_template_cycle_codings (
            cycle_number,
            diagnosis_catalog (
              code,
              name
            )
          )
        )
      `)
      .eq("diagnosis_id", diag.id)
      .eq("organization_id", org.id)
      .eq("is_active", true)
      .single();

    assert.ok(tpl, `Template for ${code} exists`);
    assert.equal(tpl.clinical_diagnosis_template_items.length, 3, `Template for ${code} has 3 items`);
    return tpl;
  };

  const exU62 = await checkExample("U62.151.8");
  assert.ok(exU62);
  const exU59 = await checkExample("U59.401.3");
  assert.ok(exU59);
  const exU57 = await checkExample("U57.011.8");
  assert.ok(exU57);
  const exU62_031 = await checkExample("U62.031.9");
  assert.ok(exU62_031);
  const exU55_561 = await checkExample("U55.561.8");
  assert.ok(exU55_561);

  console.log("All DIAGNOSIS-DVKT-TEMPLATE-STAGEB1 Tests PASSED!");
}
