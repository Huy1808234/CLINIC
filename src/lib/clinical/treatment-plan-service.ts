import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { EstablishInitialTreatmentPlanParsed } from "@/lib/validation/clinical-schemas";

export interface EstablishTreatmentPlanResult {
  success: boolean;
  course_id: string;
  planned_session_count: number;
  planned_by_doctor_id: string;
  planned_at: string;
  message: string;
}

interface EstablishPlanRpcResponse {
  success: boolean;
  error_code?: string;
  course_id?: string;
  planned_session_count?: number;
  planned_by_doctor_id?: string;
  planned_at?: string;
  message?: string;
}

/**
 * Establishes the INITIAL clinical treatment plan for a treatment course atomically via DB RPC.
 *
 * Invariants:
 * 1. Caller holds DOCTOR role at verified active clinic.
 * 2. Invokes `public.establish_treatment_course_plan` PostgreSQL RPC (service_role only, single ACID transaction).
 * 3. Atomic Compare-And-Set: Only updates when `planned_session_count IS NULL` and status in ('PLANNED', 'ACTIVE').
 * 4. Stamped with `planned_by_doctor_id` = verified caller Staff ID, and `planned_at` = trusted database timestamp.
 * 5. Course plan mutation and ESTABLISH_TREATMENT_PLAN audit log commit atomically or rollback together.
 * 6. ZERO direct mutation fallback. Fail closed.
 */
export async function establishInitialTreatmentPlan(
  supabase: SupabaseClient<Database>,
  input: EstablishInitialTreatmentPlanParsed,
  activeClinicId: string,
  doctorStaffId: string,
  authUserId: string
): Promise<EstablishTreatmentPlanResult> {
  // 1. Invoke atomic database RPC
  const { data: rpcRaw, error: rpcErr } = await supabase.rpc(
    "establish_treatment_course_plan",
    {
      p_course_id: input.course_id,
      p_clinic_id: activeClinicId,
      p_planned_session_count: input.planned_session_count,
      p_actor_staff_id: doctorStaffId,
      p_actor_user_id: authUserId,
    }
  );

  if (rpcErr) {
    throw new Error("Không thể thiết lập kế hoạch điều trị lúc này. Vui lòng thử lại.");
  }

  const res = rpcRaw as unknown as EstablishPlanRpcResponse;

  if (!res || !res.success) {
    let localizedMessage = res?.message || "Không thể thiết lập kế hoạch điều trị lúc này. Vui lòng thử lại.";
    if (res?.error_code === "PLAN_ALREADY_ESTABLISHED") {
      localizedMessage = "Kế hoạch điều trị đã được thiết lập trước đó.";
    } else if (res?.error_code === "INVALID_PLAN_COUNT") {
      localizedMessage = "Số buổi điều trị phải lớn hơn 0.";
    } else if (res?.error_code === "COURSE_NOT_FOUND") {
      localizedMessage = "Không tìm thấy liệu trình điều trị.";
    } else if (res?.error_code === "COURSE_NOT_ACCESSIBLE") {
      localizedMessage = "Bạn không có quyền thao tác trên liệu trình này.";
    } else if (res?.error_code === "COURSE_NOT_PLAN_ELIGIBLE") {
      localizedMessage = "Liệu trình hiện không ở trạng thái có thể lập kế hoạch điều trị.";
    } else if (res?.error_code === "INVALID_ACTOR" || res?.error_code === "UNAUTHORIZED_DOCTOR") {
      localizedMessage = "Tài khoản bác sĩ thực hiện không hợp lệ.";
    }

    throw new Error(localizedMessage);
  }

  return {
    success: true,
    course_id: res.course_id || input.course_id,
    planned_session_count: res.planned_session_count || input.planned_session_count,
    planned_by_doctor_id: res.planned_by_doctor_id || doctorStaffId,
    planned_at: res.planned_at || new Date().toISOString(),
    message: res.message || "Thiết lập kế hoạch điều trị thành công.",
  };
}

