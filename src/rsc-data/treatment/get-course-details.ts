import "server-only";
import { createClient } from "@/supabase-clients/server";
import type { TreatmentCourseDetail } from "@/types/treatment";
import type { Patient } from "@/types/patient";

export async function getTreatmentCourseDetail(courseId: string): Promise<TreatmentCourseDetail | null> {
  const supabase = await createClient();

  const { data: course, error } = await supabase
    .from("treatment_courses")
    .select(`
      *,
      patients(*),
      staff:primary_doctor_id(full_name),
      planned_by_doctor:planned_by_doctor_id(full_name),
      course_diagnoses(id, diagnosis_id, raw_code, raw_text, diagnosis_type, is_primary, diagnosis_catalog(*)),
      course_service_orders(id, service_id, order_source, sequence_no, side_or_location, notes, active_from, active_to, is_active, created_at, service_catalog(*)),
      treatment_course_tags(note, course_tags(id, code, label, category))
    `)
    .eq("id", courseId)
    .maybeSingle();

  if (error || !course) {
    return null;
  }

  const c = course as unknown as Record<string, unknown>;
  const planned = (c.planned_session_count as number) || 1;
  const completed = (c.completed_session_count as number) || 0;
  const progress = Math.min(100, Math.round((completed / planned) * 100));

  const tags = ((c.treatment_course_tags as Array<{ note?: string; course_tags?: { id: string; code: string; label: string; category: string } }>) || [])
    .map((t) => ({
      id: t.course_tags?.id || "",
      code: t.course_tags?.code || "",
      label: t.course_tags?.label || "",
      category: t.course_tags?.category || "TREATMENT",
      note: t.note || null,
    }))
    .filter((t) => t.id);

  return {
    id: c.id as string,
    patient_id: c.patient_id as string,
    reception_id: c.reception_id as string | null,
    course_no: c.course_no as number,
    primary_doctor_id: c.primary_doctor_id as string | null,
    start_date: c.start_date as string,
    planned_end_date: c.planned_end_date as string | null,
    actual_end_date: c.actual_end_date as string | null,
    planned_session_count: (c.planned_session_count as number | null) ?? null,
    planned_by_doctor_id: (c.planned_by_doctor_id as string | null) || null,
    planned_by_doctor_name: (c.planned_by_doctor as { full_name?: string } | null)?.full_name || null,
    planned_at: (c.planned_at as string | null) || null,
    completed_session_count: completed,
    status: c.status as TreatmentCourseDetail["status"],
    adherence_status: c.adherence_status as TreatmentCourseDetail["adherence_status"],
    notes: c.notes as string | null,
    created_at: c.created_at as string,
    created_by: c.created_by as string | null,
    patient: c.patients as unknown as Patient,
    doctor_name: (c.staff as { full_name?: string } | null)?.full_name || null,
    diagnoses: (c.course_diagnoses as TreatmentCourseDetail["diagnoses"]) || [],
    service_orders: ((c.course_service_orders as Array<Record<string, unknown>>) || []).map((s) => ({
      id: s.id as string,
      treatment_course_id: c.id as string,
      service_id: s.service_id as string,
      ordered_by_doctor_id: null,
      order_source: s.order_source as TreatmentCourseDetail["service_orders"][number]["order_source"],
      sequence_no: s.sequence_no as number,
      side_or_location: s.side_or_location as string | null,
      notes: s.notes as string | null,
      active_from: s.active_from as string | null,
      active_to: s.active_to as string | null,
      is_active: Boolean(s.is_active),
      created_at: s.created_at as string,
      service: s.service_catalog as unknown as TreatmentCourseDetail["service_orders"][number]["service"],
    })),
    tags,
    progress_percentage: progress,
  };
}
