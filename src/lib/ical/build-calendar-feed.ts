/**
 * Builds the plain-data event list for Atlas's Apple/Google-Calendar-
 * subscribable iCal feed (v3.6.4) — GET /api/calendar.ics. Pure and
 * DB-free: the route handler fetches real rows via the existing
 * list*()/buildSchoolCalendarItems() functions (the same four sources
 * TravelCalendarSection already renders) and hands them here; this
 * module only shapes them into ical-generator's own ICalEventData
 * type, which the route then feeds straight to `ical({..., events})`.
 *
 * Recurring class rules are emitted as ONE real recurring VEVENT each
 * (a proper WEEKLY RRULE with BYDAY), not one VEVENT per already-
 * expanded occurrence the way this app's own UI grids build things
 * internally (see recurring-calendar-events.ts) — that's the whole
 * point of iCal's native recurrence support, and lets Apple Calendar
 * itself handle the repetition rather than this feed re-deriving it.
 */

import {
  ICalEventRepeatingFreq,
  ICalWeekday,
  type ICalCategoryData,
  type ICalEventData,
} from "ical-generator";

import { TAG_LABELS } from "@/features/calendar/data";
import { shiftDate } from "@/lib/dates/calendar-grid";
import type { SchoolCalendarItem } from "@/features/travel/school-items";
import type { Trip } from "@/services/TripService";
import type { CalendarEvent } from "@/services/CalendarEventService";
import type { RecurringCalendarEvent } from "@/services/RecurringCalendarEventService";

const SCHOOL_PERSON_NAME = { ahaana: "Ahaana", rohana: "Rohana" } as const;

/**
 * A Date whose UTC-field getters equal the given IST wall-clock
 * date+time — NOT the real UTC instant it represents. Paired with
 * `floating: true` (never `timezone: "Asia/Kolkata"`) on the event.
 *
 * This looks backwards, but it's a deliberate, confirmed workaround:
 * `ical-generator`'s own DTSTART/RRULE-UNTIL formatting, when an
 * event declares a `timezone`, reads the Date back out using the
 * RUNNING NODE PROCESS's *local* getters (`getHours()`, `getMinutes()`
 * — the server's own system timezone), not a real IANA conversion of
 * the given TZID. On Vercel (server TZ is UTC) that silently shifted
 * every timed event and recurring rule by the full IST offset — a bug
 * that stayed invisible testing locally in this sandbox, whose own
 * system timezone already happens to be Asia/Calcutta. Confirmed with
 * `TZ=UTC node -e ...` reproducing the shift, and fixed by sidestepping
 * that whole code path: a floating (TZID-less) event has its digits
 * read via `getUTCHours()` etc. instead, so constructing the Date's
 * UTC fields to equal the target wall-clock time directly, with no
 * `timezone` field on the event at all, is what actually produces the
 * correct output regardless of the server's own system timezone. A
 * floating time is also the semantically right choice here anyway —
 * this calendar's entire audience is in India already.
 */
function wallClockDateTime(date: string, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(
    Date.UTC(
      Number(date.slice(0, 4)),
      Number(date.slice(5, 7)) - 1,
      Number(date.slice(8, 10)),
      hours,
      minutes,
    ),
  );
}

/** RFC 5545's DTEND for a DATE-only (all-day) VEVENT is EXCLUSIVE — a visually 3-day event (Aug 1–3 inclusive) needs DTEND = Aug 4, or Apple Calendar renders it one day short. */
function exclusiveEnd(endDate: string): string {
  return shiftDate(endDate, 1);
}

function category(name: string): ICalCategoryData[] {
  return [{ name }];
}

/** 0=Sunday..6=Saturday (this app's own convention, matching Date#getUTCDay()) -> ical-generator's ICalWeekday. */
const DAY_TO_ICAL_WEEKDAY: Record<number, ICalWeekday> = {
  0: ICalWeekday.SU,
  1: ICalWeekday.MO,
  2: ICalWeekday.TU,
  3: ICalWeekday.WE,
  4: ICalWeekday.TH,
  5: ICalWeekday.FR,
  6: ICalWeekday.SA,
};

function joinNonEmpty(lines: (string | null)[]): string | undefined {
  const kept = lines.filter((line): line is string => Boolean(line));
  return kept.length > 0 ? kept.join("\n") : undefined;
}

function tripToEvent(trip: Trip): ICalEventData {
  return {
    id: `atlas-trip-${trip.id}`,
    start: trip.startDate,
    end: exclusiveEnd(trip.endDate),
    allDay: true,
    summary: trip.destination,
    description: joinNonEmpty([
      trip.flight ? `Flight: ${trip.flight}` : null,
      trip.travelerNames.length > 0
        ? `Travelling: ${trip.travelerNames.join(", ")}`
        : null,
      trip.notes,
    ]),
    categories: category("Trip"),
  };
}

function schoolItemToEvent(item: SchoolCalendarItem): ICalEventData {
  return {
    // School items have no DB id (static in-code data) -- the same
    // stable, content-derived key detailed-list.ts already uses for
    // its own React list keys.
    id: `atlas-school-${item.person}-${item.title}-${item.startDate}`,
    start: item.startDate,
    end: exclusiveEnd(item.endDate),
    allDay: true,
    summary: `${SCHOOL_PERSON_NAME[item.person]}: ${item.title}`,
    description: item.meta,
    categories: category(TAG_LABELS[item.tag]),
  };
}

function calendarEventToEvent(event: CalendarEvent): ICalEventData {
  const description = joinNonEmpty([
    event.people.length > 0 ? `Tagged: ${event.people.join(", ")}` : null,
    event.notes,
  ]);

  if (!event.startTime) {
    return {
      id: `atlas-event-${event.id}`,
      start: event.startDate,
      end: exclusiveEnd(event.endDate),
      allDay: true,
      summary: event.title,
      description,
      categories: category(TAG_LABELS[event.tag]),
    };
  }

  // CalendarEventService has no separate end-time column -- one hour
  // is a reasonable default duration for a timed appointment, not a
  // fact the data actually states.
  const start = wallClockDateTime(event.startDate, event.startTime);
  return {
    id: `atlas-event-${event.id}`,
    start,
    end: new Date(start.getTime() + 60 * 60_000),
    floating: true,
    summary: event.title,
    description,
    categories: category(TAG_LABELS[event.tag]),
  };
}

function recurringRuleToEvent(rule: RecurringCalendarEvent): ICalEventData {
  return {
    id: `atlas-recurring-${rule.id}`,
    start: wallClockDateTime(rule.startDate, rule.startTime),
    end: wallClockDateTime(rule.startDate, rule.endTime),
    floating: true,
    summary: rule.title,
    description: joinNonEmpty([
      rule.people.length > 0 ? `Tagged: ${rule.people.join(", ")}` : null,
      rule.mode,
      rule.notes,
    ]),
    categories: category("Class"),
    repeating: {
      freq: ICalEventRepeatingFreq.WEEKLY,
      byDay: rule.daysOfWeek.map((day) => DAY_TO_ICAL_WEEKDAY[day]),
      until: wallClockDateTime(rule.endDate, "23:59"),
    },
  };
}

export function buildCalendarFeedEvents(
  trips: Trip[],
  schoolItems: SchoolCalendarItem[],
  calendarEvents: CalendarEvent[],
  recurringRules: RecurringCalendarEvent[],
): ICalEventData[] {
  return [
    ...trips.map(tripToEvent),
    ...schoolItems.map(schoolItemToEvent),
    ...calendarEvents.map(calendarEventToEvent),
    ...recurringRules.map(recurringRuleToEvent),
  ];
}
