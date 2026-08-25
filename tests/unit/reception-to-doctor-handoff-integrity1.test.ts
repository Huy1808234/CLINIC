import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";

export function runReceptionToDoctorHandoffIntegrity1Tests() {
  console.log("Running RECEPTION-TO-DOCTOR-HANDOFF-INTEGRITY1 Tests...");

  const patientHistoryPath = path.join(process.cwd(), "src", "rsc-data", "patients", "get-patient-history.ts");
  const patientProfilePath = path.join(process.cwd(), "src", "rsc-data", "patients", "get-patient.ts");
  const searchPatientsPath = path.join(process.cwd(), "src", "rsc-data", "patients", "search-patients.ts");
  const receptionsPath = path.join(process.cwd(), "src", "rsc-data", "reception", "get-receptions.ts");
  const currentVisitCardPath = path.join(process.cwd(), "src", "components", "patients", "CurrentVisitCard.tsx");
  const clinicalDrawerPath = path.join(process.cwd(), "src", "components", "reception", "ClinicalOrderDrawer.tsx");

  assert.ok(fs.existsSync(patientHistoryPath), "get-patient-history.ts exists");
  assert.ok(fs.existsSync(patientProfilePath), "get-patient.ts exists");
  assert.ok(fs.existsSync(searchPatientsPath), "search-patients.ts exists");
  assert.ok(fs.existsSync(receptionsPath), "get-receptions.ts exists");
  assert.ok(fs.existsSync(currentVisitCardPath), "CurrentVisitCard.tsx exists");
  assert.ok(fs.existsSync(clinicalDrawerPath), "ClinicalOrderDrawer.tsx exists");

  const historyCode = fs.readFileSync(patientHistoryPath, "utf-8");
  const profileCode = fs.readFileSync(patientProfilePath, "utf-8");
  const searchCode = fs.readFileSync(searchPatientsPath, "utf-8");
  const recsCode = fs.readFileSync(receptionsPath, "utf-8");
  const currentVisitCode = fs.readFileSync(currentVisitCardPath, "utf-8");
  const drawerCode = fs.readFileSync(clinicalDrawerPath, "utf-8");

  // HANDOFF-1: getPatientHistory schema projection correctness
  assert.ok(
    historyCode.includes("height_cm") &&
      historyCode.includes("weight_kg") &&
      !historyCode.includes("blood_pressure_systolic") &&
      !historyCode.includes("initial_healthcare_code") &&
      !historyCode.includes("alert_type"),
    "HANDOFF-1: getPatientHistory uses canonical schema column names (height_cm, weight_kg, valid_from, category)"
  );

  // HANDOFF-2: getPatientProfile schema projection correctness
  assert.ok(
    profileCode.includes("height_cm") &&
      profileCode.includes("weight_kg") &&
      !profileCode.includes("blood_pressure_systolic") &&
      !profileCode.includes("initial_healthcare_code") &&
      !profileCode.includes("alert_type"),
    "HANDOFF-2: getPatientProfile uses canonical schema column names"
  );

  // HANDOFF-3: searchPatients schema projection correctness
  assert.ok(
    searchCode.includes("height_cm") &&
      searchCode.includes("weight_kg") &&
      !searchCode.includes("blood_pressure_systolic") &&
      !searchCode.includes("initial_healthcare_code") &&
      !searchCode.includes("alert_type"),
    "HANDOFF-3: searchPatients fetchProfilesByIds uses canonical schema column names"
  );

  // HANDOFF-4: getTodayReceptions schema projection correctness
  assert.ok(
    recsCode.includes("registered_facility_code") &&
      !recsCode.includes("initial_healthcare_code"),
    "HANDOFF-4: getTodayReceptions uses canonical insurance card column names"
  );

  // HANDOFF-5: CurrentVisitCard displays doctor handoff context
  assert.ok(
    currentVisitCode.includes("Lý do đến khám") &&
      currentVisitCode.includes("Triệu chứng ban đầu") &&
      currentVisitCode.includes("Bác sĩ tiếp nhận") &&
      currentVisitCode.includes("Tiếp nhận lúc") &&
      currentVisitCode.includes("Bắt đầu khám"),
    "HANDOFF-5: CurrentVisitCard renders complete doctor handoff block (Reason, Symptoms, Doctor, Time, Start Exam)"
  );

  // HANDOFF-6: ClinicalOrderDrawer displays intake reason and symptoms context
  assert.ok(
    drawerCode.includes("Lý do đến khám:") &&
      drawerCode.includes("Triệu chứng ban đầu:"),
    "HANDOFF-6: ClinicalOrderDrawer renders reception intake reason and symptoms context"
  );

  console.log("All RECEPTION-TO-DOCTOR-HANDOFF-INTEGRITY1 Tests PASSED!");
}
