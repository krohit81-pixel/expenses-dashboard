/**
 * Flattens the static Ahaana/Rohana school calendars (grouped by month
 * heading, as written for a chronological list) into a flat list with
 * real ISO date ranges, so the Travel-in-Calendar month grid and the
 * merged detailed list (v1.0) can place them alongside booked trips.
 * Pure and synchronous — this is derived entirely from in-code data, no
 * database involved — so it's computed once in the Calendar Server
 * Component and passed down as a prop, not recomputed per render.
 */

import {
  AHAANA_CALENDAR,
  ROHANA_CALENDAR,
  type EventTag,
  type MonthGroup,
} from "@/features/calendar/data";
import { resolveSchoolEventRange } from "@/lib/dates/school-calendar";

export type SchoolPerson = "ahaana" | "rohana";

export interface SchoolCalendarItem {
  person: SchoolPerson;
  title: string;
  meta?: string;
  tag: EventTag;
  startDate: string;
  endDate: string;
}

function flatten(
  calendar: MonthGroup[],
  person: SchoolPerson,
): SchoolCalendarItem[] {
  return calendar.flatMap((group) =>
    group.events.map((event) => {
      const { startDate, endDate } = resolveSchoolEventRange(
        event.date,
        group.month,
      );
      return {
        person,
        title: event.title,
        meta: event.meta,
        tag: event.tag,
        startDate,
        endDate,
      };
    }),
  );
}

export function buildSchoolCalendarItems(): SchoolCalendarItem[] {
  return [
    ...flatten(AHAANA_CALENDAR, "ahaana"),
    ...flatten(ROHANA_CALENDAR, "rohana"),
  ];
}
