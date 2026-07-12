import { describe, expect, it } from "vitest";

import {
  computeNextOccurrence,
  occurrencesUpTo,
  setDayOfMonth,
} from "./recurrence";

describe("setDayOfMonth", () => {
  it("replaces the day, keeping year and month", () => {
    expect(setDayOfMonth("2026-07-12", 25)).toBe("2026-07-25");
  });

  it("clamps to the last day of a short month", () => {
    expect(setDayOfMonth("2026-02-12", 31)).toBe("2026-02-28");
  });

  it("clamps correctly in a leap-year February", () => {
    expect(setDayOfMonth("2024-02-12", 30)).toBe("2024-02-29");
  });
});

describe("computeNextOccurrence", () => {
  it("adds days", () => {
    expect(computeNextOccurrence("2025-03-15", "2025-03-15", "daily", 1)).toBe(
      "2025-03-16",
    );
    expect(computeNextOccurrence("2025-03-15", "2025-03-15", "daily", 10)).toBe(
      "2025-03-25",
    );
  });

  it("adds weeks", () => {
    expect(computeNextOccurrence("2025-03-15", "2025-03-15", "weekly", 1)).toBe(
      "2025-03-22",
    );
    expect(computeNextOccurrence("2025-03-15", "2025-03-15", "weekly", 2)).toBe(
      "2025-03-29",
    );
  });

  it("adds months on a mid-month day with no clamping needed", () => {
    expect(
      computeNextOccurrence("2025-06-15", "2025-06-15", "monthly", 1),
    ).toBe("2025-07-15");
  });

  it("does not permanently decay after clamping through a short month", () => {
    // The classic bug: naive "add 1 month" repeatedly from a clamped
    // result drifts a month-end recurrence down to the 28th forever.
    // Anchoring against the original day-of-month should recover.
    let occurrence = "2025-01-31";
    const startsOn = "2025-01-31";

    occurrence = computeNextOccurrence(startsOn, occurrence, "monthly", 1);
    expect(occurrence).toBe("2025-02-28"); // Feb has 28 days in 2025

    occurrence = computeNextOccurrence(startsOn, occurrence, "monthly", 1);
    expect(occurrence).toBe("2025-03-31"); // recovers to 31, not 2025-03-28

    occurrence = computeNextOccurrence(startsOn, occurrence, "monthly", 1);
    expect(occurrence).toBe("2025-04-30"); // April has 30 days

    occurrence = computeNextOccurrence(startsOn, occurrence, "monthly", 1);
    expect(occurrence).toBe("2025-05-31");
  });

  it("clamps into a leap-year February correctly", () => {
    expect(
      computeNextOccurrence("2024-01-31", "2024-01-31", "monthly", 1),
    ).toBe("2024-02-29");
  });

  it("adds quarters", () => {
    expect(
      computeNextOccurrence("2025-01-31", "2025-01-31", "quarterly", 1),
    ).toBe("2025-04-30");
  });

  it("adds years, clamping Feb 29 into a non-leap year", () => {
    expect(computeNextOccurrence("2024-02-29", "2024-02-29", "yearly", 1)).toBe(
      "2025-02-28",
    );
  });

  it("handles interval_count greater than 1", () => {
    expect(
      computeNextOccurrence("2025-01-15", "2025-01-15", "monthly", 3),
    ).toBe("2025-04-15");
  });

  it("rolls over year boundaries", () => {
    expect(
      computeNextOccurrence("2025-11-30", "2025-11-30", "monthly", 2),
    ).toBe("2026-01-30");
  });
});

describe("occurrencesUpTo", () => {
  it("generates every occurrence in range, inclusive of both ends", () => {
    const result = occurrencesUpTo(
      "2025-01-01",
      "monthly",
      1,
      "2025-01-01",
      "2025-04-01",
      null,
    );
    expect(result).toEqual([
      "2025-01-01",
      "2025-02-01",
      "2025-03-01",
      "2025-04-01",
    ]);
  });

  it("stops at endsOn even if that's before until", () => {
    const result = occurrencesUpTo(
      "2025-01-01",
      "monthly",
      1,
      "2025-01-01",
      "2025-06-01",
      "2025-03-01",
    );
    expect(result).toEqual(["2025-01-01", "2025-02-01", "2025-03-01"]);
  });

  it("returns an empty array when from is already after until", () => {
    const result = occurrencesUpTo(
      "2025-01-01",
      "monthly",
      1,
      "2025-05-01",
      "2025-04-01",
      null,
    );
    expect(result).toEqual([]);
  });
});
