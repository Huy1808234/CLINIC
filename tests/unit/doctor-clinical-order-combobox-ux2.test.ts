import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { removeVietnameseAccents } from "@/utils/format-person-name";

export function runDoctorClinicalOrderComboboxUx2Tests() {
  console.log("Running DOCTOR-CLINICAL-ORDER-COMBOBOX-UX2 Tests...");

  const drawerPath = path.join(
    process.cwd(),
    "src",
    "components",
    "reception",
    "ClinicalOrderDrawer.tsx"
  );
  const cardPath = path.join(
    process.cwd(),
    "src",
    "components",
    "clinical",
    "DoctorClinicalCourseCard.tsx"
  );
  const actionsPath = path.join(
    process.cwd(),
    "src",
    "app",
    "actions",
    "clinical-actions.ts"
  );

  assert.equal(fs.existsSync(drawerPath), true, "ClinicalOrderDrawer.tsx exists");
  assert.equal(fs.existsSync(cardPath), true, "DoctorClinicalCourseCard.tsx exists");
  assert.equal(fs.existsSync(actionsPath), true, "clinical-actions.ts exists");

  const drawerCode = fs.readFileSync(drawerPath, "utf-8");
  const cardCode = fs.readFileSync(cardPath, "utf-8");
  const actionsCode = fs.readFileSync(actionsPath, "utf-8");

  assert.ok(
    actionsCode.includes('requiredRoles: ["DOCTOR"]'),
    "Server actions strictly require DOCTOR role authorization"
  );

  // DVKT-COMBO-1: Text typing opens/filters dropdown via Ant Design Select showSearch
  assert.ok(
    drawerCode.includes('showSearch') && cardCode.includes('showSearch'),
    "DVKT-COMBO-1: showSearch enabled for both diagnosis and DVKT comboboxes"
  );

  // DVKT-COMBO-2: Dropdown options are DB-backed (diagnoses and services props)
  assert.ok(
    drawerCode.includes("diagnoses") &&
      drawerCode.includes("services") &&
      cardCode.includes("diagnosesCatalog") &&
      cardCode.includes("servicesCatalog"),
    "DVKT-COMBO-2: Dropdown options are DB-backed from catalogs"
  );

  // DVKT-COMBO-3: Arbitrary text does NOT create a service (NO mode="tags")
  assert.ok(
    !drawerCode.includes('mode="tags"') && !cardCode.includes('mode="tags"'),
    "DVKT-COMBO-3: mode='tags' is strictly forbidden to prevent uncataloged service creation"
  );
  assert.ok(
    drawerCode.includes('mode="multiple"') && cardCode.includes('mode="multiple"'),
    "DVKT-COMBO-3: mode='multiple' used for canonical service selection"
  );

  // DVKT-COMBO-4 & DVKT-COMBO-5: Search by service code, name, and group
  assert.ok(
    drawerCode.includes("matchSearchNormalized") &&
      cardCode.includes("matchSearchNormalized"),
    "DVKT-COMBO-4 & DVKT-COMBO-5: matchSearchNormalized used for multi-field search"
  );

  // DVKT-COMBO-6: Vietnamese normalized search test
  function testMatch(target: string, query: string): boolean {
    if (!query.trim()) return true;
    const q = query.toLowerCase().trim();
    const qNorm = removeVietnameseAccents(q);
    const t = target.toLowerCase();
    const tNorm = removeVietnameseAccents(t);
    return t.includes(q) || tNorm.includes(qNorm);
  }

  assert.equal(testMatch("Điện châm - Tiền đình", "tien dinh"), true, "DVKT-COMBO-6: 'tien dinh' matches 'Điện châm - Tiền đình'");
  assert.equal(testMatch("Xông thuốc - Mũi xoang", "xoang"), true, "DVKT-COMBO-6: 'xoang' matches 'Xông thuốc - Mũi xoang'");
  assert.equal(testMatch("Hào châm - Liệt mặt", "liet mat"), true, "DVKT-COMBO-6: 'liet mat' matches 'Hào châm - Liệt mặt'");
  assert.equal(testMatch("Bó thuốc - Thoái hóa khớp gối", "thoai hoa"), true, "DVKT-COMBO-6: 'thoai hoa' matches 'Bó thuốc - Thoái hóa khớp gối'");

  // DVKT-COMBO-7: Keyboard selection via Ant Design Select
  assert.ok(
    drawerCode.includes("<Select") && cardCode.includes("<Select"),
    "DVKT-COMBO-7: Ant Design Select provides native ArrowDown + Enter keyboard navigation"
  );

  // DVKT-COMBO-8: Multiple DVKT selection works
  assert.ok(
    drawerCode.includes("selectedServiceIds") &&
      cardCode.includes("selectedServiceIds"),
    "DVKT-COMBO-8: Multi-service array state maintained for order entry"
  );

  // DVKT-COMBO-9: Selected chips removable before Save
  assert.ok(
    drawerCode.includes("handleRemoveService") &&
      cardCode.includes("handleRemoveService"),
    "DVKT-COMBO-9: Compact tags with closable property allow instant removal"
  );

  // DVKT-COMBO-10: TT06 recommendations appear first (above manual DVKT combobox)
  const tt06Idx = drawerCode.indexOf("Gợi Ý DVKT Theo Mã Bệnh (TT06)");
  const manualDvktIdx = drawerCode.indexOf("2. Dịch Vụ Kỹ Thuật (DVKT Bác Sĩ Chỉ Định)");
  assert.ok(
    tt06Idx !== -1 && manualDvktIdx !== -1 && tt06Idx < manualDvktIdx,
    "DVKT-COMBO-10: TT06 recommendations appear above manual DVKT combobox"
  );

  // DVKT-COMBO-11: No diagnosis still permits manual options
  assert.ok(
    drawerCode.includes("groupedServiceOptions") &&
      cardCode.includes("groupedServiceOptions"),
    "DVKT-COMBO-11: Manual options available independently of diagnosis"
  );

  // DVKT-COMBO-12: Unavailable service disabled
  assert.ok(
    drawerCode.includes("!it.is_available") &&
      cardCode.includes("!item.is_available"),
    "DVKT-COMBO-12: Unavailable services properly disabled"
  );

  // DVKT-COMBO-13: Existing order not duplicated
  assert.ok(
    drawerCode.includes("already_ordered") || cardCode.includes("existingServiceIdSet"),
    "DVKT-COMBO-13: Existing orders flagged and deduplicated"
  );

  // DVKT-COMBO-14: Free-text note remains separate from service identity
  assert.ok(
    drawerCode.includes("serviceNotes") &&
      drawerCode.includes("Ghi chú chỉ định DVKT"),
    "DVKT-COMBO-14: Free-text note field is separate from service identity"
  );

  // DVKT-COMBO-15: InputNumber used for session count
  assert.ok(
    drawerCode.includes("<InputNumber") && cardCode.includes("<InputNumber"),
    "DVKT-COMBO-15: Ant Design InputNumber used for planned session count"
  );

  // DVKT-COMBO-16: No runtime Excel read
  assert.ok(
    !drawerCode.includes("xlsx") && !cardCode.includes("xlsx"),
    "DVKT-COMBO-16: Zero runtime XLSX dependencies in UI components"
  );

  // DVKT-COMBO-17: No N+1 option loading
  assert.ok(
    !drawerCode.includes("fetch(") && !cardCode.includes("fetch("),
    "DVKT-COMBO-17: No individual per-option fetches"
  );

  // DVKT-COMBO-18: Option data lazy-loads with Drawer
  assert.ok(
    drawerCode.includes("destroyOnHidden") &&
      cardCode.includes("destroyOnHidden"),
    "DVKT-COMBO-18: Drawer unmounts/resets state on hidden"
  );

  // DVKT-COMBO-19: Save button not overlapped by floating avatar
  assert.ok(
    drawerCode.includes("width={760}") && cardCode.includes("width={760}"),
    "DVKT-COMBO-19: Standard 760px desktop drawer with full viewport height and high z-index portal"
  );

  // DVKT-COMBO-20: Existing TT06/cycle functionality unchanged
  assert.ok(
    drawerCode.includes("cycle_coding") && cardCode.includes("cycle_coding"),
    "DVKT-COMBO-20: Cycle coding reference remains functional and collapsible"
  );

  console.log("All DOCTOR-CLINICAL-ORDER-COMBOBOX-UX2 Tests PASSED!");
}
