import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ReceptionEncounter } from "@/types/reception";
import type { Patient } from "@/types/patient";
import type { TreatmentCourse } from "@/types/treatment";
import { createReceptionSchema, type CreateReceptionInput } from "@/lib/validation/reception-schemas";
import { createOrMatchPatient } from "@/lib/patients/patient-service";
import { createTreatmentCourse } from "@/lib/treatments/course-service";

export interface ProcessReceptionResult {
  success: boolean;
  reception: ReceptionEncounter;
  patient: Patient;
  course: TreatmentCourse | null;
  message?: string;
}

/**
 * Handles complete reception intake workflow
 */
export async function processReceptionIntake(
  supabase: SupabaseClient<Database>,
  input: CreateReceptionInput,
  clinicId?: string | null,
  actorUserId?: string | null
): Promise<ProcessReceptionResult> {
  const validated = createReceptionSchema.parse(input);

  // 1. Resolve Patient
  let patient: Patient | null = null;
  let relationType = validated.patient_relation_type;

  if (validated.patient_id) {
    const { data: existingPatient } = await supabase
      .from("patients")
      .select("*")
      .eq("id", validated.patient_id)
      .maybeSingle();

    if (!existingPatient) {
      throw new Error(`Patient ID ${validated.patient_id} not found.`);
    }

    patient = existingPatient as unknown as Patient;
    relationType = "RETURNING";
  } else if (validated.patient_data) {
    const matchResult = await createOrMatchPatient(supabase, validated.patient_data, actorUserId || undefined);
    if (!matchResult.patient) {
      throw new Error("Failed to process patient for reception.");
    }
    patient = matchResult.patient;
    relationType = matchResult.isExisting ? "RETURNING" : "NEW";
  } else {
    throw new Error("Either patient_id or patient_data must be provided.");
  }

  // 2. Fetch current insurance card ID if available
  const { data: insuranceCard } = await supabase
    .from("patient_insurance_cards")
    .select("id")
    .eq("patient_id", patient.id)
    .eq("is_current", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 3. Create Reception Encounter Record with explicit clinic ownership
  const { data: newReception, error: receptionError } = await supabase
    .from("receptions")
    .insert({
      clinic_id: clinicId || null,
      patient_id: patient.id,
      insurance_card_id: insuranceCard?.id || null,
      arrived_at: new Date().toISOString(),
      registered_at: new Date().toISOString(),
      reception_source: validated.reception_source,
      patient_relation_type: relationType,
      reason_for_visit: validated.reason_for_visit || null,
      notes: validated.notes || null,
      created_by: actorUserId || null,
    })
    .select()
    .single();

  if (receptionError || !newReception) {
    throw new Error(`Failed to create reception encounter: ${receptionError?.message}`);
  }

  const typedReception = newReception as unknown as ReceptionEncounter;

  // 4. Optionally Create / Continue Treatment Course with SAME clinic ownership
  let course: TreatmentCourse | null = null;
  if (validated.create_course) {
    const courseResult = await createTreatmentCourse(
      supabase,
      {
        patient_id: patient.id,
        reception_id: typedReception.id,
        primary_doctor_id: validated.doctor_id || null,
        start_date: validated.start_date,
        planned_session_count: null,
        diagnoses: [],
        service_orders: [],
      },
      clinicId,
      actorUserId
    );

    course = courseResult.course;
  }

  // 5. Record Audit Log
  await supabase.from("audit_logs").insert({
    actor_user_id: actorUserId || null,
    action: "RECEPTION_INTAKE",
    entity_type: "RECEPTION",
    entity_id: typedReception.id,
    after_data: JSON.parse(JSON.stringify(typedReception)),
  });

  return {
    success: true,
    reception: typedReception,
    patient,
    course,
    message: "Tiếp nhận bệnh nhân thành công.",
  };
}
