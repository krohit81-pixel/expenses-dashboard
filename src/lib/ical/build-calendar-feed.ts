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

// Atlas's servers don't run in India's timezone (see lib/version.ts's
// getIndiaDateLabel) -- combining an IST wall-clock date+time into the
// real UTC instant it represents is the same private helper already
// duplicated in lib/notifications/detect-reminders.ts and
// detect-ahaana-reminders.ts; kept as its own copy here too, same
// "each pure module keeps its own tiny copy" reasoning those give.
const IST_OFFSET_MINUTES = 5 * 60 + 30;

function istDateTime(date: string, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(
    Date.UTC(
      Number(date.slice(0, 4)),
      Number(date.slice(5, 7)) - 1,
      Number(date.slice(8, 10)),
      hours,
      minutes,
    ) -
      IST_OFFSET_MINUTES * 60_000,
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
  const start = istDateTime(event.startDate, event.startTime);
  return {
    id: `atlas-event-${event.id}`,
    start,
    end: new Date(start.getTime() + 60 * 60_000),
    timezone: "Asia/Kolkata",
    summary: event.title,
    description,
    categories: category(TAG_LABELS[event.tag]),
  };
}

function recurringRuleToEvent(rule: RecurringCalendarEvent): ICalEventData {
  return {
    id: `atlas-recurring-${rule.id}`,
    start: istDateTime(rule.startDate, rule.startTime),
    end: istDateTime(rule.startDate, rule.endTime),
    timezone: "Asia/Kolkata",
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
      until: istDateTime(rule.endDate, "23:59"),
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
