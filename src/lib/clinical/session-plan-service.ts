import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { SaveTreatmentSessionPlanParsed } from "@/lib/validation/clinical-schemas";

export interface SaveTreatmentSessionPlanResult {
  success: boolean;
  plan_id: string;
  treatment_course_id: string;
  session_number: number;
  service_count: number;
  planned_by_doctor_id: string;
  message: string;
}

interface SaveSessionPlanRpcResponse {
  success: boolean;
  error_code?: string;
  plan_id?: string;
  treatment_course_id?: string;
  session_number?: number;
  service_count?: number;
  planned_by_doctor_id?: string;
  message?: string;
}

/**
 * Saves one explicit treatment-session occurrence plan and its ordered DVKT services atomically via DB RPC.
 *
 * Invariants:
 * 1. Caller holds DOCTOR role at verified active clinic.
 * 2. Invokes `public.save_treatment_session_plan` PostgreSQL RPC (service_role only, single ACID transaction).
 * 3. Locks treatment_courses row FOR UPDATE and verifies 1 <= session_number <= planned_session_count.
 * 4. Stamped with `planned_by_doctor_id` = verified caller Doctor Staff ID.
 * 5. Preserves existing plan UUID across edits and replaces child services atomically.
 * 6. Blocks edits if an appointment linked to this plan is already started or completed.
 * 7. ZERO direct table-write fallback. Fail closed.
 */
export async function saveTreatmentSessionPlan(
  supabase: SupabaseClient<Database>,
  input: SaveTreatmentSessionPlanParsed,
  activeClinicId: string,
  doctorStaffId: string,
  authUserId: string
): Promise<SaveTreatmentSessionPlanResult> {
  // 1. Invoke atomic database RPC
  const { data: rpcRaw, error: rpcErr } = await supabase.rpc(
    "save_treatment_session_plan",
    {
      p_treatment_course_id: input.treatment_course_id,
      p_clinic_id: activeClinicId,
      p_session_number: input.session_number,
      p_service_ids: input.service_ids,
      p_notes: input.notes || null,
      p_actor_staff_id: doctorStaffId,
      p_actor_user_id: authUserId,
    }
  );

  if (rpcErr) {
    throw new Error("Không thể lưu kế hoạch buổi điều trị lúc này. Vui lòng thử lại.");
  }

  const res = rpcRaw as unknown as SaveSessionPlanRpcResponse;

  if (!res || !res.success) {
    let localizedMessage = res?.message || "Không thể lưu kế hoạch buổi điều trị.";
    if (res?.error_code === "PLAN_COUNT_NOT_ESTABLISHED") {
      localizedMessage = "Bác sĩ chưa thiết lập tổng số buổi điều trị cho liệu trình này.";
    } else if (res?.error_code === "INVALID_SESSION_NUMBER") {
      localizedMessage = res.message || "Số thứ tự buổi điều trị không hợp lệ.";
    } else if (res?.error_code === "DUPLICATE_SERVICES") {
      localizedMessage = "Danh sách dịch vụ không được chứa dịch vụ trùng lặp trong cùng một buổi.";
    } else if (res?.error_code === "INVALID_OR_INACTIVE_SERVICE") {
      localizedMessage = "Một hoặc nhiều dịch vụ không hợp lệ hoặc đã ngưng hoạt động.";
    } else if (res?.error_code === "PLAN_MUTATION_LOCKED") {
      localizedMessage = "Không thể sửa kế hoạch của buổi điều trị đã hoặc đang được thực hiện.";
    } else if (res?.error_code === "COURSE_NOT_PLAN_ELIGIBLE") {
      localizedMessage = "Liệu trình hiện không ở trạng thái có thể chỉnh sửa kế hoạch.";
    } else if (res?.error_code === "UNAUTHORIZED_DOCTOR") {
      localizedMessage = "Chỉ Bác sĩ có tài khoản tại cơ sở này mới có quyền lưu kế hoạch điều trị.";
    }

    throw new Error(localizedMessage);
  }

  return {
    success: true,
    plan_id: res.plan_id!,
    treatment_course_id: res.treatment_course_id!,
    session_number: res.session_number!,
    service_count: res.service_count!,
    planned_by_doctor_id: res.planned_by_doctor_id!,
    message: res.message || "Lưu kế hoạch buổi điều trị thành công.",
  };
}
