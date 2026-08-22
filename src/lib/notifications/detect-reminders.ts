import type { CalendarEvent } from "@/services/CalendarEventService";
import type { Trip } from "@/services/TripService";
import type { RecurringCalendarEvent } from "@/services/RecurringCalendarEventService";
import type { NotificationEventType } from "@/services/NotificationLogService";
import { expandRecurringOccurrences } from "@/lib/dates/recurring-calendar-events";

/**
 * Pure detector functions (v3.2.0) — take already-fetched domain
 * objects plus "today," return the reminders that should fire today.
 * No DB access here on purpose: ReminderService fetches the real rows
 * via the existing list*() service functions and dedupes against
 * notification_log; these functions are just the "what's due today"
 * math, kept separate specifically so it's unit-testable with plain
 * fixtures, same reasoning as lib/budget/cycle-compare.ts's pure
 * functions behind Dashboard's Cycle Brief.
 */
export interface ReminderCandidate {
  eventType: NotificationEventType;
  /** Stable per underlying obligation/occurrence — matches finance.notification_log.event_key. */
  eventKey: string;
  leadTimeDays: number;
  title: string;
  body: string;
}

/** Whole days from `today` to `date` (both "YYYY-MM-DD"), positive when `date` is in the future — UTC-based, same convention as lib/dates/recurring-calendar-events.ts's occurrence expansion, to avoid the timezone-off-by-one class of bug documented in the roadmap. */
function daysUntil(today: string, date: string): number {
  const from = new Date(`${today}T00:00:00Z`);
  const to = new Date(`${date}T00:00:00Z`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** "15 Oct 2026" — used in every reminder body below, so a message never has to guess what date format the recipient expects. */
function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function whenLabel(leadTimeDays: number): string {
  return leadTimeDays === 0
    ? "today"
    : `in ${leadTimeDays} day${leadTimeDays === 1 ? "" : "s"}`;
}

export function detectCalendarEventReminders(
  events: CalendarEvent[],
  today: string,
): ReminderCandidate[] {
  return events
    .filter(
      (event) =>
        event.remindEnabled &&
        daysUntil(today, event.startDate) === event.remindLeadDays,
    )
    .map((event) => ({
      eventType: "calendar_event" as const,
      eventKey: `calendar_event:${event.id}`,
      leadTimeDays: event.remindLeadDays,
      title: event.title,
      body: `${event.title} — ${formatDate(event.startDate)} (${whenLabel(event.remindLeadDays)})`,
    }));
}

export function detectTripReminders(
  trips: Trip[],
  today: string,
): ReminderCandidate[] {
  return trips
    .filter(
      (trip) =>
        trip.remindEnabled &&
        daysUntil(today, trip.startDate) === trip.remindLeadDays,
    )
    .map((trip) => ({
      eventType: "trip" as const,
      eventKey: `trip:${trip.id}`,
      leadTimeDays: trip.remindLeadDays,
      title: `Trip to ${trip.destination}`,
      body: `Trip to ${trip.destination} — departs ${formatDate(trip.startDate)} (${whenLabel(trip.remindLeadDays)})${trip.flight ? `, flight ${trip.flight}` : ""}`,
    }));
}

/**
 * Reminder-enabled recurring rules produce one candidate per upcoming
 * occurrence, not one per rule — a weekly class reminds you before
 * EVERY class, not just the first. Reuses expandRecurringOccurrences
 * (the same occurrence math the calendar's own month grid/detailed
 * list already use) rather than re-deriving "which weekdays fall in
 * this window."
 */
export function detectRecurringEventReminders(
  rules: RecurringCalendarEvent[],
  today: string,
  maxLeadDays: number,
): ReminderCandidate[] {
  const enabledRules = rules.filter((rule) => rule.remindEnabled);
  if (enabledRules.length === 0) return [];

  const rangeEnd = addDays(today, maxLeadDays);
  const occurrences = expandRecurringOccurrences(enabledRules, today, rangeEnd);
  const ruleById = new Map(enabledRules.map((rule) => [rule.id, rule]));

  const candidates: ReminderCandidate[] = [];
  for (const occurrence of occurrences) {
    const rule = ruleById.get(occurrence.ruleId);
    if (!rule) continue;
    if (daysUntil(today, occurrence.date) !== rule.remindLeadDays) continue;
    candidates.push({
      eventType: "recurring_calendar_event",
      eventKey: `recurring_calendar_event:${rule.id}:${occurrence.date}`,
      leadTimeDays: rule.remindLeadDays,
      title: occurrence.title,
      body: `${occurrence.title} — ${formatDate(occurrence.date)} at ${occurrence.startTime} (${whenLabel(rule.remindLeadDays)})`,
    });
  }
  return candidates;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
