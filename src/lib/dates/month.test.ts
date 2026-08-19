import { describe, expect, it } from "vitest";

import {
  currentCycleMonth,
  currentMonth,
  cycleWindowEnd,
  isValidMonth,
  monthLabel,
  monthOptions,
  shiftMonth,
} from "./month";

function utcDate(year: number, month1Indexed: number, day: number): Date {
  return new Date(Date.UTC(year, month1Indexed - 1, day));
}

describe("shiftMonth", () => {
  it("advances within the same year", () => {
    expect(shiftMonth("2026-07", 1)).toBe("2026-08");
  });

  it("goes back within the same year", () => {
    expect(shiftMonth("2026-07", -1)).toBe("2026-06");
  });

  it("rolls over December to January of the next year", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("rolls back January to December of the previous year", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("handles a multi-month shift crossing a year boundary", () => {
    expect(shiftMonth("2026-11", 3)).toBe("2027-02");
  });
});

describe("monthLabel", () => {
  it("formats a month string as a readable label", () => {
    expect(monthLabel("2026-08")).toBe("August 2026");
  });

  it("doesn't shift the month due to timezone conversion", () => {
    // The classic footgun: new Date("2026-01-01") interpreted in a
    // negative-UTC-offset local timezone can print as December — this
    // guards against that regressing.
    expect(monthLabel("2026-01")).toBe("January 2026");
  });
});

describe("isValidMonth", () => {
  it("accepts a well-formed month string", () => {
    expect(isValidMonth("2026-08")).toBe(true);
  });

  it("rejects malformed or missing values", () => {
    expect(isValidMonth("2026-8")).toBe(false);
    expect(isValidMonth("not-a-month")).toBe(false);
    expect(isValidMonth(undefined)).toBe(false);
    expect(isValidMonth("")).toBe(false);
  });
});

describe("currentCycleMonth", () => {
  it("stays on the calendar month for day 24 (still Planning)", () => {
    expect(currentCycleMonth(utcDate(2026, 7, 24))).toBe("2026-07");
  });

  it("rolls to next month starting day 25 (Execution begins)", () => {
    expect(currentCycleMonth(utcDate(2026, 7, 25))).toBe("2026-08");
  });

  it("stays rolled over through the end of the month", () => {
    expect(currentCycleMonth(utcDate(2026, 7, 31))).toBe("2026-08");
  });

  it("matches the calendar month again for days 1-5 (still Execution, but already next month)", () => {
    expect(currentCycleMonth(utcDate(2026, 8, 2))).toBe("2026-08");
  });

  it("matches the calendar month through Tracking and Planning (days 6-24)", () => {
    expect(currentCycleMonth(utcDate(2026, 8, 10))).toBe("2026-08");
    expect(currentCycleMonth(utcDate(2026, 8, 20))).toBe("2026-08");
  });

  it("rolls over the calendar year correctly (December into January)", () => {
    expect(currentCycleMonth(utcDate(2026, 12, 25))).toBe("2027-01");
  });
});

describe("cycleWindowEnd", () => {
  it("is the 24th of the cycle's own month", () => {
    expect(cycleWindowEnd("2026-08")).toBe("2026-08-24");
  });

  it("agrees with currentCycleMonth's own rollover boundary", () => {
    // The day after cycleWindowEnd's date should already belong to the
    // next cycle, per currentCycleMonth's own rollover rule.
    const cycleMonth = "2026-07";
    const end = cycleWindowEnd(cycleMonth);
    const dayAfter = utcDate(2026, 7, 25);
    expect(end).toBe("2026-07-24");
    expect(currentCycleMonth(dayAfter)).toBe(shiftMonth(cycleMonth, 1));
  });

  it("handles February and year-end without special-casing", () => {
    expect(cycleWindowEnd("2026-02")).toBe("2026-02-24");
    expect(cycleWindowEnd("2026-12")).toBe("2026-12-24");
  });
});

describe("monthOptions", () => {
  it("returns the requested count, starting from this month by default", () => {
    const options = monthOptions(3);
    expect(options).toHaveLength(3);
    expect(options[0]?.value).toBe(currentMonth());
  });

  it("each option's value and label agree on the same month", () => {
    const options = monthOptions(4);
    options.forEach((opt) => {
      const [, expectedMonthNum] = opt.value.split("-");
      const labelMonthIndex =
        new Date(`${opt.value}-01T00:00:00Z`).getUTCMonth() + 1;
      expect(Number(expectedMonthNum)).toBe(labelMonthIndex);
    });
  });

  it("respects a startOffset, e.g. starting from next month", () => {
    const fromNow = monthOptions(1, 0);
    const fromNext = monthOptions(1, 1);
    expect(fromNext[0]?.value).toBe(shiftMonth(fromNow[0]!.value, 1));
  });

  it("produces consecutive months with no gaps or duplicates", () => {
    const options = monthOptions(6);
    const values = options.map((o) => o.value);
    expect(new Set(values).size).toBe(6);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBe(shiftMonth(values[i - 1]!, 1));
    }
  });
});
