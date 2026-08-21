import { timeToMinutes } from "./generate-slots";

export interface SlotScoringCriteria {
  slotTime: string; // "07:34"
  preferredTime?: string | null; // "07:30"
  currentDoctorLoad?: number; // number of appointments already assigned
  maxDoctorLoad?: number; // default 64
}

/**
 * Calculates a score from 0 to 100 for a candidate appointment slot
 */
export function calculateSlotScore(criteria: SlotScoringCriteria): number {
  let score = 100;

  // 1. Proximity to preferred time
  if (criteria.preferredTime) {
    const slotMins = timeToMinutes(criteria.slotTime);
    const prefMins = timeToMinutes(criteria.preferredTime);
    const diffMins = Math.abs(slotMins - prefMins);

    // Deduct 2 points for every 5 minutes difference
    const diffPenalty = Math.min(60, (diffMins / 5) * 2);
    score -= diffPenalty;
  }

  // 2. Doctor load balance penalty
  if (criteria.currentDoctorLoad !== undefined && criteria.maxDoctorLoad) {
    const loadRatio = criteria.currentDoctorLoad / criteria.maxDoctorLoad;
    if (loadRatio > 0.8) {
      score -= 20;
    } else if (loadRatio > 0.6) {
      score -= 10;
    }
  }

  return Math.max(0, Math.round(score));
}
