import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { TemplateSuggestionResolution, SuggestedTemplateItemSummary } from "@/types/clinical-template";

export interface GetClinicalTemplateSuggestionParams {
  diagnosisId: string;
  organizationId: string;
  activeClinicId: string;
  treatmentCourseId?: string;
  businessDate?: string;
}

/**
 * Resolves the applicable TT06 Clinical Diagnosis Template for a primary diagnosis.
 *
 * Domain Rules:
 * 1. Strictly scoped to the clinic's organization (`organizationId`).
 * 2. Effective date evaluated: `is_active = true AND effective_from <= businessDate AND (effective_to IS NULL OR effective_to >= businessDate)`.
 * 3. Exact matching: exactly 1 active template version allowed. >1 versions trigger `CLINICAL_TEMPLATE_VERSION_CONFLICT`.
 * 4. Checks active clinic service availability and pre-existing course service orders.
 */
export async function getClinicalTemplateSuggestion(
  supabase: SupabaseClient<Database>,
  params: GetClinicalTemplateSuggestionParams
): Promise<TemplateSuggestionResolution> {
  const {
    diagnosisId,
    organizationId,
    activeClinicId,
    treatmentCourseId,
  } = params;

  if (!diagnosisId) {
    return {
      success: true,
      found: false,
      reason: "NO_TEMPLATE",
      message: "Chưa chọn chẩn đoán chính.",
    };
  }

  // 1. Resolve business date (Format: YYYY-MM-DD in Asia/Ho_Chi_Minh)
  let businessDate = params.businessDate;
  const existingServiceIds = new Set<string>();

  if (treatmentCourseId) {
    const { data: course, error: courseErr } = await supabase
      .from("treatment_courses")
      .select("id, clinic_id, created_at, planned_at")
      .eq("id", treatmentCourseId)
      .maybeSingle();

    if (courseErr || !course || course.clinic_id !== activeClinicId) {
      return {
        success: false,
        found: false,
        reason: "INVALID_COURSE",
        error: "Liệu trình không thuộc cơ sở đang hoạt động.",
      };
    }

    if (!businessDate) {
      const rawDate = course.planned_at || course.created_at || new Date().toISOString();
      businessDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(rawDate));
    }

    // Query existing service orders on course
    const { data: existingOrders } = await supabase
      .from("course_service_orders")
      .select("service_id, is_active")
      .eq("treatment_course_id", treatmentCourseId)
      .eq("is_active", true);

    if (existingOrders) {
      for (const ord of existingOrders) {
        existingServiceIds.add(ord.service_id);
      }
    }
  }

  if (!businessDate) {
    businessDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }

  // 2. Query clinical templates for (organization_id, diagnosis_id, is_active=true)
  const { data: matchedTemplates, error: tplErr } = await supabase
    .from("clinical_diagnosis_templates")
    .select("id, organization_id, diagnosis_id, source_regulation, source_version, effective_from, effective_to, is_active")
    .eq("organization_id", organizationId)
    .eq("diagnosis_id", diagnosisId)
    .eq("is_active", true)
    .lte("effective_from", businessDate);

  if (tplErr) {
    return {
      success: false,
      found: false,
      reason: "CLINICAL_TEMPLATE_VERSION_CONFLICT",
      error: `Lỗi truy vấn mẫu điều trị: ${tplErr.message}`,
    };
  }

  const activeTemplates = (matchedTemplates || []).filter(
    (t) => !t.effective_to || t.effective_to >= businessDate
  );

  if (activeTemplates.length === 0) {
    return {
      success: true,
      found: false,
      reason: "NO_TEMPLATE",
      message: "Chưa có gợi ý DVKT theo TT06 cho mã bệnh này.",
    };
  }

  if (activeTemplates.length > 1) {
    return {
      success: false,
      found: false,
      reason: "CLINICAL_TEMPLATE_VERSION_CONFLICT",
      error: "Không thể xác định phiên bản mẫu điều trị (xung đột phiên bản hiệu lực).",
    };
  }

  const template = activeTemplates[0];

  // 3. Fetch template items and cycle codings
  // Note: We use any here for typing the complex Supabase nested join safely
  const { data: rawItems, error: itemsErr } = await supabase
    .from("clinical_diagnosis_template_items")
    .select(`
      id,
      template_id,
      service_id,
      sequence_no,
      indication_notes,
      is_active,
      service_catalog (
        id,
        service_code,
        service_name,
        is_active
      ),
      clinical_template_cycle_codings (
        id,
        cycle_number,
        diagnosis_id,
        diagnosis_catalog (
          id,
          code,
          name
        )
      )
    `)
    .eq("template_id", template.id)
    .eq("is_active", true)
    .order("sequence_no", { ascending: true });

  if (itemsErr) {
    return {
      success: false,
      found: false,
      reason: "CLINICAL_TEMPLATE_VERSION_CONFLICT",
      error: `Lỗi truy vấn dịch vụ theo mẫu: ${itemsErr.message}`,
    };
  }

  // 4. Format items
  type RawJoinedItem = {
    id: string;
    template_id: string;
    service_id: string;
    sequence_no: number;
    indication_notes: string | null;
    is_active: boolean;
    service_catalog: {
      id: string;
      service_code: string;
      service_name: string;
      is_active: boolean;
    } | null;
    clinical_template_cycle_codings: Array<{
      id: string;
      cycle_number: number;
      diagnosis_id: string;
      diagnosis_catalog: {
        id: string;
        code: string;
        name: string;
      } | null;
    }> | null;
  };

  const formattedItems: SuggestedTemplateItemSummary[] = ((rawItems || []) as unknown as RawJoinedItem[]).map((it) => {
    const svc = it.service_catalog;
    const isAvailable = Boolean(svc && svc.is_active);
    const alreadyOrdered = svc ? existingServiceIds.has(svc.id) : false;

    const cycles = (it.clinical_template_cycle_codings || [])
      .sort((a, b) => a.cycle_number - b.cycle_number)
      .map((c) => ({
        cycle_number: c.cycle_number,
        diagnosis_id: c.diagnosis_id,
        diagnosis_code: c.diagnosis_catalog?.code || "",
        diagnosis_name: c.diagnosis_catalog?.name || "",
      }));

    return {
      item_id: it.id,
      service_id: it.service_id,
      service_code: svc?.service_code || "",
      service_name: svc?.service_name || "",
      sequence_no: it.sequence_no,
      indication_notes: it.indication_notes,
      is_available: isAvailable,
      already_ordered: alreadyOrdered,
      cycles,
    };
  });

  return {
    success: true,
    found: true,
    template: {
      id: template.id,
      source_regulation: template.source_regulation,
      effective_from: template.effective_from,
      effective_to: template.effective_to,
      items: formattedItems,
    },
  };
}
