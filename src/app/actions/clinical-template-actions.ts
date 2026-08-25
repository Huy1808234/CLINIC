"use server";

import { createAdminClient } from "@/supabase-clients/admin";
import { requireApplicationAccessContext } from "@/lib/auth/application-access";
import { getClinicalTemplateSuggestion } from "@/lib/clinical/template-suggestion-service";
import type { TemplateSuggestionResolution } from "@/types/clinical-template";

export interface GetClinicalTemplateSuggestionActionInput {
  diagnosis_id: string;
  treatment_course_id?: string;
  business_date?: string;
}

/**
 * Server Action: Queries the applicable TT06 Clinical Diagnosis Template for a primary diagnosis.
 *
 * Security:
 * 1. Enforces authenticated Auth User + Active Staff + Verified Active Clinic.
 * 2. Organization ID derived exclusively from verified active clinic context.
 * 3. Course ownership strictly verified against caller's active clinic if provided.
 */
export async function getClinicalTemplateSuggestionAction(
  input: GetClinicalTemplateSuggestionActionInput
): Promise<TemplateSuggestionResolution> {
  try {
    const accessContext = await requireApplicationAccessContext();
    const activeClinicId = accessContext.clinic.clinic_id;
    const organizationId = accessContext.clinic.organization_id;

    const supabase = createAdminClient();

    return await getClinicalTemplateSuggestion(supabase, {
      diagnosisId: input.diagnosis_id,
      organizationId,
      activeClinicId,
      treatmentCourseId: input.treatment_course_id,
      businessDate: input.business_date,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Lỗi xác thực quyền truy cập.";
    return {
      success: false,
      found: false,
      reason: "UNAUTHORIZED",
      error: errorMsg,
    };
  }
}
