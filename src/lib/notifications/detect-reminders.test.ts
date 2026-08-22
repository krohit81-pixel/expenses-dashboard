import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "@/services/CalendarEventService";
import type { Trip } from "@/services/TripService";
import type { RecurringCalendarEvent } from "@/services/RecurringCalendarEventService";
import type { SchoolCalendarItem } from "@/features/travel/school-items";
import {
  detectCalendarEventReminders,
  detectRecurringEventReminders,
  detectSchoolCalendarReminders,
  detectTripReminders,
} from "./detect-reminders";

function calendarEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "e1",
    title: "Camera insurance renewal",
    tag: "event",
    people: [],
    startDate: "2026-10-15",
    endDate: "2026-10-15",
    notes: null,
    remindEnabled: true,
    remindLeadDays: 3,
    ...overrides,
  };
}

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "t1",
    destination: "Goa",
    startDate: "2026-10-15",
    endDate: "2026-10-18",
    flight: "6E 204",
    travelerNames: ["Rohit"],
    notes: null,
    remindEnabled: true,
    remindLeadDays: 1,
    ...overrides,
  };
}

function recurringRule(
  overrides: Partial<RecurringCalendarEvent> = {},
): RecurringCalendarEvent {
  return {
    id: "r1",
    title: "Calculus",
    people: ["Rohana"],
    mode: "Offline",
    daysOfWeek: [2, 5], // Tue, Fri
    startTime: "08:00",
    endTime: "09:30",
    startDate: "2026-08-10",
    endDate: "2026-09-18",
    notes: null,
    remindEnabled: true,
    remindLeadDays: 0,
    ...overrides,
  };
}

describe("detectCalendarEventReminders", () => {
  it("fires when today is exactly leadDays before startDate", () => {
    const result = detectCalendarEventReminders(
      [calendarEvent({ startDate: "2026-10-15", remindLeadDays: 3 })],
      "2026-10-12",
    );
    expect(result).toHaveLength(1);
    expect(result[0].eventKey).toBe("calendar_event:e1");
    expect(result[0].eventType).toBe("calendar_event");
    expect(result[0].leadTimeDays).toBe(3);
  });

  it("does not fire on any other day", () => {
    const result = detectCalendarEventReminders(
      [calendarEvent({ startDate: "2026-10-15", remindLeadDays: 3 })],
      "2026-10-11",
    );
    expect(result).toHaveLength(0);
  });

  it("ignores an event with reminders disabled", () => {
    const result = detectCalendarEventReminders(
      [
        calendarEvent({
          remindEnabled: false,
          startDate: "2026-10-15",
          remindLeadDays: 3,
        }),
      ],
      "2026-10-12",
    );
    expect(result).toHaveLength(0);
  });

  it("fires on the day itself when remindLeadDays is 0", () => {
    const result = detectCalendarEventReminders(
      [calendarEvent({ startDate: "2026-10-15", remindLeadDays: 0 })],
      "2026-10-15",
    );
    expect(result).toHaveLength(1);
  });
});

describe("detectTripReminders", () => {
  it("fires when today is exactly leadDays before departure", () => {
    const result = detectTripReminders(
      [trip({ startDate: "2026-10-15", remindLeadDays: 1 })],
      "2026-10-14",
    );
    expect(result).toHaveLength(1);
    expect(result[0].eventKey).toBe("trip:t1");
    expect(result[0].eventType).toBe("trip");
    expect(result[0].title).toContain("Goa");
  });

  it("does not fire for a trip with reminders disabled", () => {
    const result = detectTripReminders(
      [trip({ remindEnabled: false })],
      "2026-10-14",
    );
    expect(result).toHaveLength(0);
  });
});

function schoolItem(
  overrides: Partial<SchoolCalendarItem> = {},
): SchoolCalendarItem {
  return {
    person: "ahaana",
    title: "CA 1 – Mathematics",
    tag: "exam",
    startDate: "2026-08-10",
    endDate: "2026-08-10",
    ...overrides,
  };
}

describe("detectSchoolCalendarReminders", () => {
  it("fires exactly leadDays before a single-day item's startDate", () => {
    const result = detectSchoolCalendarReminders(
      [schoolItem({ startDate: "2026-08-10" })],
      "2026-08-09",
      1,
    );
    expect(result).toHaveLength(1);
    expect(result[0].eventType).toBe("school_calendar_event");
    expect(result[0].eventKey).toBe(
      "school_calendar_event:ahaana:2026-08-10:ca-1-mathematics",
    );
    expect(result[0].title).toBe("CA 1 – Mathematics");
    expect(result[0].body).toContain("Ahaana");
  });

  it("does not fire on any other day", () => {
    const result = detectSchoolCalendarReminders(
      [schoolItem({ startDate: "2026-08-10" })],
      "2026-08-08",
      1,
    );
    expect(result).toHaveLength(0);
  });

  it("keys a multi-day (vacation) item off its startDate, not endDate", () => {
    const result = detectSchoolCalendarReminders(
      [
        schoolItem({
          person: "rohana",
          title: "Recess Week",
          tag: "vacation",
          startDate: "2026-09-19",
          endDate: "2026-09-27",
        }),
      ],
      "2026-09-18",
      1,
    );
    expect(result).toHaveLength(1);
    expect(result[0].eventKey).toBe(
      "school_calendar_event:rohana:2026-09-19:recess-week",
    );
  });

  it("applies the same leadDays to every item regardless of person or tag", () => {
    const result = detectSchoolCalendarReminders(
      [
        schoolItem({ person: "ahaana", startDate: "2026-08-10" }),
        schoolItem({
          person: "rohana",
          title: "National Day",
          tag: "holiday",
          startDate: "2026-08-10",
          endDate: "2026-08-10",
        }),
      ],
      "2026-08-09",
      1,
    );
    expect(result).toHaveLength(2);
  });
});

describe("detectRecurringEventReminders", () => {
  it("fires one candidate per matching upcoming occurrence, not per rule", () => {
    // 2026-08-10 is a Monday; Tue/Fri occurrences start 8/11 and 8/14.
    const result = detectRecurringEventReminders(
      [recurringRule({ remindLeadDays: 0 })],
      "2026-08-11",
      7,
    );
    expect(result).toHaveLength(1);
    expect(result[0].eventKey).toBe("recurring_calendar_event:r1:2026-08-11");
  });

  it("respects a non-zero lead time against each occurrence's own date", () => {
    const result = detectRecurringEventReminders(
      [recurringRule({ remindLeadDays: 1 })],
      "2026-08-10", // 1 day before the 8/11 occurrence
      7,
    );
    expect(result).toHaveLength(1);
    expect(result[0].eventKey).toBe("recurring_calendar_event:r1:2026-08-11");
  });

  it("ignores a rule with reminders disabled", () => {
    const result = detectRecurringEventReminders(
      [recurringRule({ remindEnabled: false })],
      "2026-08-11",
      7,
    );
    expect(result).toHaveLength(0);
  });

  it("produces nothing outside the rule's own bounded date range", () => {
    const result = detectRecurringEventReminders(
      [
        recurringRule({
          startDate: "2026-08-10",
          endDate: "2026-08-12",
          remindLeadDays: 0,
        }),
      ],
      "2026-08-14", // after the rule's own end_date
      7,
    );
    expect(result).toHaveLength(0);
  });
});
