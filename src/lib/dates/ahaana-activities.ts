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

/**
 * One occurrence per date in [rangeStart, rangeEnd] (inclusive) whose
 * weekday is in the activity's daysOfWeek AND falls within the
 * activity's own [startDate, endDate] — same intersection logic as
 * expandRecurringOccurrences. Only `active` activities are ever passed
 * in by callers (this function doesn't filter on `active` itself,
 * same "caller decides what set of rows to expand" separation the
 * sibling function uses).
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
      if (activity.daysOfWeek.includes(cursor.getUTCDay())) {
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
