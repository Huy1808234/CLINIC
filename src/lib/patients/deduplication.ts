import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { DeduplicationMatchResult, Patient } from "@/types/patient";
import type { NormalizedPatientPayload } from "./normalizers";

/**
 * Deduplication Engine
 * Priority matching rules:
 * 1. Exact BHYT Card Number
 * 2. Exact CCCD / Citizen ID
 * 3. Phone + DOB / Year + Normalized Name
 * 4. Normalized Name + DOB / Year + Address
 * 5. Ambiguous match -> requires_merge_review
 */
export async function matchPatientCandidate(
  supabase: SupabaseClient<Database>,
  payload: NormalizedPatientPayload,
  address?: string | null
): Promise<DeduplicationMatchResult> {
  const matchReasons: string[] = [];

  // 1. Priority 1: Exact BHYT Match
  if (payload.card_number) {
    const { data: insuranceMatch } = await supabase
      .from("patient_insurance_cards")
      .select("patient_id, card_number")
      .eq("card_number", payload.card_number)
      .limit(1)
      .maybeSingle();

    if (insuranceMatch) {
      const { data: matchedPatient } = await supabase
        .from("patients")
        .select("*")
        .eq("id", insuranceMatch.patient_id)
        .maybeSingle();

      matchReasons.push(`Trùng khớp chính xác thẻ BHYT (${payload.card_number})`);
      return {
        matched_patient_id: insuranceMatch.patient_id,
        priority: "EXACT_BHYT",
        confidence_score: 1.0,
        requires_merge_review: false,
        match_reasons: matchReasons,
        existing_patient: (matchedPatient as unknown as Patient) || null,
      };
    }
  }

  // 2. Priority 2: Exact CCCD Match
  if (payload.citizen_id) {
    const { data: cccdMatch } = await supabase
      .from("patients")
      .select("*")
      .eq("citizen_id", payload.citizen_id)
      .limit(1)
      .maybeSingle();

    if (cccdMatch) {
      matchReasons.push(`Trùng khớp chính xác CCCD/CMND (${payload.citizen_id})`);
      return {
        matched_patient_id: cccdMatch.id,
        priority: "EXACT_CCCD",
        confidence_score: 0.98,
        requires_merge_review: false,
        match_reasons: matchReasons,
        existing_patient: cccdMatch as unknown as Patient,
      };
    }
  }

  // 3. Priority 3: Phone + (DOB or Year) + Name Match
  if (payload.phone) {
    let query = supabase
      .from("patients")
      .select("*")
      .eq("phone", payload.phone);

    if (payload.birth_year) {
      query = query.eq("birth_year", payload.birth_year);
    }

    const { data: phoneMatches } = await query;

    if (phoneMatches && phoneMatches.length > 0) {
      const typedMatches = phoneMatches as unknown as Patient[];
      // Compare normalized name
      const exactNameMatch = typedMatches.find(
        (p) => p.normalized_name === payload.normalized_name
      );

      if (exactNameMatch) {
        matchReasons.push(`Trùng khớp SĐT (${payload.phone}), năm sinh (${payload.birth_year}) và họ tên`);
        return {
          matched_patient_id: exactNameMatch.id,
          priority: "PHONE_DOB_NAME",
          confidence_score: 0.95,
          requires_merge_review: false,
          match_reasons: matchReasons,
          existing_patient: exactNameMatch,
        };
      } else {
        // Same phone & birth year but slightly different name spelling
        matchReasons.push(`Trùng khớp SĐT (${payload.phone}) và năm sinh nhưng họ tên khác biệt`);
        return {
          matched_patient_id: typedMatches[0].id,
          priority: "PHONE_DOB_NAME",
          confidence_score: 0.75,
          requires_merge_review: true,
          match_reasons: matchReasons,
          existing_patient: typedMatches[0],
        };
      }
    }
  }

  // 4. Priority 4: Name + (DOB or Year) + Address check
  if (payload.normalized_name && (payload.birth_date || payload.birth_year)) {
    let nameQuery = supabase
      .from("patients")
      .select("*")
      .eq("normalized_name", payload.normalized_name);

    if (payload.birth_date) {
      nameQuery = nameQuery.eq("birth_date", payload.birth_date);
    } else if (payload.birth_year) {
      nameQuery = nameQuery.eq("birth_year", payload.birth_year);
    }

    const { data: nameDobMatches } = await nameQuery;

    if (nameDobMatches && nameDobMatches.length > 0) {
      const typedMatches = nameDobMatches as unknown as Patient[];
      const match = typedMatches[0];
      const addressSimilarity = checkAddressSimilarity(match.address, address);

      if (addressSimilarity) {
        matchReasons.push("Trùng khớp họ tên, ngày/năm sinh và địa chỉ tương đồng");
        return {
          matched_patient_id: match.id,
          priority: "NAME_DOB_ADDRESS",
          confidence_score: 0.85,
          requires_merge_review: true,
          match_reasons: matchReasons,
          existing_patient: match,
        };
      } else {
        matchReasons.push("Trùng khớp họ tên và ngày/năm sinh nhưng địa chỉ khác biệt");
        return {
          matched_patient_id: match.id,
          priority: "FUZZY_NAME",
          confidence_score: 0.65,
          requires_merge_review: true,
          match_reasons: matchReasons,
          existing_patient: match,
        };
      }
    }
  }

  return {
    matched_patient_id: null,
    priority: "NO_MATCH",
    confidence_score: 0,
    requires_merge_review: false,
    match_reasons: [],
    existing_patient: null,
  };
}

function checkAddressSimilarity(addr1?: string | null, addr2?: string | null): boolean {
  if (!addr1 || !addr2) return false;
  const a1 = addr1.toLowerCase().trim();
  const a2 = addr2.toLowerCase().trim();
  if (a1 === a2) return true;
  if (a1.includes(a2) || a2.includes(a1)) return true;
  return false;
}
