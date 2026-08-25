import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { OrderCourseServicesParsed } from "@/lib/validation/clinical-schemas";

export interface OrderServicesResult {
  success: boolean;
  inserted_count: number;
  message?: string;
}

/**
 * Records doctor-ordered clinical services (DVKT THỰC TẾ) for a treatment course.
 *
 * Semantic Invariants:
 * 1. Represents COURSE-LEVEL doctor-ordered services (the overall bundle of prescribed DVKT).
 * 2. `sequence_no` (1..N) represents SERVICE ORDER SEQUENCE (i.e. position in the ordered list: 1st service, 2nd service, 3rd service).
 * 3. `sequence_no` is NOT a treatment session / occurrence number (Lần điều trị 1 / 2 / 3).
 * 4. Caller holds DOCTOR role at verified active clinic.
 * 5. Target Treatment Course belongs to the active clinic.
 * 6. Each service_id must exist in service_catalog and have is_active === true.
 * 7. Stamped with ordered_by_doctor_id = caller Doctor Staff ID.
 */
export async function orderCourseServices(
  supabase: SupabaseClient<Database>,
  input: OrderCourseServicesParsed,
  activeClinicId: string,
  doctorStaffId: string
): Promise<OrderServicesResult> {
  // 1. Verify target treatment course exists and belongs to active clinic
  const { data: course, error: courseErr } = await supabase
    .from("treatment_courses")
    .select("id, clinic_id, status")
    .eq("id", input.treatment_course_id)
    .maybeSingle();

  if (courseErr || !course || course.clinic_id !== activeClinicId) {
    throw new Error("Không tìm thấy liệu trình phù hợp tại cơ sở hiện tại.");
  }

  // 2. Verify all selected services exist and are active in service_catalog
  const { data: activeServices, error: servErr } = await supabase
    .from("service_catalog")
    .select("id, service_code, service_name, is_active")
    .in("id", input.service_ids)
    .eq("is_active", true);

  if (servErr || !activeServices || activeServices.length !== input.service_ids.length) {
    throw new Error("Một hoặc nhiều dịch vụ kỹ thuật đã chọn không tồn tại hoặc đã ngừng hoạt động.");
  }

  // 3. Query existing max sequence_no for this course to continue sequence numbering
  const { data: existingOrders } = await supabase
    .from("course_service_orders")
    .select("sequence_no")
    .eq("treatment_course_id", course.id)
    .order("sequence_no", { ascending: false })
    .limit(1);

  const startSeq = existingOrders && existingOrders.length > 0
    ? (existingOrders[0].sequence_no || 0)
    : 0;

  // 4. Prepare normalized insert rows
  const insertRows = input.service_ids.map((serviceId, idx) => ({
    treatment_course_id: course.id,
    service_id: serviceId,
    ordered_by_doctor_id: doctorStaffId,
    order_source: "DOCTOR_ACTUAL" as const,
    sequence_no: startSeq + idx + 1,
    notes: input.notes || null,
    is_active: true,
  }));

  const { error: insertErr } = await supabase
    .from("course_service_orders")
    .insert(insertRows);

  if (insertErr) {
    throw new Error(`Lỗi chỉ định dịch vụ kỹ thuật: ${insertErr.message}`);
  }

  // 5. Record Audit Log
  await supabase.from("audit_logs").insert({
    actor_user_id: null,
    action: "ORDER_COURSE_SERVICES",
    entity_type: "TREATMENT_COURSE",
    entity_id: course.id,
    after_data: {
      treatment_course_id: course.id,
      ordered_service_ids: input.service_ids,
      ordered_by_doctor_id: doctorStaffId,
    },
  });

  return {
    success: true,
    inserted_count: insertRows.length,
    message: `Đã chỉ định thành công ${insertRows.length} dịch vụ kỹ thuật.`,
  };
}
