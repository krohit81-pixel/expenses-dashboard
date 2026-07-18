import { describe, expect, it } from "vitest";

import { parseMonthHeading, resolveSchoolEventRange } from "./school-calendar";

describe("parseMonthHeading", () => {
  it("parses a standard heading", () => {
    expect(parseMonthHeading("July 2026")).toEqual({
      monthIndex: 6,
      year: 2026,
    });
  });

  it("parses every month name used in the real data", () => {
    expect(parseMonthHeading("January 2027").monthIndex).toBe(0);
    expect(parseMonthHeading("December 2026").monthIndex).toBe(11);
  });

  it("throws on an unrecognized heading rather than silently misplacing an event", () => {
    expect(() => parseMonthHeading("Not a month")).toThrow();
  });
});

describe("resolveSchoolEventRange", () => {
  it("resolves a single-day field", () => {
    expect(resolveSchoolEventRange("9", "July 2026")).toEqual({
      startDate: "2026-07-09",
      endDate: "2026-07-09",
    });
  });

  it("resolves a same-month range (Ahaana's Diwali Vacations, '6–17' under November 2026)", () => {
    expect(resolveSchoolEventRange("6–17", "November 2026")).toEqual({
      startDate: "2026-11-06",
      endDate: "2026-11-17",
    });
  });

  it("rolls a range into the next month when the end day is smaller (Ahaana's Winter Vacations, '23–3' under December 2026)", () => {
    expect(resolveSchoolEventRange("23–3", "December 2026")).toEqual({
      startDate: "2026-12-23",
      endDate: "2027-01-03",
    });
  });

  it("rolls a December range into January of the following year, not the same year", () => {
    const { endDate } = resolveSchoolEventRange("23–3", "December 2026");
    expect(endDate.startsWith("2027-01")).toBe(true);
  });

  it("handles a same-month range that stays within a single month even though the end day is large (Rohana's Semester break, '6–31' under December 2026)", () => {
    expect(resolveSchoolEventRange("6–31", "December 2026")).toEqual({
      startDate: "2026-12-06",
      endDate: "2026-12-31",
    });
  });

  it("handles a plain hyphen the same as an en dash", () => {
    expect(resolveSchoolEventRange("6-17", "November 2026")).toEqual({
      startDate: "2026-11-06",
      endDate: "2026-11-17",
    });
  });
});
