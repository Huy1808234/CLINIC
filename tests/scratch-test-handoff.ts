import { getPatientHistory } from "@/rsc-data/patients/get-patient-history";

async function testHandoff() {
  console.log("=== CALLING getPatientHistory FOR PATIENT f2686bf4-0234-4bef-8da9-81c8ef7f4800 ===");
  const history = await getPatientHistory("f2686bf4-0234-4bef-8da9-81c8ef7f4800");
  console.log("History result:", JSON.stringify(history, null, 2));
}

testHandoff().catch(console.error);
