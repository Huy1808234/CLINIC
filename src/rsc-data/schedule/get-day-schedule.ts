import "server-only";
import { createClient } from "@/supabase-clients/server";
import { getActiveClinicContext } from "@/lib/auth/clinic-context";
import { DEFAULT_CLINIC_TIMEZONE } from "@/utils/timezone";
import type { DayTimelineData, DayTimelineSlot } from "@/types/schedule";
import type { AppointmentWithDetails, AppointmentStep } from "@/types/appointment";
import type { Patient } from "@/types/patient";
import { generateDailyTimeSlots } from "@/lib/scheduling/generate-slots";
import { formatTimestampTime } from "@/utils/format-time";

export async function getDayTimeline(dateStr: string): Promise<DayTimelineData> {
  const supabase = await createClient();
  const clinicContext = await getActiveClinicContext();
  const clinicTimezone = clinicContext?.timezone || DEFAULT_CLINIC_TIMEZONE;

  const apptQuery = supabase
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
      sequence_in_day,
      priority,
      manual_override,
      notes,
      created_at,
      updated_at,
      patients(id, patient_code, full_name),
      treatment_courses(course_no),
      staff:doctor_id(full_name),
      appointment_steps(id, appointment_id, service_id, resource_id, staff_id, step_sequence, planned_duration_minutes, planned_start_at, planned_end_at, status)
    `)
    .eq("appointment_date", dateStr)
    .neq("status", "CANCELLED")
    .order("scheduled_start_at", { ascending: true })
    .order("id", { ascending: true });

  // Concurrently fetch active doctors and appointments in parallel
  const [docRes, apptRes] = await Promise.all([
    supabase
      .from("staff")
      .select("id, staff_code, full_name")
      .eq("role_type", "DOCTOR")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    apptQuery,
  ]);

  const docList = (docRes.data as Array<{ id: string; staff_code: string; full_name: string }>) || [];
  const apptList = (apptRes.data as unknown as Array<Record<string, unknown>>) || [];

  // 3. Generate 5-minute time slots
  const timeSlots = generateDailyTimeSlots({
    openTime: "07:00",
    closeTime: "17:00",
    intervalMinutes: 5,
  });

  // Map appointments to formatted details
  const formattedAppts: AppointmentWithDetails[] = apptList.map((a) => {
    const patient = a.patients as unknown as Patient;
    const course = a.treatment_courses as unknown as { course_no: number };
    const doctor = a.staff as { full_name?: string } | null;

    return {
      id: a.id as string,
      patient_id: a.patient_id as string,
      treatment_course_id: a.treatment_course_id as string,
      doctor_id: a.doctor_id as string | null,
      appointment_date: a.appointment_date as string,
      scheduled_start_at: a.scheduled_start_at as string,
      scheduled_end_at: a.scheduled_end_at as string | null,
      status: a.status as AppointmentWithDetails["status"],
      schedule_source: a.schedule_source as AppointmentWithDetails["schedule_source"],
      sequence_in_day: a.sequence_in_day as number | null,
      priority: a.priority as number,
      manual_override: Boolean(a.manual_override),
      notes: a.notes as string | null,
      created_at: a.created_at as string,
      updated_at: a.updated_at as string,
      patient_name: patient?.full_name || "Không rõ",
      patient_code: patient?.patient_code || "—",
      doctor_name: doctor?.full_name || null,
      course_no: course?.course_no || 1,
      steps: (a.appointment_steps as AppointmentStep[]) || [],
    };
  });

  // Group into DayTimelineSlots
  const slots: DayTimelineSlot[] = timeSlots.map((timeStr) => {
    const appointmentsByDoctor: Record<string, AppointmentWithDetails[]> = {};

    for (const doc of docList) {
      appointmentsByDoctor[doc.id] = [];
    }

    // Assign appointments starting within this slot in clinic-local time
    for (const appt of formattedAppts) {
      if (appt.doctor_id && appt.scheduled_start_at) {
        const apptTime = formatTimestampTime(appt.scheduled_start_at, clinicTimezone);
        if (apptTime === timeStr) {
          if (!appointmentsByDoctor[appt.doctor_id]) {
            appointmentsByDoctor[appt.doctor_id] = [];
          }
          appointmentsByDoctor[appt.doctor_id].push(appt);
        }
      }
    }

    return {
      time_str: timeStr,
      appointments_by_doctor: appointmentsByDoctor,
    };
  });

  return {
    date_str: dateStr,
    doctors: docList.map((d) => ({ id: d.id, name: d.full_name, code: d.staff_code })),
    slots,
    total_appointments: apptList.length,
  };
}
