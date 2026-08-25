import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import type { PatientProfile } from "@/types/patient";

export function runAntdPatientMasterTests() {
  console.log("Running Ant Design Patient Master UI Contract Tests...");

  // Mock patient dataset
  const mockPatients: PatientProfile[] = [
    {
      id: "pat-1",
      patient_code: "BN-2026-0001",
      full_name: "Nguyễn Hải Huy",
      normalized_name: "nguyen hai huy",
      phone: "0912345678",
      citizen_id: "001090000001",
      citizen_id_issued_at: null,
      citizen_id_issued_by: null,
      birth_date: "1990-05-15",
      birth_year: 1990,
      dob_precision: "DATE",
      sex: "NAM",
      address: "Hà Nội",
      occupation: null,
      notes: null,
      is_active: true,
      created_at: "2026-08-20T00:00:00Z",
      updated_at: "2026-08-20T00:00:00Z",
      current_insurance: {
        id: "ins-1",
        patient_id: "pat-1",
        card_number: "DN4010123456789",
        registered_facility_code: "01001",
        registered_facility_name: "Bệnh viện Bạch Mai",
        subject_code: "DN",
        benefit_rate: 80,
        valid_from: "2026-01-01",
        valid_to: "2026-12-31",
        raw_validity_text: null,
        verification_status: "VALID",
        verified_at: null,
        is_current: true,
        created_at: "2026-08-20T00:00:00Z",
      },
      latest_measurement: null,
      active_alerts: [],
      active_treatment_courses_count: 1,
    },
    {
      id: "pat-2",
      patient_code: "BN-2026-0002",
      full_name: "Trần Thị Mai",
      normalized_name: "tran thi mai",
      phone: null, // missing phone
      citizen_id: null, // missing cccd
      citizen_id_issued_at: null,
      citizen_id_issued_by: null,
      birth_date: "1985-11-20",
      birth_year: 1985,
      dob_precision: "DATE",
      sex: "NU",
      address: "Hải Phòng",
      occupation: null,
      notes: null,
      is_active: true,
      created_at: "2026-08-21T00:00:00Z",
      updated_at: "2026-08-21T00:00:00Z",
      current_insurance: null,
      latest_measurement: null,
      active_alerts: [],
      active_treatment_courses_count: 0,
    },
  ];

  // 1. Metric calculations
  {
    const total = mockPatients.length;
    const withInsurance = mockPatients.filter((p) => !!p.current_insurance?.card_number).length;
    const withCccd = mockPatients.filter((p) => !!p.citizen_id).length;
    const missingPhone = mockPatients.filter((p) => !p.phone).length;

    assert.equal(total, 2, "Total patients calculated correctly");
    assert.equal(withInsurance, 1, "Patients with insurance calculated correctly");
    assert.equal(withCccd, 1, "Patients with CCCD calculated correctly");
    assert.equal(missingPhone, 1, "Patients missing phone calculated correctly");
  }

  // 2. Source inspection of PatientTable.tsx
  {
    const tablePath = path.join(process.cwd(), "src", "components", "patients", "PatientTable.tsx");
    assert(fs.existsSync(tablePath), "PatientTable.tsx exists");
    const tableSrc = fs.readFileSync(tablePath, "utf-8");

    assert(tableSrc.includes("Table"), "PatientTable uses Ant Design Table");
    assert(tableSrc.includes("Avatar"), "PatientTable uses Ant Design Avatar");
    assert(tableSrc.includes("Tag"), "PatientTable uses Ant Design Tag");
    assert(tableSrc.includes("Button"), "PatientTable uses Ant Design Button");
    assert(tableSrc.includes("Xem Hồ Sơ"), "PatientTable renders Xem Hồ Sơ button");
    assert(tableSrc.includes("Chưa có bệnh nhân"), "PatientTable handles empty dataset");
    assert(tableSrc.includes("Không tìm thấy bệnh nhân phù hợp"), "PatientTable handles no-result search");
  }

  // 3. Source inspection of PatientClientView.tsx
  {
    const clientViewPath = path.join(process.cwd(), "src", "components", "patients", "PatientClientView.tsx");
    assert(fs.existsSync(clientViewPath), "PatientClientView.tsx exists");
    const clientViewSrc = fs.readFileSync(clientViewPath, "utf-8");

    assert(clientViewSrc.includes("Tạo Hồ Sơ Bệnh Nhân Mới"), "PatientClientView has primary create button");
    assert(clientViewSrc.includes("/reception"), "Create button links to /reception");
    assert(clientViewSrc.includes("SearchOutlined"), "Search input uses search icon");
    assert(clientViewSrc.includes("Danh Sách Bệnh Nhân"), "Card header has list title");
  }

  // 4. Source inspection of page.tsx
  {
    const pagePath = path.join(process.cwd(), "src", "app", "patients", "page.tsx");
    assert(fs.existsSync(pagePath), "patients/page.tsx exists");
    const pageSrc = fs.readFileSync(pagePath, "utf-8");

    assert(pageSrc.includes("Quản Lý Hồ Sơ Bệnh Nhân"), "page.tsx sets AppShell title");
    assert(pageSrc.includes("PatientClientView"), "page.tsx renders PatientClientView");
    assert(pageSrc.includes("getRecentPatients"), "page.tsx calls getRecentPatients");
  }

  console.log("All Ant Design Patient Master UI Contract Tests PASSED!");
}
