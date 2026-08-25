export interface TemplateCycleCodingSummary {
  cycle_number: number;
  diagnosis_id: string;
  diagnosis_code: string;
  diagnosis_name: string;
}

export interface SuggestedTemplateItemSummary {
  item_id: string;
  service_id: string;
  service_code: string;
  service_name: string;
  sequence_no: number;
  indication_notes: string | null;
  is_available: boolean;
  already_ordered: boolean;
  cycles: TemplateCycleCodingSummary[];
}

export interface ClinicalTemplateSuggestion {
  id: string;
  source_regulation: string;
  effective_from: string;
  effective_to: string | null;
  items: SuggestedTemplateItemSummary[];
}

export type TemplateSuggestionResolution =
  | {
      success: true;
      found: true;
      template: ClinicalTemplateSuggestion;
    }
  | {
      success: true;
      found: false;
      reason: "NO_TEMPLATE";
      message: string;
    }
  | {
      success: false;
      found: false;
      reason: "CLINICAL_TEMPLATE_VERSION_CONFLICT" | "UNAUTHORIZED" | "INVALID_COURSE";
      error: string;
    };
