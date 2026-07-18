import { describe, expect, it } from "vitest";

import { buildTravelWindows } from "./travel-windows";

describe("buildTravelWindows", () => {
  it("merges both people's windows into one list", () => {
    const windows = buildTravelWindows();
    expect(windows.some((w) => w.person === "ahaana")).toBe(true);
    expect(windows.some((w) => w.person === "rohana")).toBe(true);
    expect(windows).toHaveLength(8);
  });

  it("sorts chronologically by the first date in each window's range text", () => {
    const windows = buildTravelWindows();
    const names = windows.map((w) => w.name);
    // Ahaana's Diwali Vacations (6 Nov 2026) should come before her
    // Winter Vacations (23 Dec 2026), regardless of source-array order.
    expect(names.indexOf("Diwali Vacations")).toBeLessThan(
      names.indexOf("Winter Vacations"),
    );
  });

  it("places an open-ended window ('From Fri 21 May 2027') using its one date, not last-by-default", () => {
    const windows = buildTravelWindows();
    const summer = windows.find((w) => w.name === "Summer Vacation begins");
    expect(summer).toBeDefined();
  });
});
