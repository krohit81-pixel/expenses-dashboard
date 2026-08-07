import { describe, expect, it } from "vitest";

import {
  expandRecurringOccurrences,
  widestRuleRange,
} from "./recurring-calendar-events";
import type { RecurringCalendarEvent } from "@/services/RecurringCalendarEventService";

function rule(
  overrides: Partial<RecurringCalendarEvent> = {},
): RecurringCalendarEvent {
  return {
    id: "rule-1",
    title: "Calculus",
    people: ["Rohana"],
    mode: "Offline",
    daysOfWeek: [2, 5], // Tue, Fri
    startTime: "08:00",
    endTime: "09:30",
    startDate: "2026-08-10",
    endDate: "2026-09-18",
    notes: null,
    ...overrides,
  };
}

describe("expandRecurringOccurrences", () => {
  it("produces one occurrence per matching weekday in range", () => {
    // 2026-08-10 is a Monday; the first Tue/Fri after it are 8/11 and 8/14.
    const occurrences = expandRecurringOccurrences(
      [rule()],
      "2026-08-10",
      "2026-08-16",
    );
    expect(occurrences.map((o) => o.date)).toEqual([
      "2026-08-11",
      "2026-08-14",
    ]);
  });

  it("carries the rule's fields onto each occurrence", () => {
    const occurrences = expandRecurringOccurrences(
      [rule()],
      "2026-08-10",
      "2026-08-16",
    );
    expect(occurrences[0]).toMatchObject({
      ruleId: "rule-1",
      title: "Calculus",
      people: ["Rohana"],
      mode: "Offline",
      startTime: "08:00",
      endTime: "09:30",
    });
  });

  it("never produces an occurrence outside the rule's own start/end date, even if the query range is wider", () => {
    const occurrences = expandRecurringOccurrences(
      [rule({ startDate: "2026-08-10", endDate: "2026-08-14" })],
      "2026-01-01",
      "2026-12-31",
    );
    expect(occurrences.map((o) => o.date)).toEqual([
      "2026-08-11",
      "2026-08-14",
    ]);
  });

  it("never produces an occurrence outside the query range, even if the rule's own bound is wider", () => {
    const occurrences = expandRecurringOccurrences(
      [rule()],
      "2026-08-12",
      "2026-08-13",
    );
    expect(occurrences).toEqual([]);
  });

  it("returns nothing when the rule's range and the query range don't overlap at all", () => {
    const occurrences = expandRecurringOccurrences(
      [rule({ startDate: "2026-01-01", endDate: "2026-01-31" })],
      "2026-08-01",
      "2026-08-31",
    );
    expect(occurrences).toEqual([]);
  });

  it("supports multiple days of week on one rule (Tue + Fri, same time)", () => {
    const occurrences = expandRecurringOccurrences(
      [rule({ daysOfWeek: [2, 5] })],
      "2026-08-10",
      "2026-08-14",
    );
    expect(occurrences).toHaveLength(2);
    expect(occurrences[0].date).toBe("2026-08-11"); // Tue
    expect(occurrences[1].date).toBe("2026-08-14"); // Fri
  });

  it("expands multiple rules and sorts by date, then start time", () => {
    const occurrences = expandRecurringOccurrences(
      [
        rule({
          id: "econometrics",
          title: "Econometrics",
          daysOfWeek: [2],
          startTime: "12:00",
          endTime: "13:30",
        }),
        rule({
          id: "calculus",
          title: "Calculus",
          daysOfWeek: [2],
          startTime: "08:00",
          endTime: "09:30",
        }),
      ],
      "2026-08-11",
      "2026-08-11",
    );
    expect(occurrences.map((o) => o.title)).toEqual([
      "Calculus",
      "Econometrics",
    ]);
  });

  it("produces a stable, unique key per rule+date", () => {
    const occurrences = expandRecurringOccurrences(
      [rule()],
      "2026-08-10",
      "2026-08-16",
    );
    const keys = new Set(occurrences.map((o) => o.key));
    expect(keys.size).toBe(occurrences.length);
  });
});

describe("widestRuleRange", () => {
  it("returns null for an empty rule list", () => {
    expect(widestRuleRange([])).toBeNull();
  });

  it("returns the earliest start and latest end across all rules", () => {
    const range = widestRuleRange([
      rule({ startDate: "2026-08-10", endDate: "2026-09-18" }),
      rule({ id: "ai", startDate: "2026-08-14", endDate: "2026-11-13" }),
    ]);
    expect(range).toEqual({ start: "2026-08-10", end: "2026-11-13" });
  });
});
