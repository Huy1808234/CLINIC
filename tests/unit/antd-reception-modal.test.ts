import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { createReceptionSchema } from "@/lib/validation/reception-schemas";
import { parseHeightCm, parseWeightKg } from "@/lib/patients/normalizers";

export function runAntdReceptionModalTests() {
  console.log("Running Ant Design Reception Modal UI Contract Tests...");

  // 1. Normalizer reuse: parseHeightCm & parseWeightKg (RX-M3-9)
  {
    assert.equal(parseHeightCm(165), 165, "Parses 165 numeric");
    assert.equal(parseHeightCm("165 cm"), 165, "Parses '165 cm' string");
    assert.equal(parseHeightCm("1.65"), 165, "Converts 1.65 meters to 165 cm");
    assert.equal(parseHeightCm(null), null, "Null height returns null (RX-M3-7)");
    assert.equal(parseHeightCm(""), null, "Empty height returns null (RX-M3-7)");

    assert.equal(parseWeightKg(60), 60, "Parses 60 numeric");
    assert.equal(parseWeightKg("60 kg"), 60, "Parses '60 kg' string");
    assert.equal(parseWeightKg("60.5"), 60.5, "Parses decimal weight");
    assert.equal(parseWeightKg(null), null, "Null weight returns null (RX-M3-8)");
    assert.equal(parseWeightKg(""), null, "Empty weight returns null (RX-M3-8)");
  }

  // 2. Validate canonical reception payload schema with optional height/weight (RX-M3-11, 16)
  {
    const parsedWithMeasurements = createReceptionSchema.safeParse({
      patient_id: null,
      patient_data: {
        full_name: "Nguyễn Văn An",
        phone: "0912345678",
        citizen_id: "001090000001",
        insurance_card_number: "DN4010123456789",
        birth_year: 1985,
        dob_precision: "YEAR_ONLY",
        height_cm: 165,
        weight_kg: 60,
        address: "Hà Nội",
        notes: "Đau mỏi vai gáy",
      },
      reception_source: "MANUAL",
      patient_relation_type: "NEW",
      reason_for_visit: "Đau lưng",
      create_course: true,
      doctor_id: "00000000-0000-0000-0000-000000000001",
    });

    assert.equal(parsedWithMeasurements.success, true, "Payload with measurements valid");
    if (parsedWithMeasurements.success) {
      assert.equal(parsedWithMeasurements.data.patient_data?.height_cm, 165, "height_cm preserved in payload");
      assert.equal(parsedWithMeasurements.data.patient_data?.weight_kg, 60, "weight_kg preserved in payload");
    }

    // Optionality: null height and weight also valid
    const parsedWithoutMeasurements = createReceptionSchema.safeParse({
      patient_id: null,
      patient_data: {
        full_name: "Trần Thị B",
        height_cm: null,
        weight_kg: null,
      },
      reception_source: "MANUAL",
      patient_relation_type: "NEW",
    });
    assert.equal(parsedWithoutMeasurements.success, true, "Height/weight are optional (RX-M3-7, 8)");
  }

  // 3. Schema prohibits receptionist from prescribing DVKT or formal diagnoses (RX-M3-18)
  {
    const parsedWithDiagnosis = createReceptionSchema.safeParse({
      patient_id: null,
      patient_data: { full_name: "Test" },
      diagnoses: [{ diagnosis_id: "00000000-0000-0000-0000-000000000002" }],
    });
    assert.equal(parsedWithDiagnosis.success, false, "Reception modal cannot submit formal diagnoses (RX-M3-18)");

    const parsedWithServices = createReceptionSchema.safeParse({
      patient_id: null,
      patient_data: { full_name: "Test" },
      service_orders: [{ service_id: "00000000-0000-0000-0000-000000000003" }],
    });
    assert.equal(parsedWithServices.success, false, "Reception modal cannot submit DVKT service orders (RX-M3-18)");
  }

  // 4. Source inspection of ReceptionModal.tsx
  {
    const modalPath = path.join(process.cwd(), "src", "components", "reception", "ReceptionModal.tsx");
    assert(fs.existsSync(modalPath), "ReceptionModal.tsx exists");
    const modalSrc = fs.readFileSync(modalPath, "utf-8");

    // Visual & Structure checks
    assert(modalSrc.includes("width={880}"), "ReceptionModal desktop width is 880px");
    assert(modalSrc.includes("Tiếp Nhận & Đăng Ký Khám Mới"), "Header title matches spec");
    assert(modalSrc.includes("1. THÔNG TIN BỆNH NHÂN"), "Section 1 title present");
    assert(modalSrc.includes("2. THÔNG TIN TIẾP NHẬN"), "Section 2 title present");
    assert(modalSrc.includes("Alert"), "Info block present");
    assert(modalSrc.includes("Lưu ý:"), "Guidance note present");
    assert(modalSrc.includes("Hoàn Tất Tiếp Nhận"), "Footer CTA button present");
    assert(modalSrc.includes("submitReceptionAction"), "Calls canonical submitReceptionAction (RX-M3-13)");

    // Height & Weight UI (RX-M3-1, 2, 3, 4, 5, 6)
    assert(modalSrc.includes("Chiều cao"), "Height label present (RX-M3-1)");
    assert(modalSrc.includes("Cân nặng"), "Weight label present (RX-M3-2)");
    assert(modalSrc.includes(">cm<"), "Height unit is cm (RX-M3-3)");
    assert(modalSrc.includes(">kg<"), "Weight unit is kg (RX-M3-4)");
    assert(!modalSrc.includes("addonAfter"), "Does not use deprecated addonAfter on InputNumber");
    assert(modalSrc.includes("parseHeightCm"), "Reuses canonical parseHeightCm (RX-M3-9, 10)");
    assert(modalSrc.includes("parseWeightKg"), "Reuses canonical parseWeightKg (RX-M3-9, 10)");

    // Deprecation check: destroyOnHidden used, no destroyOnClose (RX-M3-21, 22)
    assert(modalSrc.includes("destroyOnHidden"), "ReceptionModal uses destroyOnHidden (RX-M3-22)");
    assert(!modalSrc.includes("destroyOnClose"), "ReceptionModal does not use deprecated destroyOnClose (RX-M3-21)");

    // No hardcoded doctor names or LT tags (RX-M3-17)
    assert(!modalSrc.includes("BS Anh"), "No hardcoded BS Anh");
    assert(!modalSrc.includes("BS Kha"), "No hardcoded BS Kha");
    assert(!modalSrc.includes("BS Tuấn"), "No hardcoded BS Tuấn");
    assert(!modalSrc.includes('"LT1"'), "No hardcoded LT1");
    assert(!modalSrc.includes('"LT2"'), "No hardcoded LT2");
    assert(!modalSrc.includes('"LT3"'), "No hardcoded LT3");
  }

  console.log("All Ant Design Reception Modal UI Contract Tests PASSED!");
}
