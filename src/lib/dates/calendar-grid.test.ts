import { describe, expect, it } from "vitest";

import { getMonthGridDates, getWeekDates, isInMonth } from "./calendar-grid";

describe("getMonthGridDates", () => {
  it("returns 42 dates", () => {
    expect(getMonthGridDates("2026-07")).toHaveLength(42);
  });

  it("starts on the Monday on/before the 1st — July 2026 starts on a Wednesday, so the grid starts two days earlier", () => {
    const dates = getMonthGridDates("2026-07");
    expect(dates[0]).toBe("2026-06-29");
    expect(dates[2]).toBe("2026-07-01");
  });

  it("starts exactly on the 1st when the month already begins on a Monday", () => {
    // 2026-06-01 is a Monday.
    const dates = getMonthGridDates("2026-06");
    expect(dates[0]).toBe("2026-06-01");
  });

  it("includes trailing days from the next month to fill 42 cells", () => {
    const dates = getMonthGridDates("2026-07");
    expect(dates[dates.length - 1]).toBe("2026-08-09");
  });

  it("is consecutive with no gaps or repeats", () => {
    const dates = getMonthGridDates("2026-11");
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(`${dates[i - 1]}T00:00:00Z`);
      const curr = new Date(`${dates[i]}T00:00:00Z`);
      expect(curr.getTime() - prev.getTime()).toBe(24 * 60 * 60 * 1000);
    }
  });

  it("rolls correctly across a year boundary (December -> January)", () => {
    const dates = getMonthGridDates("2026-12");
    expect(dates.some((d) => d.startsWith("2027-01"))).toBe(true);
    expect(dates[dates.length - 1] >= "2027-01-01").toBe(true);
  });
});

describe("isInMonth", () => {
  it("true for a date inside the month", () => {
    expect(isInMonth("2026-07-15", "2026-07")).toBe(true);
  });

  it("false for a date outside the month", () => {
    expect(isInMonth("2026-08-01", "2026-07")).toBe(false);
  });
});

describe("getWeekDates", () => {
  it("returns 7 consecutive dates", () => {
    expect(getWeekDates("2026-08-12")).toHaveLength(7);
  });

  it("starts on the Monday on/before the reference date — 2026-08-12 is a Wednesday", () => {
    const dates = getWeekDates("2026-08-12");
    expect(dates[0]).toBe("2026-08-10");
    expect(dates[6]).toBe("2026-08-16");
  });

  it("stays put when the reference date is already a Monday", () => {
    // 2026-08-10 is a Monday.
    const dates = getWeekDates("2026-08-10");
    expect(dates[0]).toBe("2026-08-10");
  });

  it("rolls correctly across a month boundary", () => {
    // 2026-08-31 is a Monday.
    const dates = getWeekDates("2026-08-31");
    expect(dates[0]).toBe("2026-08-31");
    expect(dates[6]).toBe("2026-09-06");
  });
});
