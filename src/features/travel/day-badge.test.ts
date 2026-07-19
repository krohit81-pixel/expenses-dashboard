import { describe, expect, it } from "vitest";

import { dayBadge } from "./day-badge";

describe("dayBadge", () => {
  it("returns a single day + weekday when start and end match", () => {
    expect(dayBadge("2026-07-18", "2026-07-18")).toEqual({
      kind: "single",
      day: "18",
      weekday: "Sat",
    });
  });

  it("returns a same-month range as a day–day label", () => {
    expect(dayBadge("2026-07-25", "2026-07-28")).toEqual({
      kind: "range",
      label: "25–28",
    });
  });

  it("spells out both months for a range that crosses a month boundary", () => {
    // The reported case — a trip departing July 31st and returning
    // August 4th used to render as the ambiguous "31–4".
    expect(dayBadge("2026-07-31", "2026-08-04")).toEqual({
      kind: "cross-month",
      startLabel: "Jul 31",
      endLabel: "Aug 4",
    });
  });

  it("spells out both months for a range that crosses a year boundary", () => {
    expect(dayBadge("2026-12-30", "2027-01-02")).toEqual({
      kind: "cross-month",
      startLabel: "Dec 30",
      endLabel: "Jan 2",
    });
  });
});
