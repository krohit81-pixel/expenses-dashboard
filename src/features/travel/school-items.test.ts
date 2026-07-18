import { describe, expect, it } from "vitest";

import { buildSchoolCalendarItems } from "./school-items";

describe("buildSchoolCalendarItems", () => {
  const items = buildSchoolCalendarItems();

  it("flattens both calendars into a single list", () => {
    expect(items.length).toBeGreaterThan(50);
    expect(items.some((i) => i.person === "ahaana")).toBe(true);
    expect(items.some((i) => i.person === "rohana")).toBe(true);
  });

  it("resolves Ahaana's Diwali Vacations to the expected range", () => {
    const diwali = items.find((i) => i.title === "Diwali Vacations");
    expect(diwali).toMatchObject({
      person: "ahaana",
      startDate: "2026-11-06",
      endDate: "2026-11-17",
      tag: "vacation",
    });
  });

  it("resolves Ahaana's Winter Vacations across the year boundary", () => {
    const winter = items.find((i) => i.title === "Winter Vacations");
    expect(winter).toMatchObject({
      startDate: "2026-12-23",
      endDate: "2027-01-03",
    });
  });

  it("resolves Rohana's Semester break across the year boundary", () => {
    const semBreak = items.find(
      (i) => i.person === "rohana" && i.title === "Semester break",
    );
    expect(semBreak).toMatchObject({
      startDate: "2026-12-06",
      endDate: "2026-12-31",
    });
  });

  it("every item has a valid, non-inverted date range", () => {
    for (const item of items) {
      expect(item.startDate <= item.endDate).toBe(true);
      expect(item.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
