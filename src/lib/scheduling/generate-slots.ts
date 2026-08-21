/**
 * Slot Generation Engine
 * Generates clinic time slots using configurable interval (default 5 min),
 * open/close hours, and lunch break exclusions.
 */

export interface SlotConfig {
  intervalMinutes?: number; // default 5
  openTime?: string; // "07:00"
  closeTime?: string; // "17:00"
  lunchStart?: string; // "11:30"
  lunchEnd?: string; // "13:00"
}

export function generateDailyTimeSlots(config?: SlotConfig): string[] {
  const interval = config?.intervalMinutes ?? 5;
  const openTime = config?.openTime ?? "07:00";
  const closeTime = config?.closeTime ?? "17:00";
  const lunchStart = config?.lunchStart ?? "11:30";
  const lunchEnd = config?.lunchEnd ?? "13:00";

  const openMins = timeToMinutes(openTime);
  const closeMins = timeToMinutes(closeTime);
  const lunchStartMins = timeToMinutes(lunchStart);
  const lunchEndMins = timeToMinutes(lunchEnd);

  const slots: string[] = [];

  for (let mins = openMins; mins <= closeMins; mins += interval) {
    // Skip slots falling inside lunch break
    if (mins >= lunchStartMins && mins < lunchEndMins) {
      continue;
    }
    slots.push(minutesToTime(mins));
  }

  return slots;
}

export function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
