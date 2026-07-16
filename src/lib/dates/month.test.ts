import { describe, expect, it } from "vitest";

import {
  currentMonth,
  isValidMonth,
  monthLabel,
  monthOptions,
  shiftMonth,
} from "./month";

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
