import "server-only";
import { createClient } from "@/supabase-clients/server";
import type { MonthMatrixData, MonthMatrixDoctorBlock, MonthMatrixPatientRow, MonthMatrixCell } from "@/types/schedule";
import type { Patient } from "@/types/patient";
import { formatTimeVN } from "@/utils/format-time";

export async function getMonthScheduleMatrix(monthStr: string): Promise<MonthMatrixData> {
  // monthStr is expected to be in "YYYY-MM" format (e.g. "2026-08")
  const parts = monthStr.split("-");
  const year = parseInt(parts[0], 10) || new Date().getFullYear();
  const month = parseInt(parts[1], 10) || (new Date().getMonth() + 1);

  // Compute days in month
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const supabase = await createClient();

  // 1. Fetch active doctors
  const { data: doctors } = await supabase
    .from("staff")
    .select("id, staff_code, full_name")
    .eq("role_type", "DOCTOR")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  // 2. Fetch all appointments in this month
  const { data: appointments } = await supabase
    .from("appointments")
    .select(`
      id,
      patient_id,
      treatment_course_id,
      doctor_id,
      appointment_date,
      scheduled_start_at,
      status,
      manual_override,
      notes,
      patients(id, patient_code, full_name),
      treatment_courses(id, course_no, treatment_course_tags(course_tags(code, label)))
    `)
    .gte("appointment_date", startDate)
    .lte("appointment_date", endDate)
    .neq("status", "CANCELLED")
    .order("scheduled_start_at", { ascending: true });

  const apptList = (appointments as unknown as Array<Record<string, unknown>>) || [];

  // Group appointments by doctor
  const doctorBlocks: MonthMatrixDoctorBlock[] = ((doctors as Array<{ id: string; staff_code: string; full_name: string }>) || []).map((doc) => {
    // Filter appointments assigned to this doctor
    const docAppts = apptList.filter((a) => a.doctor_id === doc.id);

    // Group appointments by patient + course
    const courseMap = new Map<string, MonthMatrixPatientRow>();

    for (const appt of docAppts) {
      const courseId = appt.treatment_course_id as string;
      const patient = appt.patients as unknown as Patient;
      const course = appt.treatment_courses as unknown as {
        course_no: number;
        treatment_course_tags?: Array<{ course_tags?: { code: string; label: string } }>;
      };

      if (!courseMap.has(courseId)) {
        const tags = (course?.treatment_course_tags || [])
          .map((t) => t.course_tags?.code || "")
          .filter(Boolean);

        // Initialize empty day cells for 1..daysInMonth
        const cells: Record<number, MonthMatrixCell | null> = {};
        for (let d = 1; d <= daysInMonth; d++) {
          cells[d] = null;
        }

        courseMap.set(courseId, {
          patient_id: appt.patient_id as string,
          patient_name: patient?.full_name || "Không rõ",
          patient_code: patient?.patient_code || "—",
          treatment_course_id: courseId,
          course_no: course?.course_no || 1,
          tags,
          cells,
        });
      }

      // Populate cell for this appointment date
      const row = courseMap.get(courseId)!;
      const dayNum = parseInt((appt.appointment_date as string).split("-")[2], 10);

      // Extract time from scheduled_start_at ISO string
      let timeStr = "";
      if (appt.scheduled_start_at) {
        const timePart = (appt.scheduled_start_at as string).split("T")[1]?.slice(0, 5);
        timeStr = formatTimeVN(timePart);
      }

      row.cells[dayNum] = {
        appointment_id: appt.id as string,
        time_str: timeStr,
        status: appt.status as MonthMatrixCell["status"],
        manual_override: Boolean(appt.manual_override),
        notes: appt.notes as string | null,
      };
    }

    return {
      doctor_id: doc.id,
      doctor_name: doc.full_name,
      doctor_code: doc.staff_code,
      patient_rows: Array.from(courseMap.values()),
      total_appointments: docAppts.length,
    };
  });

  return {
    month_str: monthStr,
    days_in_month: daysInMonth,
    doctor_blocks: doctorBlocks,
  };
}
