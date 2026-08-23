/**
 * Expands Ahaana's recurring activities (finance.ahaana_activities)
 * into concrete dated occurrences within a range — pure and
 * synchronous, a near-identical sibling of
 * expandRecurringOccurrences (lib/dates/recurring-calendar-events.ts).
 * Kept as its own function rather than generalizing that one: the two
 * tables happen to share a shape today (weekly-recurring rule, bounded
 * start/end date) but are genuinely different domains — the family
 * calendar's recurring events vs. her own mini app — with no reason to
 * stay coupled if either evolves separately later (e.g. her activities
 * gaining a completion-log join the family calendar has no use for).
 */

import type { AhaanaActivity } from "@/services/AhaanaActivityService";
import { todayISODate } from "@/lib/dates/calendar-grid";

/**
 * v3.4.8 — the 7 dates (Sunday–Saturday) of the week containing
 * `referenceDateISO` (defaults to today, IST). Deliberately its own
 * Sunday-start helper rather than reusing `calendar-grid.ts`'s
 * Monday-start `getWeekDates` — Ahaana's own request was specifically
 * "new week starts at Sunday" for her Dashboard tab, which is a
 * genuinely different convention from the household calendar's own
 * Monday-start week (used elsewhere in this app, including the
 * parent-facing weekly report/progress page — those stay Monday-start
 * on purpose, this is scoped to her own view only). Same UTC-based,
 * shift-proof math as `getWeekDates`, just anchored on Sunday
 * (`getUTCDay()` is already 0 for Sunday, so no offset adjustment is
 * needed the way Monday-start needs `(day + 6) % 7`).
 */
export function getAhaanaWeekDates(referenceDateISO?: string): string[] {
  const ref = referenceDateISO
    ? new Date(`${referenceDateISO}T00:00:00Z`)
    : new Date(`${todayISODate()}T00:00:00Z`);
  const daysSinceSunday = ref.getUTCDay();
  const sunday = new Date(ref);
  sunday.setUTCDate(ref.getUTCDate() - daysSinceSunday);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setUTCDate(sunday.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export interface AhaanaOccurrence {
  key: string;
  activityId: string;
  title: string;
  category: AhaanaActivity["category"];
  date: string;
  startTime: string;
  endTime: string;
  planNotes: string | null;
}

/** Whole days from `a` to `b` (both "YYYY-MM-DD"), UTC-based — only ever called here with `b >= a`, so always >= 0. */
function daysBetween(a: string, b: string): number {
  const from = new Date(`${a}T00:00:00Z`).getTime();
  const to = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

/**
 * v3.4.10 — true if `dateISO` falls on a "kept" week for an
 * `alternateWeeks` activity: the 7-day block containing its own
 * `startDate` counts as week 0 (kept), the next 7-day block is week 1
 * (skipped), and so on — `Math.floor(daysBetween(...) / 7) % 2 === 0`.
 * Deliberately counts whole weeks *since the activity's own anchor
 * date*, not calendar-week-grid boundaries (Sunday-start or
 * Monday-start) — that anchor is what the household's own use case
 * relies on: two separate activities (e.g. History and Geography),
 * each `alternateWeeks`, with `startDate`s a week apart, naturally
 * interleave without either activity needing to know about the other.
 */
function isOnKeptWeek(activity: AhaanaActivity, dateISO: string): boolean {
  if (!activity.alternateWeeks) return true;
  const weeksSinceStart = Math.floor(
    daysBetween(activity.startDate, dateISO) / 7,
  );
  return weeksSinceStart % 2 === 0;
}

/**
 * One occurrence per date in [rangeStart, rangeEnd] (inclusive) whose
 * weekday is in the activity's daysOfWeek AND falls within the
 * activity's own [startDate, endDate] — same intersection logic as
 * expandRecurringOccurrences. Only `active` activities are ever passed
 * in by callers (this function doesn't filter on `active` itself,
 * same "caller decides what set of rows to expand" separation the
 * sibling function uses). v3.4.10 also skips a date that falls on a
 * "skipped" week for an `alternateWeeks` activity — see `isOnKeptWeek`.
 */
export function expandAhaanaOccurrences(
  activities: AhaanaActivity[],
  rangeStart: string,
  rangeEnd: string,
): AhaanaOccurrence[] {
  const occurrences: AhaanaOccurrence[] = [];

  for (const activity of activities) {
    const from =
      activity.startDate > rangeStart ? activity.startDate : rangeStart;
    const to = activity.endDate < rangeEnd ? activity.endDate : rangeEnd;
    if (from > to) continue;

    const cursor = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    while (cursor <= end) {
      const dateISO = cursor.toISOString().slice(0, 10);
      if (
        activity.daysOfWeek.includes(cursor.getUTCDay()) &&
        isOnKeptWeek(activity, dateISO)
      ) {
        occurrences.push({
          key: `${activity.id}-${dateISO}`,
          activityId: activity.id,
          title: activity.title,
          category: activity.category,
          date: dateISO,
          startTime: activity.startTime,
          endTime: activity.endTime,
          planNotes: activity.planNotes,
        });
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  occurrences.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.startTime.localeCompare(b.startTime) ||
      a.key.localeCompare(b.key),
  );

  return occurrences;
}
