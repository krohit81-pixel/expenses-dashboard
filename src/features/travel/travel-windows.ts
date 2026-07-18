/**
 * Merges Ahaana's and Rohana's "good windows for travel" (static data,
 * src/features/calendar/data.ts) into one chronological list for the
 * Travel-in-Calendar page (v1.0). Pure — sorted by the first date found
 * in each window's free-text `range` string, since that's the only date
 * information the source data has for these (no ISO fields, unlike the
 * per-month calendar events).
 */

import {
  AHAANA_TRAVEL_WINDOWS,
  ROHANA_TRAVEL_WINDOWS,
  type TravelWindow,
} from "@/features/calendar/data";
import { MONTH_INDEX } from "@/lib/dates/school-calendar";
import type { SchoolPerson } from "@/features/travel/school-items";

export interface PersonTravelWindow extends TravelWindow {
  person: SchoolPerson;
}

const DATE_IN_TEXT =
  /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i;

function firstDateTimestamp(range: string): number {
  const match = range.match(DATE_IN_TEXT);
  if (!match) return Infinity;
  const monthIndex = MONTH_INDEX[match[2].slice(0, 3).toLowerCase()];
  if (monthIndex === undefined) return Infinity;
  return Date.UTC(Number(match[3]), monthIndex, Number(match[1]));
}

export function buildTravelWindows(): PersonTravelWindow[] {
  const merged: PersonTravelWindow[] = [
    ...AHAANA_TRAVEL_WINDOWS.map((w) => ({ ...w, person: "ahaana" as const })),
    ...ROHANA_TRAVEL_WINDOWS.map((w) => ({ ...w, person: "rohana" as const })),
  ];
  return merged.sort(
    (a, b) => firstDateTimestamp(a.range) - firstDateTimestamp(b.range),
  );
}
