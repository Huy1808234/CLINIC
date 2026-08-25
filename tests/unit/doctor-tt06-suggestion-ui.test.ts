import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { getTestSupabaseAdminClient } from "../test-client";
import { getClinicalTemplateSuggestion } from "@/lib/clinical/template-suggestion-service";

export async function runDoctorTt06SuggestionUiTests() {
  console.log("Running DOCTOR-TT06-DVKT-SUGGESTION-UI1 Tests...");

  // Supabase client (service_role for DB inspection)
  const supabase = getTestSupabaseAdminClient();

  // 1. Resolve THUAN_THIEN organization & primary diagnosis U62.151.8
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("code", "THUAN_THIEN")
    .single();
  assert.ok(org, "Org THUAN_THIEN exists");

  const { data: u62Diag } = await supabase
    .from("diagnosis_catalog")
    .select("id, code, name")
    .eq("code", "U62.151.8")
    .single();
  assert.ok(u62Diag, "U62.151.8 exists in diagnosis_catalog");

  // TT06-UI-1: Resolve suggestions for U62.151.8
  const resU62 = await getClinicalTemplateSuggestion(supabase, {
    diagnosisId: u62Diag.id,
    organizationId: org.id,
    activeClinicId: "any-clinic-id",
    businessDate: "2026-08-25",
  });

  assert.equal(resU62.success, true, "Suggestion query succeeds (TT06-UI-1)");
  assert.equal(resU62.found, true, "Template found (TT06-UI-1)");
  if (resU62.found) {
    assert.equal(resU62.template.items.length, 3, "3 suggested services returned (TT06-UI-1)");
    const codes = resU62.template.items.map((it) => it.service_code);
    assert.ok(codes.includes("BO_THUOC"), "BO_THUOC suggested");
    assert.ok(codes.includes("DIEN_CHAM"), "DIEN_CHAM suggested");
    assert.ok(codes.includes("NGAM_THUOC"), "NGAM_THUOC suggested");

    // TT06-UI-18: Cycle coding summary present
    for (const item of resU62.template.items) {
      assert.equal(item.cycles.length, 3, "3 cycle codings for each service (TT06-UI-18)");
    }
  }

  // TT06-UI-2: Verify no hardcoded U62.151.8 template logic in DoctorClinicalCourseCard.tsx
  const componentCode = fs.readFileSync(
    path.join(process.cwd(), "src", "components", "clinical", "DoctorClinicalCourseCard.tsx"),
    "utf-8"
  );
  assert.equal(componentCode.includes("BO_THUOC"), false, "No hardcoded BO_THUOC in component (TT06-UI-2)");
  assert.equal(componentCode.includes("U62.151.8"), false, "No hardcoded U62.151.8 in component (TT06-UI-2)");

  // TT06-UI-3: Unknown or un-templated diagnosis returns NO_TEMPLATE calmly
  const dummyDiagId = "11111111-1111-1111-1111-111111111111";
  const resNoTpl = await getClinicalTemplateSuggestion(supabase, {
    diagnosisId: dummyDiagId,
    organizationId: org.id,
    activeClinicId: "any-clinic-id",
    businessDate: "2026-08-25",
  });
  assert.equal(resNoTpl.success, true, "No template succeeds calmly (TT06-UI-3)");
  assert.equal(resNoTpl.found, false, "Template not found (TT06-UI-3)");
  if (!resNoTpl.found && resNoTpl.success) {
    assert.equal(resNoTpl.reason, "NO_TEMPLATE", "Reason is NO_TEMPLATE (TT06-UI-3)");
  }

  // TT06-UI-13: Cross-organization lookup returns NO_TEMPLATE
  const dummyOrgId = "22222222-2222-2222-2222-222222222222";
  const resCrossOrg = await getClinicalTemplateSuggestion(supabase, {
    diagnosisId: u62Diag.id,
    organizationId: dummyOrgId,
    activeClinicId: "any-clinic-id",
    businessDate: "2026-08-25",
  });
  assert.equal(resCrossOrg.found, false, "Cross-org returns no template (TT06-UI-13)");

  // TT06-UI-16: Date before effective_from returns NO_TEMPLATE
  const resPastDate = await getClinicalTemplateSuggestion(supabase, {
    diagnosisId: u62Diag.id,
    organizationId: org.id,
    activeClinicId: "any-clinic-id",
    businessDate: "2025-01-01",
  });
  assert.equal(resPastDate.found, false, "Past date before 2026-08-01 returns no template (TT06-UI-16)");

  // TT06-UI-11 & TT06-UI-12: Action authorization checks DOCTOR role
  const clinicalActionCode = fs.readFileSync(
    path.join(process.cwd(), "src", "app", "actions", "clinical-actions.ts"),
    "utf-8"
  );
  assert.ok(
    clinicalActionCode.includes("requiredRoles: [\"DOCTOR\"]"),
    "orderCourseServicesAction strictly requires DOCTOR role (TT06-UI-11, TT06-UI-12)"
  );

  // TT06-UI-19: Cycle coding does NOT touch session planning
  const tplServiceCode = fs.readFileSync(
    path.join(process.cwd(), "src", "lib", "clinical", "template-suggestion-service.ts"),
    "utf-8"
  );
  assert.equal(
    tplServiceCode.includes("treatment_session_plans"),
    false,
    "No treatment session plan mutation from template service (TT06-UI-19)"
  );

  console.log("All DOCTOR-TT06-DVKT-SUGGESTION-UI1 Tests PASSED!");
}
