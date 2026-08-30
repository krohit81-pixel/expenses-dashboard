import { describe, expect, it } from "vitest";

import {
  buildBusiestWeekSummary,
  describeBusiestWeek,
  weekAheadRange,
} from "./busiest-week";
import type { SchoolCalendarItem } from "./school-items";
import type { CalendarEvent } from "@/services/CalendarEventService";
import type { Trip } from "@/services/TripService";
import type { RecurringOccurrence } from "@/lib/dates/recurring-calendar-events";

const WEEK_START = "2026-08-31";
const WEEK_END = "2026-09-06";

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
    endTime: null,
    notes: null,
    remindEnabled: false,
    remindLeadDays: 0,
    remindLeadHours: null,
    ...overrides,
  };
}

function recurringOccurrence(
  overrides: Partial<RecurringOccurrence> = {},
): RecurringOccurrence {
  return {
    key: "r1-2026-09-02",
    ruleId: "r1",
    title: "French",
    people: ["Ahaana"],
    mode: null,
    date: "2026-09-02",
    startTime: "16:00",
    endTime: "17:00",
    notes: null,
    ...overrides,
  };
}

describe("buildBusiestWeekSummary", () => {
  it("counts one item per tagged person across every source, sorted busiest-first", () => {
    const summary = buildBusiestWeekSummary(
      [trip()],
      [
        schoolItem({ startDate: "2026-09-01", endDate: "2026-09-01" }),
        schoolItem({
          title: "CA1 – English",
          startDate: "2026-09-04",
          endDate: "2026-09-04",
        }),
        schoolItem({
          title: "Dahi Handi / Teacher's Day",
          tag: "holiday",
          startDate: "2026-09-05",
          endDate: "2026-09-05",
        }),
      ],
      [],
      [],
      WEEK_START,
      WEEK_END,
    );

    expect(summary.rows).toEqual([
      { name: "Ahaana", count: 3, titles: expect.any(Array) },
      { name: "Aradhana", count: 1, titles: ["Satara"] },
      { name: "Rohit", count: 1, titles: ["Satara"] },
      { name: "Rohana", count: 0, titles: [] },
    ]);
    expect(summary.busiestNames).toEqual(["Ahaana"]);
  });

  it("excludes items entirely outside the given week", () => {
    const summary = buildBusiestWeekSummary(
      [trip({ startDate: "2026-07-01", endDate: "2026-07-02" })],
      [],
      [],
      [],
      WEEK_START,
      WEEK_END,
    );
    expect(summary.rows.every((r) => r.count === 0)).toBe(true);
    expect(summary.busiestNames).toEqual([]);
  });

  it("includes an item that only partially overlaps the week", () => {
    // Starts before the week, ends inside it.
    const summary = buildBusiestWeekSummary(
      [trip({ startDate: "2026-08-29", endDate: "2026-09-01" })],
      [],
      [],
      [],
      WEEK_START,
      WEEK_END,
    );
    expect(summary.rows.find((r) => r.name === "Rohit")?.count).toBe(1);
  });

  it("ignores a name tagged that isn't one of the four known household members", () => {
    const summary = buildBusiestWeekSummary(
      [],
      [],
      [calendarEvent({ people: ["Grandma"] })],
      [],
      WEEK_START,
      WEEK_END,
    );
    expect(summary.rows.every((r) => r.count === 0)).toBe(true);
  });

  it("counts manual events and recurring occurrences too", () => {
    const summary = buildBusiestWeekSummary(
      [],
      [],
      [calendarEvent({ people: ["Rohit"] })],
      [recurringOccurrence({ people: ["Ahaana"] })],
      WEEK_START,
      WEEK_END,
    );
    expect(summary.rows.find((r) => r.name === "Rohit")?.count).toBe(1);
    expect(summary.rows.find((r) => r.name === "Ahaana")?.count).toBe(1);
  });

  it("ties every person at the max count when they're equal, and 0 items means an empty tie list", () => {
    const tied = buildBusiestWeekSummary(
      [],
      [],
      [
        calendarEvent({ id: "e1", people: ["Rohit"] }),
        calendarEvent({ id: "e2", people: ["Ahaana"] }),
      ],
      [],
      WEEK_START,
      WEEK_END,
    );
    expect(tied.busiestNames.sort()).toEqual(["Ahaana", "Rohit"]);

    const empty = buildBusiestWeekSummary([], [], [], [], WEEK_START, WEEK_END);
    expect(empty.busiestNames).toEqual([]);
  });
});

describe("describeBusiestWeek", () => {
  it("names a single busiest person with a correctly pluralized count", () => {
    const summary = buildBusiestWeekSummary(
      [],
      [schoolItem()],
      [],
      [],
      WEEK_START,
      WEEK_END,
    );
    expect(describeBusiestWeek(summary)).toBe(
      "Ahaana has the busiest week ahead — 1 thing on the calendar.",
    );
  });

  it("joins two tied names with 'and', alphabetically", () => {
    const summary = buildBusiestWeekSummary(
      [],
      [],
      [
        calendarEvent({ id: "e1", people: ["Rohit"] }),
        calendarEvent({ id: "e2", people: ["Ahaana"] }),
      ],
      [],
      WEEK_START,
      WEEK_END,
    );
    expect(describeBusiestWeek(summary)).toBe(
      "Ahaana and Rohit have the busiest week ahead — 1 thing on the calendar.",
    );
  });

  it("falls back to a quiet-week message when nobody has anything", () => {
    const summary = buildBusiestWeekSummary(
      [],
      [],
      [],
      [],
      WEEK_START,
      WEEK_END,
    );
    expect(describeBusiestWeek(summary)).toBe(
      "A quiet week ahead — nothing stacking up for anyone yet.",
    );
  });
});

describe("weekAheadRange", () => {
  it("on a non-Sunday, matches the Monday-start week containing today", () => {
    // 2026-09-02 is a Wednesday.
    expect(weekAheadRange("2026-09-02")).toEqual({
      weekStart: "2026-08-31",
      weekEnd: "2026-09-06",
    });
  });

  it("on a Monday, matches that same week (today is the start)", () => {
    expect(weekAheadRange("2026-08-31")).toEqual({
      weekStart: "2026-08-31",
      weekEnd: "2026-09-06",
    });
  });

  it("on a Sunday, looks ahead to next week instead of the one that's basically over", () => {
    // 2026-08-30 is a Sunday -- the last day of the Aug 24-30 week.
    expect(weekAheadRange("2026-08-30")).toEqual({
      weekStart: "2026-08-31",
      weekEnd: "2026-09-06",
    });
  });
});
