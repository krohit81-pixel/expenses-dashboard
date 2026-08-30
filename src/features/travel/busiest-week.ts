/**
 * "Who's busiest this week" (v3.6.3) — a household request to surface,
 * right at the top of the public Calendar tab (above Monthly Schedule
 * and This Week's Schedule), which family member has the most going on
 * in the current Monday–Sunday week. Counts every item tagged to one of
 * the four known household members (see travelers.ts) across all four
 * calendar sources — school items, trips, manual events, recurring
 * class occurrences — the same sources TripDetailedList already merges
 * (see detailed-list.ts), just re-flattened here into a much smaller
 * shape (title/people/date range) since this only needs to count and
 * name-check, not render a full row.
 *
 * Deliberately ignores the page's own Ahaana/Rohana/Travel/Rohit/
 * Aradhana visibility filters — this is a household-wide summary, not
 * scoped to whatever the reader currently has toggled on.
 */

import { getWeekDates, shiftDate } from "@/lib/dates/calendar-grid";
import { knownTravelers } from "@/features/travel/travelers";
import type {
  SchoolCalendarItem,
  SchoolPerson,
} from "@/features/travel/school-items";
import type { CalendarEvent } from "@/services/CalendarEventService";
import type { Trip } from "@/services/TripService";
import type { RecurringOccurrence } from "@/lib/dates/recurring-calendar-events";

/**
 * The Monday-start week to show as "the week ahead" — the current week
 * (Mon–Sun containing `todayISO`) every day except Sunday, when that
 * week is already nearly over (only today itself left) and "ahead"
 * instead means the week starting tomorrow. A deliberate household
 * call (v3.6.3): on every day but Sunday this matches This Week's
 * Schedule's own `getWeekDates(todayISODate())` exactly; on Sunday the
 * two diverge on purpose, since "which family member has a busy week
 * ahead" read as stale showing a week that's already six-sevenths
 * over.
 */
export function weekAheadRange(todayISO: string): {
  weekStart: string;
  weekEnd: string;
} {
  const isSunday = new Date(`${todayISO}T00:00:00Z`).getUTCDay() === 0;
  const referenceDate = isSunday ? shiftDate(todayISO, 1) : todayISO;
  const [weekStart, , , , , , weekEnd] = getWeekDates(referenceDate);
  return { weekStart, weekEnd };
}

const SCHOOL_PERSON_NAME: Record<SchoolPerson, string> = {
  ahaana: "Ahaana",
  rohana: "Rohana",
};

interface WeekItem {
  title: string;
  people: string[];
  startDate: string;
  endDate: string;
}

export interface BusiestPersonRow {
  name: string;
  count: number;
  /** Titles of every item counted toward this person, in no particular order — used for the "why" list under the busiest person's row. */
  titles: string[];
}

export interface BusiestWeekSummary {
  weekStart: string;
  weekEnd: string;
  /** One row per known household member (travelers.ts), always four, sorted busiest-first (ties broken alphabetically). */
  rows: BusiestPersonRow[];
  /** Every name tied for the top NON-ZERO count — empty when nobody has anything this week. */
  busiestNames: string[];
}

function overlapsWeek(
  item: WeekItem,
  weekStart: string,
  weekEnd: string,
): boolean {
  return item.startDate <= weekEnd && item.endDate >= weekStart;
}

export function buildBusiestWeekSummary(
  trips: Trip[],
  schoolItems: SchoolCalendarItem[],
  calendarEvents: CalendarEvent[],
  recurringOccurrences: RecurringOccurrence[],
  weekStart: string,
  weekEnd: string,
): BusiestWeekSummary {
  const items: WeekItem[] = [
    ...schoolItems.map((item) => ({
      title: item.title,
      people: [SCHOOL_PERSON_NAME[item.person]],
      startDate: item.startDate,
      endDate: item.endDate,
    })),
    ...trips.map((trip) => ({
      title: trip.destination,
      people: trip.travelerNames,
      startDate: trip.startDate,
      endDate: trip.endDate,
    })),
    ...calendarEvents.map((event) => ({
      title: event.title,
      people: event.people,
      startDate: event.startDate,
      endDate: event.endDate,
    })),
    ...recurringOccurrences.map((occurrence) => ({
      title: occurrence.title,
      people: occurrence.people,
      startDate: occurrence.date,
      endDate: occurrence.date,
    })),
  ].filter((item) => overlapsWeek(item, weekStart, weekEnd));

  const byName = new Map<string, { count: number; titles: string[] }>();
  for (const name of knownTravelers())
    byName.set(name, { count: 0, titles: [] });

  for (const item of items) {
    for (const name of item.people) {
      const entry = byName.get(name);
      // Only the four known household members are ranked here -- a
      // custom/one-off name typed into a manual event's people field
      // (arbitrary text, see zEventPeople) isn't a household member
      // this summary tracks.
      if (!entry) continue;
      entry.count += 1;
      entry.titles.push(item.title);
    }
  }

  const rows: BusiestPersonRow[] = Array.from(byName.entries())
    .map(([name, { count, titles }]) => ({ name, count, titles }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const topCount = rows[0]?.count ?? 0;
  const busiestNames =
    topCount > 0
      ? rows.filter((r) => r.count === topCount).map((r) => r.name)
      : [];

  return { weekStart, weekEnd, rows, busiestNames };
}

/** A one-line, always-grammatical headline for the summary card — handles a single busiest person, a tie between several, and the "nobody has anything" week. */
export function describeBusiestWeek(summary: BusiestWeekSummary): string {
  const { busiestNames, rows } = summary;
  if (busiestNames.length === 0) {
    return "A quiet week ahead — nothing stacking up for anyone yet.";
  }

  const topRow = rows.find((r) => r.name === busiestNames[0])!;
  const names =
    busiestNames.length === 1
      ? busiestNames[0]
      : busiestNames.length === 2
        ? busiestNames.join(" and ")
        : `${busiestNames.slice(0, -1).join(", ")}, and ${busiestNames[busiestNames.length - 1]}`;
  const verb = busiestNames.length === 1 ? "has" : "have";
  const count = topRow.count;

  return `${names} ${verb} the busiest week ahead — ${count} thing${count === 1 ? "" : "s"} on the calendar.`;
}
