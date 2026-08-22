import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "@/services/CalendarEventService";
import type { Trip } from "@/services/TripService";
import type { RecurringCalendarEvent } from "@/services/RecurringCalendarEventService";
import type { SchoolCalendarItem } from "@/features/travel/school-items";
import {
  detectCalendarEventHourlyReminders,
  detectCalendarEventReminders,
  detectRecurringEventHourlyReminders,
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
    startTime: null,
    notes: null,
    remindEnabled: true,
    remindLeadDays: 3,
    remindLeadHours: null,
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
    remindLeadHours: null,
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
    expect(result[0].leadTimeUnit).toBe("days");
  });

  it("skips an event using an hour-based reminder instead (mutual exclusivity, v3.2.2)", () => {
    // remindLeadDays is still 0 (whatever it was last set to in the
    // UI) but remindLeadHours being set means the hourly detector
    // owns this event now — the day-based one must not also fire for
    // it on the day itself.
    const result = detectCalendarEventReminders(
      [
        calendarEvent({
          startDate: "2026-10-15",
          remindLeadDays: 0,
          remindLeadHours: 3,
          startTime: "09:00",
        }),
      ],
      "2026-10-15",
    );
    expect(result).toHaveLength(0);
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

  describe("body (v3.3.2 — no repeated title, time/notes when present)", () => {
    it("omits the title, a time line, and a notes line when neither is set", () => {
      const result = detectCalendarEventReminders(
        [
          calendarEvent({
            startDate: "2026-10-15",
            remindLeadDays: 3,
            startTime: null,
            notes: null,
          }),
        ],
        "2026-10-12",
      );
      expect(result[0].body).not.toContain("Camera insurance renewal");
      expect(result[0].body).toBe("📅 Oct 15, 2026\n⏰ 3 days before");
    });

    it("adds a time line when startTime is set", () => {
      const result = detectCalendarEventReminders(
        [
          calendarEvent({
            startDate: "2026-10-15",
            remindLeadDays: 1,
            startTime: "18:00",
          }),
        ],
        "2026-10-14",
      );
      expect(result[0].body).toContain("📅 Oct 15, 2026 at 6:00 PM");
    });

    it("adds a notes line when notes is set", () => {
      const result = detectCalendarEventReminders(
        [
          calendarEvent({
            startDate: "2026-10-15",
            remindLeadDays: 0,
            notes: "Bring wine",
          }),
        ],
        "2026-10-15",
      );
      expect(result[0].body).toBe("📅 Oct 15, 2026\n⏰ Today\n📝 Bring wine");
    });

    it("adds a people line, first, when someone's tagged (household-reported gap)", () => {
      const result = detectCalendarEventReminders(
        [
          calendarEvent({
            startDate: "2026-10-15",
            remindLeadDays: 0,
            people: ["Rohit", "Ahaana"],
          }),
        ],
        "2026-10-15",
      );
      expect(result[0].body).toBe(
        "👥 Rohit, Ahaana\n📅 Oct 15, 2026\n⏰ Today",
      );
    });
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

  it("body (v3.3.2) has no repeated title, includes flight and notes when set", () => {
    const result = detectTripReminders(
      [
        trip({
          startDate: "2026-10-15",
          remindLeadDays: 1,
          flight: "6E 204",
          notes: "Terminal 2",
        }),
      ],
      "2026-10-14",
    );
    expect(result[0].body).not.toContain("Trip to Goa");
    expect(result[0].body).toBe(
      "👥 Rohit\n📅 Departs Oct 15, 2026\n✈️ 6E 204\n⏰ 1 day before\n📝 Terminal 2",
    );
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
    // v3.3.2 — person/date/lead-time lines, no repeated title (Telegram
    // already bolds the title as its own line). v3.3.4 — a smart note
    // line derived from the item's tag ("exam" here, same as every
    // CA1/CA2 subject test).
    expect(result[0].body).toBe(
      "👤 Ahaana\n📅 Aug 10, 2026\n⏰ 1 day before\n📝 All the best! Prepare well.",
    );
  });

  it("uses a different smart note per tag (v3.3.4)", () => {
    const result = detectSchoolCalendarReminders(
      [
        schoolItem({
          title: "Diwali Vacations",
          tag: "vacation",
          startDate: "2026-08-10",
        }),
        schoolItem({
          title: "Independence Day",
          tag: "holiday",
          startDate: "2026-08-10",
        }),
      ],
      "2026-08-09",
      1,
    );
    expect(result[0].body).toContain(
      "📝 Enjoy the break — make the most of it!",
    );
    expect(result[1].body).toContain(
      "📝 Enjoy the holiday — make the most of it!",
    );
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
    expect(result[0].leadTimeUnit).toBe("days");
  });

  it("skips a rule using an hour-based reminder instead (mutual exclusivity, v3.2.2)", () => {
    const result = detectRecurringEventReminders(
      [recurringRule({ remindLeadDays: 0, remindLeadHours: 3 })],
      "2026-08-11",
      7,
    );
    expect(result).toHaveLength(0);
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

  it("body (v3.3.2) has no repeated title, includes time and notes when set", () => {
    const result = detectRecurringEventReminders(
      [recurringRule({ remindLeadDays: 0, notes: "Zoom link in the LMS" })],
      "2026-08-11",
      7,
    );
    expect(result[0].body).not.toContain("Calculus");
    expect(result[0].body).toBe(
      "👥 Rohana\n📅 Aug 11, 2026 at 8:00 AM\n⏰ Today\n📝 Zoom link in the LMS",
    );
  });
});

describe("detectCalendarEventHourlyReminders", () => {
  // startDate "2026-10-15" + startTime "09:00" (IST wall clock) is
  // 2026-10-15T03:30:00Z in UTC (IST is UTC+5:30). remindLeadHours: 3
  // means the reminder window is [00:30Z, 03:30Z) that same UTC date.
  const event = (overrides: Partial<CalendarEvent> = {}) =>
    calendarEvent({
      startDate: "2026-10-15",
      startTime: "09:00",
      remindLeadDays: 0,
      remindLeadHours: 3,
      ...overrides,
    });

  it("fires once now is inside the [reminderInstant, eventInstant) window", () => {
    const result = detectCalendarEventHourlyReminders(
      [event()],
      "2026-10-15T01:00:00.000Z",
    );
    expect(result).toHaveLength(1);
    expect(result[0].eventKey).toBe("calendar_event:e1");
    expect(result[0].leadTimeDays).toBe(3);
    expect(result[0].leadTimeUnit).toBe("hours");
    // v3.3.2 — no repeated title, time always shown (hourly reminders
    // require a startTime to exist at all).
    expect(result[0].body).toBe("📅 Oct 15, 2026 at 9:00 AM\n⏰ 3h before");
  });

  it("does not fire before the reminder threshold", () => {
    const result = detectCalendarEventHourlyReminders(
      [event()],
      "2026-10-15T00:00:00.000Z",
    );
    expect(result).toHaveLength(0);
  });

  it("does not fire once the event itself has started", () => {
    const result = detectCalendarEventHourlyReminders(
      [event()],
      "2026-10-15T04:00:00.000Z",
    );
    expect(result).toHaveLength(0);
  });

  it("ignores an event with no startTime, even if remindLeadHours is set", () => {
    const result = detectCalendarEventHourlyReminders(
      [event({ startTime: null })],
      "2026-10-15T01:00:00.000Z",
    );
    expect(result).toHaveLength(0);
  });

  it("ignores an event with no remindLeadHours set (day-based only)", () => {
    const result = detectCalendarEventHourlyReminders(
      [event({ remindLeadHours: null })],
      "2026-10-15T01:00:00.000Z",
    );
    expect(result).toHaveLength(0);
  });

  it("ignores an event with reminders disabled", () => {
    const result = detectCalendarEventHourlyReminders(
      [event({ remindEnabled: false })],
      "2026-10-15T01:00:00.000Z",
    );
    expect(result).toHaveLength(0);
  });
});

describe("detectRecurringEventHourlyReminders", () => {
  // recurringRule()'s Tue/Fri occurrences start with 2026-08-11
  // (Tuesday) at startTime "08:00" IST = 2026-08-11T02:30:00Z. A
  // 4-hour lead time puts the reminder threshold at
  // 2026-08-10T22:30:00Z — the DAY BEFORE the occurrence's own date in
  // UTC, exercising the -1 day rangeStart slack this detector adds
  // specifically for this IST/UTC gap.
  it("fires once now is inside the window, even though that's the day before the occurrence in UTC", () => {
    const result = detectRecurringEventHourlyReminders(
      [recurringRule({ remindLeadDays: 0, remindLeadHours: 4 })],
      "2026-08-10T23:00:00.000Z",
      2,
    );
    expect(result).toHaveLength(1);
    expect(result[0].eventKey).toBe("recurring_calendar_event:r1:2026-08-11");
    expect(result[0].leadTimeDays).toBe(4);
    expect(result[0].leadTimeUnit).toBe("hours");
  });

  it("does not fire before the reminder threshold", () => {
    const result = detectRecurringEventHourlyReminders(
      [recurringRule({ remindLeadDays: 0, remindLeadHours: 4 })],
      "2026-08-10T21:00:00.000Z",
      2,
    );
    expect(result).toHaveLength(0);
  });

  it("ignores a rule with no remindLeadHours set (day-based only)", () => {
    const result = detectRecurringEventHourlyReminders(
      [recurringRule({ remindLeadDays: 0, remindLeadHours: null })],
      "2026-08-10T23:00:00.000Z",
      2,
    );
    expect(result).toHaveLength(0);
  });

  it("ignores a rule with reminders disabled", () => {
    const result = detectRecurringEventHourlyReminders(
      [
        recurringRule({
          remindEnabled: false,
          remindLeadDays: 0,
          remindLeadHours: 4,
        }),
      ],
      "2026-08-10T23:00:00.000Z",
      2,
    );
    expect(result).toHaveLength(0);
  });
});
