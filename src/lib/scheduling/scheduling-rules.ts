/**
 * Treatment Dates Generator
 * Generates an array of sequential calendar dates respecting allowed weekdays and clinic operational schedule.
 */

export interface DateGenerationOptions {
  startDate: string; // YYYY-MM-DD
  sessionCount: number;
  allowedWeekdays?: number[]; // 1=Mon .. 6=Sat (Sunday=0 excluded by default)
  holidays?: string[]; // YYYY-MM-DD
}

export function generateTreatmentDates(options: DateGenerationOptions): string[] {
  const { startDate, sessionCount } = options;
  const allowedWeekdays = options.allowedWeekdays ?? [1, 2, 3, 4, 5, 6];
  const holidays = new Set(options.holidays ?? []);

  const dates: string[] = [];
  const curr = new Date(startDate);

  // Safety maximum search loop (up to 90 calendar days)
  let loopCount = 0;
  while (dates.length < sessionCount && loopCount < 90) {
    loopCount++;
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, "0");
    const dd = String(curr.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const dow = curr.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat

    // Check if day of week is allowed and not a holiday
    if (allowedWeekdays.includes(dow) && !holidays.has(dateStr)) {
      dates.push(dateStr);
    }

    // Advance 1 calendar day
    curr.setDate(curr.getDate() + 1);
  }

  return dates;
}
