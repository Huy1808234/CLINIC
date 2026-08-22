import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { AutoScheduleInput, AutoScheduleResult } from "@/types/schedule";
import { autoScheduleSchema } from "@/lib/validation/scheduling-schemas";

export async function executeAutoSchedule(
  supabase: SupabaseClient<Database>,
  input: AutoScheduleInput
): Promise<AutoScheduleResult> {
  const validated = autoScheduleSchema.parse(input);

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc("schedule_treatment_course", {
      p_course_id: validated.treatment_course_id,
      p_doctor_id: validated.doctor_id,
      p_start_date: validated.start_date,
      // RPC legacy argument name; semantic is scheduling batch count (number of appointments to create).
      p_session_count: validated.schedule_count,
      p_preferred_time: validated.preferred_time || "07:30:00",
      p_selected_weekdays: validated.selected_weekdays,
    });

    if (rpcError || !rpcData) {
      return {
        success: false,
        status: "FAILED",
        scheduled_count: 0,
        requested_count: validated.schedule_count,
        appointment_ids: [],
        message: "Không thể tự động xếp lịch lúc này. Vui lòng thử lại.",
      };
    }

    const res = rpcData as {
      success: boolean;
      status?: "FULL" | "PARTIAL" | "FAILED";
      error_code?: string;
      scheduled_count?: number;
      requested_count?: number;
      appointment_ids?: string[];
      unscheduled_dates?: string[];
      message?: string;
    };

    if (!res.success) {
      let localizedMessage = res.message || "Không thể tự động xếp lịch lúc này. Vui lòng thử lại.";
      if (res.error_code === "PLAN_NOT_ESTABLISHED") {
        localizedMessage = "Bác sĩ chưa thiết lập kế hoạch điều trị cho liệu trình này.";
      } else if (res.error_code === "EXCEEDS_PLAN_CAPACITY") {
        localizedMessage = "Số lịch muốn xếp vượt quá số buổi còn lại trong kế hoạch điều trị.";
      } else if (res.error_code === "INVALID_SCHEDULE_COUNT") {
        localizedMessage = "Số lịch muốn xếp phải lớn hơn 0.";
      }

      return {
        success: false,
        status: res.status || "FAILED",
        scheduled_count: res.scheduled_count || 0,
        requested_count: res.requested_count || validated.schedule_count,
        appointment_ids: res.appointment_ids || [],
        unscheduled_dates: res.unscheduled_dates,
        message: localizedMessage,
      };
    }

    const isFull = res.status === "FULL" || res.scheduled_count === validated.schedule_count;
    return {
      success: true,
      status: res.status || (isFull ? "FULL" : "PARTIAL"),
      scheduled_count: res.scheduled_count ?? validated.schedule_count,
      requested_count: res.requested_count ?? validated.schedule_count,
      appointment_ids: res.appointment_ids || [],
      unscheduled_dates: res.unscheduled_dates,
      message:
        res.message ||
        `Xếp lịch tự động thành công (${res.scheduled_count ?? validated.schedule_count}/${res.requested_count ?? validated.schedule_count} buổi).`,
    };
  } catch {
    return {
      success: false,
      status: "FAILED",
      scheduled_count: 0,
      requested_count: validated.schedule_count,
      appointment_ids: [],
      message: "Không thể tự động xếp lịch lúc này. Vui lòng thử lại.",
    };
  }
}
