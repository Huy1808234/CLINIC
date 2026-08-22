import "server-only";
import { createClient } from "@/supabase-clients/server";
import type { PatientHistorySummary, Patient, PatientInsuranceCard, PatientMeasurement, PatientAlert } from "@/types/patient";

export async function getPatientHistory(patientId: string): Promise<PatientHistorySummary | null> {
  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .maybeSingle();

  if (!patient) return null;

  // 1. Insurance cards history
  const { data: insuranceCards } = await supabase
    .from("patient_insurance_cards")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  // 2. Measurement history
  const { data: measurements } = await supabase
    .from("patient_measurements")
    .select("*")
    .eq("patient_id", patientId)
    .order("measured_at", { ascending: false });

  // 3. Alerts
  const { data: alerts } = await supabase
    .from("patient_alerts")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  // 4. Treatment courses with doctor and orders
  const { data: courses } = await supabase
    .from("treatment_courses")
    .select(`
      *,
      staff:primary_doctor_id(full_name),
      planned_by_doctor:planned_by_doctor_id(full_name),
      course_diagnoses(raw_code, raw_text),
      course_service_orders(service_catalog(service_name))
    `)
    .eq("patient_id", patientId)
    .order("course_no", { ascending: false });

  // 5. Recent appointments
  const { data: appointments } = await supabase
    .from("appointments")
    .select(`
      *,
      staff:doctor_id(full_name)
    `)
    .eq("patient_id", patientId)
    .order("appointment_date", { ascending: false })
    .limit(20);

  const formattedCourses = ((courses as unknown as Array<Record<string, unknown>>) || []).map((c) => {
    const doctorName = (c.staff as { full_name?: string } | null)?.full_name || null;
    const plannedByDoctorName = (c.planned_by_doctor as { full_name?: string } | null)?.full_name || null;
    const diagnoses = ((c.course_diagnoses as Array<{ raw_code?: string; raw_text?: string }>) || [])
      .map((d) => d.raw_code || d.raw_text || "")
      .filter(Boolean);
    const services = ((c.course_service_orders as Array<{ service_catalog?: { service_name?: string } }>) || [])
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
    };
  });

  const formattedAppointments = ((appointments as unknown as Array<Record<string, unknown>>) || []).map((a) => {
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

  return {
    patient: patient as unknown as Patient,
    insurance_cards: (insuranceCards as unknown as PatientInsuranceCard[]) || [],
    measurements: (measurements as unknown as PatientMeasurement[]) || [],
    alerts: (alerts as unknown as PatientAlert[]) || [],
    treatment_courses: formattedCourses,
    recent_appointments: formattedAppointments,
  };
}
