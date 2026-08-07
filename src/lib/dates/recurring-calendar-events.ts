/**
 * Expands recurring calendar rules (finance.recurring_calendar_events)
 * into concrete dated occurrences within a range — pure and synchronous,
 * same reasoning as school-items.ts's flatten(): computed once from a
 * rule rather than stored per-date, so both the server (the full
 * detailed list / month grid, over each rule's own bounded range) and
 * the client (RecurringWeekGrid, over just the current week) can call
 * the same function.
 */

import type { RecurringCalendarEvent } from "@/services/RecurringCalendarEventService";

export interface RecurringOccurrence {
  key: string;
  ruleId: string;
  title: string;
  people: string[];
  mode: string | null;
  date: string;
  startTime: string;
  endTime: string;
  notes: string | null;
}

/**
 * One occurrence per date in [rangeStart, rangeEnd] (inclusive) whose
 * weekday is in the rule's daysOfWeek AND falls within the rule's own
 * [startDate, endDate] — the range passed in and the rule's own bound
 * are intersected, so a rule never produces an occurrence outside
 * either. Sorted by date, then start time, then rule id, for a stable
 * chronological order regardless of input order.
 */
export function expandRecurringOccurrences(
  rules: RecurringCalendarEvent[],
  rangeStart: string,
  rangeEnd: string,
): RecurringOccurrence[] {
  const occurrences: RecurringOccurrence[] = [];

  for (const rule of rules) {
    const from = rule.startDate > rangeStart ? rule.startDate : rangeStart;
    const to = rule.endDate < rangeEnd ? rule.endDate : rangeEnd;
    if (from > to) continue;

    const cursor = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    while (cursor <= end) {
      const dateISO = cursor.toISOString().slice(0, 10);
      if (rule.daysOfWeek.includes(cursor.getUTCDay())) {
        occurrences.push({
          key: `${rule.id}-${dateISO}`,
          ruleId: rule.id,
          title: rule.title,
          people: rule.people,
          mode: rule.mode,
          date: dateISO,
          startTime: rule.startTime,
          endTime: rule.endTime,
          notes: rule.notes,
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

const DAY_ABBREVIATIONS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Tue, Fri" — always Monday-first regardless of the stored (0=Sun-first)
 * order or click order in the day picker, matching every other
 * Monday-start grid on this page. Shared by RecurringEventsList and
 * AddRecurringEventModal's read-only summaries. */
export function formatDaysOfWeek(daysOfWeek: number[]): string {
  const mondayFirst = [1, 2, 3, 4, 5, 6, 0];
  return mondayFirst
    .filter((day) => daysOfWeek.includes(day))
    .map((day) => DAY_ABBREVIATIONS[day])
    .join(", ");
}

/** "8:00–9:30 AM" — one AM/PM suffix at the end, not per-time. Shared by
 * RecurringWeekGrid, TripDetailedList, and RecurringEventsList so a
 * class's time range always reads identically everywhere it appears. */
export function formatTimeRange(startTime: string, endTime: string): string {
  const fmt = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return m === 0 ? `${h12}` : `${h12}:${String(m).padStart(2, "0")}`;
  };
  const endHour = Number(endTime.split(":")[0]);
  const suffix = endHour < 12 ? "AM" : "PM";
  return `${fmt(startTime)}–${fmt(endTime)} ${suffix}`;
}

/**
 * The widest [start, end] range that covers every rule's own bound —
 * what the /calendar Server Component passes as rangeStart/rangeEnd so
 * the merged detailed list and month grid see every occurrence any rule
 * can ever produce, without expanding an artificial or indefinite
 * window. Returns null for an empty rule list (nothing to expand).
 */
export function widestRuleRange(
  rules: RecurringCalendarEvent[],
): { start: string; end: string } | null {
  if (rules.length === 0) return null;
  let start = rules[0].startDate;
  let end = rules[0].endDate;
  for (const rule of rules) {
    if (rule.startDate < start) start = rule.startDate;
    if (rule.endDate > end) end = rule.endDate;
  }
  return { start, end };
}
