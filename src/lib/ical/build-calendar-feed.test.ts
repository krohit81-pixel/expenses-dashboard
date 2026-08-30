import { describe, expect, it } from "vitest";

import { buildCalendarFeedEvents } from "./build-calendar-feed";
import type { SchoolCalendarItem } from "@/features/travel/school-items";
import type { CalendarEvent } from "@/services/CalendarEventService";
import type { Trip } from "@/services/TripService";
import type { RecurringCalendarEvent } from "@/services/RecurringCalendarEventService";

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "t1",
    destination: "Satara",
    startDate: "2026-09-05",
    endDate: "2026-09-06",
    flight: null,
    travelerNames: ["Rohit", "Aradhana"],
    notes: null,
    remindEnabled: false,
    remindLeadDays: 0,
    ...overrides,
  };
}

function schoolItem(
  overrides: Partial<SchoolCalendarItem> = {},
): SchoolCalendarItem {
  return {
    person: "ahaana",
    title: "CA1 – Second Language",
    tag: "exam",
    startDate: "2026-09-01",
    endDate: "2026-09-01",
    ...overrides,
  };
}

function calendarEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "e1",
    title: "Dinner",
    tag: "event",
    people: ["Rohit"],
    startDate: "2026-09-02",
    endDate: "2026-09-02",
    startTime: null,
    notes: null,
    remindEnabled: false,
    remindLeadDays: 0,
    remindLeadHours: null,
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
    mode: null,
    daysOfWeek: [2, 5],
    startTime: "08:00",
    endTime: "09:30",
    startDate: "2026-08-11",
    endDate: "2026-12-01",
    notes: null,
    remindEnabled: false,
    remindLeadDays: 0,
    remindLeadHours: null,
    ...overrides,
  };
}

describe("buildCalendarFeedEvents — trips", () => {
  it("makes a multi-day trip all-day with an exclusive end date", () => {
    const [event] = buildCalendarFeedEvents([trip()], [], [], []);
    expect(event.allDay).toBe(true);
    expect(event.start).toBe("2026-09-05");
    expect(event.end).toBe("2026-09-07"); // endDate 09-06 + 1 day
    expect(event.summary).toBe("Satara");
  });

  it("composes the description from flight, travelers, and notes, skipping empty ones", () => {
    const [event] = buildCalendarFeedEvents(
      [trip({ flight: "6E 5123", notes: "Book cabs in advance" })],
      [],
      [],
      [],
    );
    expect(event.description).toBe(
      "Flight: 6E 5123\nTravelling: Rohit, Aradhana\nBook cabs in advance",
    );
  });

  it("has no description when there's nothing to say", () => {
    const [event] = buildCalendarFeedEvents(
      [trip({ flight: null, travelerNames: [], notes: null })],
      [],
      [],
      [],
    );
    expect(event.description).toBeUndefined();
  });

  it("gives every trip a stable, unique id", () => {
    const [event] = buildCalendarFeedEvents(
      [trip({ id: "abc-123" })],
      [],
      [],
      [],
    );
    expect(event.id).toBe("atlas-trip-abc-123");
  });
});

describe("buildCalendarFeedEvents — school items", () => {
  it("prefixes the summary with the person's name and uses the tag's label as category", () => {
    const [event] = buildCalendarFeedEvents(
      [],
      [schoolItem({ person: "rohana", title: "Recess Week", tag: "vacation" })],
      [],
      [],
    );
    expect(event.summary).toBe("Rohana: Recess Week");
    expect(event.categories).toEqual([{ name: "Vacation" }]);
  });

  it("uses an exclusive end date for a multi-day school item", () => {
    const [event] = buildCalendarFeedEvents(
      [],
      [schoolItem({ startDate: "2026-09-19", endDate: "2026-09-27" })],
      [],
      [],
    );
    expect(event.end).toBe("2026-09-28");
  });
});

describe("buildCalendarFeedEvents — manual calendar events", () => {
  it("is all-day with no time component when the event has no startTime", () => {
    const [event] = buildCalendarFeedEvents(
      [],
      [],
      [calendarEvent({ startTime: null })],
      [],
    );
    expect(event.allDay).toBe(true);
    expect(event.floating).toBeUndefined();
  });

  it("is a floating-time event defaulting to a 1-hour duration when startTime is set", () => {
    const [event] = buildCalendarFeedEvents(
      [],
      [],
      [calendarEvent({ startDate: "2026-09-02", startTime: "18:00" })],
      [],
    );
    // Floating (no `timezone`), not real-instant UTC math -- see
    // wallClockDateTime's own comment for why: the Date's UTC-field
    // getters carry the wall-clock digits directly.
    expect(event.floating).toBe(true);
    expect(event.timezone).toBeUndefined();
    expect(event.allDay).toBeUndefined();
    const start = event.start as Date;
    const end = event.end as Date;
    expect(end.getTime() - start.getTime()).toBe(60 * 60_000);
    expect(start.toISOString()).toBe("2026-09-02T18:00:00.000Z");
  });

  it("lists tagged people and notes in the description", () => {
    const [event] = buildCalendarFeedEvents(
      [],
      [],
      [calendarEvent({ people: ["Rohit", "Ahaana"], notes: "Bring the cake" })],
      [],
    );
    expect(event.description).toBe("Tagged: Rohit, Ahaana\nBring the cake");
  });
});

describe("buildCalendarFeedEvents — recurring rules", () => {
  it("builds a real WEEKLY repeating rule with the correct weekdays", () => {
    const [event] = buildCalendarFeedEvents([], [], [], [recurringRule()]);
    expect(event.repeating).toEqual({
      freq: "WEEKLY",
      byDay: ["TU", "FR"],
      until: expect.any(Date),
    });
  });

  it("anchors start/end on the rule's own start date and start/end time, as floating local time", () => {
    const [event] = buildCalendarFeedEvents(
      [],
      [],
      [],
      [
        recurringRule({
          startDate: "2026-08-11",
          startTime: "08:00",
          endTime: "09:30",
        }),
      ],
    );
    expect(event.floating).toBe(true);
    expect(event.timezone).toBeUndefined();
    expect((event.start as Date).toISOString()).toBe(
      "2026-08-11T08:00:00.000Z",
    );
    expect((event.end as Date).toISOString()).toBe("2026-08-11T09:30:00.000Z");
  });

  it("sets the repeating until bound from the rule's own end date", () => {
    const [event] = buildCalendarFeedEvents(
      [],
      [],
      [],
      [recurringRule({ endDate: "2026-12-01" })],
    );
    const until = (event.repeating as { until: Date }).until;
    expect(until.toISOString()).toBe("2026-12-01T23:59:00.000Z");
  });
});

describe("buildCalendarFeedEvents", () => {
  it("combines all four sources in order", () => {
    const events = buildCalendarFeedEvents(
      [trip()],
      [schoolItem()],
      [calendarEvent()],
      [recurringRule()],
    );
    expect(events).toHaveLength(4);
    expect(events.map((e) => e.id)).toEqual([
      "atlas-trip-t1",
      "atlas-school-ahaana-CA1 – Second Language-2026-09-01",
      "atlas-event-e1",
      "atlas-recurring-r1",
    ]);
  });
});
