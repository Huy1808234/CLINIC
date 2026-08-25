import "server-only";
import { createClient } from "@/supabase-clients/server";
import type {
  PatientHistorySummary,
  Patient,
  PatientInsuranceCard,
  PatientMeasurement,
  PatientAlert,
  ClinicalNoteItem,
} from "@/types/patient";

export async function getPatientHistory(patientId: string): Promise<PatientHistorySummary | null> {
  const supabase = await createClient();

  // 1. Resolve patient primary record with explicit projection
  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select(`
      id,
      patient_code,
      full_name,
      normalized_name,
      phone,
      citizen_id,
      citizen_id_issued_at,
      citizen_id_issued_by,
      birth_date,
      birth_year,
      dob_precision,
      sex,
      address,
      occupation,
      notes,
      is_active,
      created_at,
      updated_at
    `)
    .eq("id", patientId)
    .maybeSingle();

  if (patientError || !patient) return null;

  // 2. Concurrently fetch all independent patient clinical sub-collections in a single parallel roundtrip
  const [
    insuranceRes,
    measurementRes,
    alertRes,
    courseRes,
    appointmentRes,
    receptionRes,
    noteRes,
  ] = await Promise.all([
    // 1. Insurance cards history (explicit columns + deterministic ordering)
    supabase
      .from("patient_insurance_cards")
      .select(`
        id,
        patient_id,
        card_number,
        registered_facility_code,
        registered_facility_name,
        subject_code,
        benefit_rate,
        valid_from,
        valid_to,
        raw_validity_text,
        verification_status,
        verified_at,
        is_current,
        created_at
      `)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }),

    // 2. Measurement history (explicit columns + deterministic ordering)
    supabase
      .from("patient_measurements")
      .select(`
        id,
        patient_id,
        height_cm,
        weight_kg,
        source,
        recorded_by,
        measured_at
      `)
      .eq("patient_id", patientId)
      .order("measured_at", { ascending: false })
      .order("id", { ascending: false }),

    // 3. Alerts (explicit columns + deterministic ordering)
    supabase
      .from("patient_alerts")
      .select(`
        id,
        patient_id,
        category,
        severity,
        message,
        is_active,
        created_by,
        created_at,
        resolved_at
      `)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }),

    // 4. Treatment courses with doctor, diagnoses, and orders
    supabase
      .from("treatment_courses")
      .select(`
        id,
        patient_id,
        clinic_id,
        course_no,
        start_date,
        status,
        adherence_status,
        primary_doctor_id,
        planned_by_doctor_id,
        planned_session_count,
        completed_session_count,
        planned_at,
        planned_end_date,
        actual_end_date,
        notes,
        created_at,
        staff:primary_doctor_id(full_name),
        planned_by_doctor:planned_by_doctor_id(full_name),
        course_diagnoses(id, diagnosis_id, raw_code, raw_text, diagnosis_type, is_primary),
        course_service_orders(id, service_id, sequence_no, is_active, service_catalog(id, service_code, service_name))
      `)
      .eq("patient_id", patientId)
      .order("course_no", { ascending: false }),

    // 5. Recent appointments (bounded + explicit columns)
    supabase
      .from("appointments")
      .select(`
        id,
        patient_id,
        treatment_course_id,
        doctor_id,
        appointment_date,
        scheduled_start_at,
        scheduled_end_at,
        status,
        schedule_source,
        notes,
        created_at,
        staff:doctor_id(full_name)
      `)
      .eq("patient_id", patientId)
      .order("appointment_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(20),

    // 6. Recent receptions (bounded + explicit columns)
    supabase
      .from("receptions")
      .select(`
        id,
        patient_id,
        clinic_id,
        insurance_card_id,
        arrived_at,
        registered_at,
        reception_source,
        patient_relation_type,
        reason_for_visit,
        notes,
        created_by,
        created_at
      `)
      .eq("patient_id", patientId)
      .order("registered_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(5),

    // 7. Recent clinical notes (bounded to latest 4 rows for main card + total count)
    supabase
      .from("clinical_notes")
      .select(`
        id,
        patient_id,
        clinic_id,
        organization_id,
        treatment_course_id,
        reception_id,
        author_staff_id,
        content,
        created_at,
        updated_at,
        staff:author_staff_id(full_name),
        treatment_courses:treatment_course_id(course_no)
      `, { count: "exact" })
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(4),
  ]);

  const insuranceCards = insuranceRes.data || [];
  const measurements = measurementRes.data || [];
  const alerts = alertRes.data || [];
  const courses = courseRes.data || [];
  const appointments = appointmentRes.data || [];
  const receptions = receptionRes.data || [];
  const clinicalNotes = noteRes.data || [];
  const totalClinicalNotesCount = noteRes.count ?? clinicalNotes.length;

  const formattedCourses = (courses as unknown as Array<Record<string, unknown>>).map((c) => {
    const doctorName = (c.staff as { full_name?: string } | null)?.full_name || null;
    const plannedByDoctorName = (c.planned_by_doctor as { full_name?: string } | null)?.full_name || null;

    const rawCourseDiagnoses = ((c.course_diagnoses as Array<{
      id: string;
      diagnosis_id: string | null;
      raw_code: string | null;
      raw_text: string | null;
      diagnosis_type: string;
      is_primary: boolean;
    }>) || []);

    const courseDiagnoses = rawCourseDiagnoses.map((d) => ({
      id: d.id,
      diagnosis_id: d.diagnosis_id,
      raw_code: d.raw_code,
      raw_text: d.raw_text,
      diagnosis_type: d.diagnosis_type || (d.is_primary ? "PRIMARY" : "SECONDARY"),
      is_primary: d.is_primary ?? (d.diagnosis_type === "PRIMARY"),
    }));

    const diagnoses = rawCourseDiagnoses
      .map((d) => (d.raw_code && d.raw_text ? `${d.raw_code} - ${d.raw_text}` : d.raw_code || d.raw_text || ""))
      .filter(Boolean);

    const rawServiceOrders = ((c.course_service_orders as Array<{
      id: string;
      service_id: string;
      sequence_no: number;
      is_active: boolean;
      service_catalog?: { id: string; service_code?: string; service_name?: string };
    }>) || []).filter((s) => s.is_active !== false);

    const courseServices = rawServiceOrders.map((s) => ({
      id: s.id,
      service_id: s.service_id,
      service_code: s.service_catalog?.service_code || "",
      service_name: s.service_catalog?.service_name || "",
      sequence_no: s.sequence_no,
    }));

    const services = rawServiceOrders
      .map((s) => s.service_catalog?.service_name || "")
      .filter(Boolean);

    return {
      id: c.id as string,
      course_no: c.course_no as number,
      start_date: c.start_date as string,
      planned_session_count: (c.planned_session_count as number | null) ?? null,
      planned_by_doctor_id: (c.planned_by_doctor_id as string | null) || null,
      planned_by_doctor_name: plannedByDoctorName,
      planned_at: (c.planned_at as string | null) || null,
      completed_session_count: (c.completed_session_count as number) || 0,
      status: c.status as PatientHistorySummary["treatment_courses"][number]["status"],
      adherence_status: c.adherence_status as PatientHistorySummary["treatment_courses"][number]["adherence_status"],
      doctor_name: doctorName,
      diagnoses,
      services,
      course_diagnoses: courseDiagnoses,
      course_services: courseServices,
    };
  });

  const formattedAppointments = (appointments as unknown as Array<Record<string, unknown>>).map((a) => {
    const doctorName = (a.staff as { full_name?: string } | null)?.full_name || null;
    return {
      id: a.id as string,
      treatment_course_id: a.treatment_course_id as string,
      appointment_date: a.appointment_date as string,
      scheduled_start_at: a.scheduled_start_at as string,
      status: a.status as PatientHistorySummary["recent_appointments"][number]["status"],
      doctor_name: doctorName,
    };
  });

  const formattedReceptions = (receptions as unknown as Array<Record<string, unknown>>).map((r) => {
    const createdByName = (r.staff as { full_name?: string } | null)?.full_name || null;
    return {
      id: r.id as string,
      arrived_at: r.arrived_at as string,
      registered_at: r.registered_at as string,
      reception_source: r.reception_source as string,
      reason_for_visit: (r.reason_for_visit as string | null) || null,
      notes: (r.notes as string | null) || null,
      created_by_name: createdByName,
    };
  });

  const formattedClinicalNotes: ClinicalNoteItem[] = (clinicalNotes as unknown as Array<Record<string, unknown>>).map((n) => {
    const authorName = (n.staff as { full_name?: string } | null)?.full_name || "Bác sĩ";
    const courseNo = (n.treatment_courses as { course_no?: number } | null)?.course_no || null;
    return {
      id: n.id as string,
      patient_id: n.patient_id as string,
      clinic_id: n.clinic_id as string,
      organization_id: n.organization_id as string,
      treatment_course_id: (n.treatment_course_id as string | null) || null,
      reception_id: (n.reception_id as string | null) || null,
      author_staff_id: n.author_staff_id as string,
      author_name: authorName,
      content: n.content as string,
      created_at: n.created_at as string,
      updated_at: n.updated_at as string,
      course_no: courseNo,
    };
  });

  return {
    patient: patient as unknown as Patient,
    insurance_cards: (insuranceCards as unknown as PatientInsuranceCard[]) || [],
    measurements: (measurements as unknown as PatientMeasurement[]) || [],
    alerts: (alerts as unknown as PatientAlert[]) || [],
    treatment_courses: formattedCourses,
    recent_appointments: formattedAppointments,
    recent_receptions: formattedReceptions,
    clinical_notes: formattedClinicalNotes,
    clinical_notes_total_count: totalClinicalNotesCount,
  };
}
