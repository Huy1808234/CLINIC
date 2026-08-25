import "server-only";
import { createClient } from "@/supabase-clients/server";
import { getActiveClinicContext } from "@/lib/auth/clinic-context";
import { DEFAULT_CLINIC_TIMEZONE } from "@/utils/timezone";
import type { AvailableSlotItem } from "@/types/schedule";
import { generateDailyTimeSlots, minutesToTime, timeToMinutes } from "@/lib/scheduling/generate-slots";
import { calculateSlotScore } from "@/lib/scheduling/slot-scoring";
import { formatTimestampTime } from "@/utils/format-time";

export async function getAvailableSlotsForDoctor(params: {
  doctorId: string;
  dateStr: string; // YYYY-MM-DD
  preferredTime?: string | null;
}): Promise<AvailableSlotItem[]> {
  const supabase = await createClient();
  const clinicContext = await getActiveClinicContext();
  const clinicTimezone = clinicContext?.timezone || DEFAULT_CLINIC_TIMEZONE;

  // 1. Fetch appointments for this doctor on this date
  const { data: existingAppts } = await supabase
    .from("appointments")
    .select("scheduled_start_at")
    .eq("doctor_id", params.doctorId)
    .eq("appointment_date", params.dateStr)
    .neq("status", "CANCELLED");

  const bookedSlots = new Set<string>();
  for (const a of existingAppts || []) {
    if (a.scheduled_start_at) {
      const localTimeStr = formatTimestampTime(a.scheduled_start_at, clinicTimezone);
      if (localTimeStr && localTimeStr !== "—") {
        bookedSlots.add(localTimeStr);
      }
    }
  }

  // 2. Generate all candidate slots in clinic wall-clock time
  const allSlots = generateDailyTimeSlots({
    openTime: "07:00",
    closeTime: "17:00",
    intervalMinutes: 5,
  });

  return allSlots.map((slotTime) => {
    const isBooked = bookedSlots.has(slotTime);
    const endMinutes = timeToMinutes(slotTime) + 80; // Standard 80-minute pipeline
    const endTime = minutesToTime(endMinutes);

    const score = calculateSlotScore({
      slotTime,
      preferredTime: params.preferredTime,
      currentDoctorLoad: bookedSlots.size,
      maxDoctorLoad: 64,
    });

    return {
      start_time: slotTime,
      end_time: endTime,
      doctor_id: params.doctorId,
      is_available: !isBooked,
      score: isBooked ? 0 : score,
      reason: isBooked ? "Bác sĩ đã có lịch tại thời điểm này" : undefined,
    };
  });
}
