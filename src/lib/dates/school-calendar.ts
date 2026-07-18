/**
 * Resolves the static Ahaana/Rohana school-calendar data
 * (src/features/calendar/data.ts) into real ISO date ranges, so it can be
 * placed on the same month grid as booked trips (v1.0, Travel-in-Calendar).
 *
 * That data was written for a chronological list (grouped under a "July
 * 2026" heading, a single `date` field like "9" or a range like "6–17"),
 * never for a grid — this is the one place that gap gets bridged. The
 * source data itself is untouched; this only reads it.
 */

export const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/** "July 2026" -> { monthIndex: 6, year: 2026 }. Throws on an unrecognized shape rather than silently misplacing a school event. */
export function parseMonthHeading(heading: string): {
  monthIndex: number;
  year: number;
} {
  const [name, yearText] = heading.trim().split(/\s+/);
  const monthIndex = MONTH_INDEX[name?.slice(0, 3).toLowerCase() ?? ""];
  const year = Number(yearText);
  if (monthIndex === undefined || !Number.isFinite(year)) {
    throw new Error(`Unrecognized month heading: "${heading}"`);
  }
  return { monthIndex, year };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * A calendar-data `date` field ("9", "6–17", "23–3") plus the month
 * heading it was grouped under -> a resolved ISO range.
 *
 * When the end day is smaller than the start day (e.g. Ahaana's "23–3"
 * under "December 2026" — Winter Vacations run Dec 23 to Jan 3), the end
 * date rolls into the next month/year. This is the only wraparound case
 * in the current data, but the logic isn't special-cased to it — any
 * "end < start" range rolls forward one month, which is the only sane
 * reading of a day-range string that doesn't repeat the month name.
 */
export function resolveSchoolEventRange(
  dateField: string,
  heading: string,
): { startDate: string; endDate: string } {
  const { monthIndex, year } = parseMonthHeading(heading);
  const parts = dateField.split(/[–—-]/).map((s) => s.trim());

  if (parts.length === 2) {
    const startDay = Number(parts[0]);
    const endDay = Number(parts[1]);
    const start = new Date(Date.UTC(year, monthIndex, startDay));
    const end =
      endDay < startDay
        ? new Date(Date.UTC(year, monthIndex + 1, endDay))
        : new Date(Date.UTC(year, monthIndex, endDay));
    return {
      startDate: `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-${pad(start.getUTCDate())}`,
      endDate: `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}`,
    };
  }

  const day = Number(dateField);
  const iso = `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
  return { startDate: iso, endDate: iso };
}
