import type { CalendarEvent } from "@/services/CalendarEventService";
import type { Trip } from "@/services/TripService";
import type { RecurringCalendarEvent } from "@/services/RecurringCalendarEventService";
import type { NotificationEventType } from "@/services/NotificationLogService";
import type { SchoolCalendarItem } from "@/features/travel/school-items";
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
  /** The lead-time magnitude — days or hours depending on leadTimeUnit. Named leadTimeDays for historical/DB-column reasons (v3.2.0 predates hour-based reminders); it's genuinely an hour count when leadTimeUnit is "hours". */
  leadTimeDays: number;
  /** v3.2.2 — disambiguates leadTimeDays. Every pre-v3.2.2 detector always produces "days"; only the two *Hourly* detectors below produce "hours". Part of the notification_log dedupe key (see NotificationLogService) so a 3-day and a 3-hour reminder for the same event are never treated as duplicates of each other. */
  leadTimeUnit: "days" | "hours";
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
        // v3.2.2 — a row with remindLeadHours set uses the hourly path
        // instead (detectCalendarEventHourlyReminders); skip it here so
        // it doesn't ALSO fire a day-based reminder the day it's due
        // (remindLeadDays stays whatever it was last set to, even in
        // hours mode — see ReminderFields).
        event.remindLeadHours === null &&
        daysUntil(today, event.startDate) === event.remindLeadDays,
    )
    .map((event) => ({
      eventType: "calendar_event" as const,
      eventKey: `calendar_event:${event.id}`,
      leadTimeDays: event.remindLeadDays,
      leadTimeUnit: "days" as const,
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
      leadTimeUnit: "days" as const,
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
  // v3.2.2 — a rule with remindLeadHours set uses the hourly path
  // instead (detectRecurringEventHourlyReminders); excluded here for
  // the same mutual-exclusivity reason as detectCalendarEventReminders.
  const enabledRules = rules.filter(
    (rule) => rule.remindEnabled && rule.remindLeadHours === null,
  );
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
      leadTimeUnit: "days",
      title: occurrence.title,
      body: `${occurrence.title} — ${formatDate(occurrence.date)} at ${occurrence.startTime} (${whenLabel(rule.remindLeadDays)})`,
    });
  }
  return candidates;
}

const IST_OFFSET_MINUTES = 5 * 60 + 30;

/**
 * Combines a "YYYY-MM-DD" date and "HH:MM" time — both understood as
 * IST wall-clock values, this household's real timezone (Vercel's
 * servers don't run there — same reasoning as lib/version.ts's
 * getIndiaDateLabel) — into the UTC instant (epoch millis) they
 * represent. Only used by the hourly detectors below; the day-based
 * ones above intentionally keep comparing plain date strings, a
 * separate (pre-existing, not introduced here) quirk not in scope to
 * change as part of this feature.
 */
function istDateTimeToUtcMillis(date: string, time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (
    Date.UTC(
      Number(date.slice(0, 4)),
      Number(date.slice(5, 7)) - 1,
      Number(date.slice(8, 10)),
      hours,
      minutes,
    ) -
    IST_OFFSET_MINUTES * 60_000
  );
}

/**
 * v3.2.2 — the hour-based counterpart to detectCalendarEventReminders,
 * for a calendar event that has both an optional startTime AND an
 * hour-based lead time set (see zHourlyReminderFields' comment on the
 * two being mutually exclusive with remindLeadDays). `nowIso` is a
 * full instant (e.g. new Date().toISOString()), not just a date — the
 * whole point of an hour-based reminder is caring about time of day,
 * unlike the day-based detectors above.
 *
 * A candidate stays "due" from the moment its reminder threshold
 * passes until the event itself starts — same "due for a whole window,
 * dedup makes repeat runs harmless" shape the day-based detectors use
 * for a whole calendar day, just a narrower window measured in hours
 * instead of one day.
 */
export function detectCalendarEventHourlyReminders(
  events: CalendarEvent[],
  nowIso: string,
): ReminderCandidate[] {
  const now = new Date(nowIso).getTime();

  return events
    .filter(
      (event): event is CalendarEvent & { startTime: string } =>
        event.remindEnabled &&
        event.remindLeadHours !== null &&
        event.startTime !== null,
    )
    .filter((event) => {
      const eventInstant = istDateTimeToUtcMillis(
        event.startDate,
        event.startTime,
      );
      const reminderInstant = eventInstant - event.remindLeadHours! * 3_600_000;
      return reminderInstant <= now && now < eventInstant;
    })
    .map((event) => ({
      eventType: "calendar_event" as const,
      eventKey: `calendar_event:${event.id}`,
      leadTimeDays: event.remindLeadHours!,
      leadTimeUnit: "hours" as const,
      title: event.title,
      body: `${event.title} — ${formatDate(event.startDate)} at ${event.startTime} (${event.remindLeadHours}h before)`,
    }));
}

/**
 * v3.2.2 — the hour-based counterpart to detectRecurringEventReminders.
 * `lookaheadDays` only needs to cover however many hours ahead the
 * longest lead time can look (< 24h today, given the 3/4-hour UI
 * options) plus a day of slack for the IST/UTC date-boundary gap — 2
 * is generous, expandRecurringOccurrences over a couple of days is
 * cheap.
 */
export function detectRecurringEventHourlyReminders(
  rules: RecurringCalendarEvent[],
  nowIso: string,
  lookaheadDays: number,
): ReminderCandidate[] {
  const enabledRules = rules.filter(
    (rule) => rule.remindEnabled && rule.remindLeadHours !== null,
  );
  if (enabledRules.length === 0) return [];

  const now = new Date(nowIso).getTime();
  const today = nowIso.slice(0, 10);
  // Starts a day before "today" (UTC) as slack for the same IST/UTC
  // gap istDateTimeToUtcMillis exists to bridge — an occurrence whose
  // UTC date is technically "yesterday" can still be within an hourly
  // reminder's window in real IST wall-clock terms.
  const rangeStart = addDays(today, -1);
  const rangeEnd = addDays(today, lookaheadDays);
  const occurrences = expandRecurringOccurrences(
    enabledRules,
    rangeStart,
    rangeEnd,
  );
  const ruleById = new Map(enabledRules.map((rule) => [rule.id, rule]));

  const candidates: ReminderCandidate[] = [];
  for (const occurrence of occurrences) {
    const rule = ruleById.get(occurrence.ruleId);
    if (!rule || rule.remindLeadHours === null) continue;

    const eventInstant = istDateTimeToUtcMillis(
      occurrence.date,
      occurrence.startTime,
    );
    const reminderInstant = eventInstant - rule.remindLeadHours * 3_600_000;
    if (reminderInstant <= now && now < eventInstant) {
      candidates.push({
        eventType: "recurring_calendar_event",
        eventKey: `recurring_calendar_event:${rule.id}:${occurrence.date}`,
        leadTimeDays: rule.remindLeadHours,
        leadTimeUnit: "hours",
        title: occurrence.title,
        body: `${occurrence.title} — ${formatDate(occurrence.date)} at ${occurrence.startTime} (${rule.remindLeadHours}h before)`,
      });
    }
  }
  return candidates;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const PERSON_LABEL: Record<SchoolCalendarItem["person"], string> = {
  ahaana: "Ahaana",
  rohana: "Rohana",
};

/** Lowercase, alnum-and-dash only — just enough to make a title safe as part of a notification_log event_key, not a general-purpose slugify. */
function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Every entry in both static school calendars (v3.2.1, household
 * request) — Ahaana's CNS calendar/CA1-CA2 dates and Rohana's NUS
 * calendar, ALL tags (holiday/exam/vacation/event/trip), not a
 * filtered subset. Fixed lead time for every item, not per-item —
 * these are static data-file rows with no remind_enabled/
 * remind_lead_days columns to toggle (see the migration comment for
 * why this deliberately isn't a finance.calendar_events row).
 *
 * eventKey has no stable DB id to key off, unlike the other three
 * detectors — built instead from person + startDate + a slugified
 * title. That means editing an item's title text later (a typo fix in
 * data.ts) changes its key and lets that one item's reminder resend
 * once more; an accepted tradeoff for static, once-a-year data rather
 * than inventing a synthetic id that would need to live in data.ts
 * itself just for this.
 */
export function detectSchoolCalendarReminders(
  items: SchoolCalendarItem[],
  today: string,
  leadDays: number,
): ReminderCandidate[] {
  return items
    .filter((item) => daysUntil(today, item.startDate) === leadDays)
    .map((item) => ({
      eventType: "school_calendar_event" as const,
      eventKey: `school_calendar_event:${item.person}:${item.startDate}:${slugifyTitle(item.title)}`,
      leadTimeDays: leadDays,
      leadTimeUnit: "days" as const,
      title: item.title,
      body: `${PERSON_LABEL[item.person]}: ${item.title} — ${formatDate(item.startDate)} (${whenLabel(leadDays)})`,
    }));
}
