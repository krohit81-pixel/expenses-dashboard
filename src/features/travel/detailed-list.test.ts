import { describe, expect, it } from "vitest";

import { buildDetailedGroups, type VisibilityFilter } from "./detailed-list";
import type { SchoolCalendarItem } from "./school-items";
import type { Trip } from "@/services/TripService";

const ALL_VISIBLE: VisibilityFilter = {
  ahaana: true,
  rohana: true,
  travel: true,
};

const schoolItems: SchoolCalendarItem[] = [
  {
    person: "ahaana",
    title: "School reopens",
    tag: "event",
    startDate: "2026-07-13",
    endDate: "2026-07-13",
  },
  {
    person: "rohana",
    title: "National Day",
    tag: "holiday",
    startDate: "2026-08-09",
    endDate: "2026-08-09",
  },
];

const trips: Trip[] = [
  {
    id: "t1",
    destination: "Goa, India",
    startDate: "2026-07-25",
    endDate: "2026-07-28",
    flight: "6E 5123",
    travelerNames: ["Rohit", "Ahaana"],
    notes: null,
  },
];

describe("buildDetailedGroups", () => {
  it("merges school items and trips into month groups, chronologically", () => {
    const groups = buildDetailedGroups(trips, schoolItems, ALL_VISIBLE);
    expect(groups.map((g) => g.monthKey)).toEqual(["2026-07", "2026-08"]);
    expect(groups[0].items.map((i) => i.kind)).toEqual(["school", "travel"]);
  });

  it("respects the travel visibility toggle", () => {
    const groups = buildDetailedGroups(trips, schoolItems, {
      ...ALL_VISIBLE,
      travel: false,
    });
    const allItems = groups.flatMap((g) => g.items);
    expect(allItems.some((i) => i.kind === "travel")).toBe(false);
    expect(allItems).toHaveLength(2);
  });

  it("respects the per-person visibility toggles independently", () => {
    const groups = buildDetailedGroups(trips, schoolItems, {
      ahaana: false,
      rohana: true,
      travel: true,
    });
    const allItems = groups.flatMap((g) => g.items);
    expect(
      allItems.some((i) => i.kind === "school" && i.person === "ahaana"),
    ).toBe(false);
    expect(
      allItems.some((i) => i.kind === "school" && i.person === "rohana"),
    ).toBe(true);
  });

  it("returns no groups when every filter is off", () => {
    const groups = buildDetailedGroups(trips, schoolItems, {
      ahaana: false,
      rohana: false,
      travel: false,
    });
    expect(groups).toHaveLength(0);
  });

  it("carries traveller names and flight through onto the travel item", () => {
    const groups = buildDetailedGroups(trips, [], ALL_VISIBLE);
    const travelItem = groups[0].items[0];
    expect(travelItem).toMatchObject({
      kind: "travel",
      destination: "Goa, India",
      flight: "6E 5123",
      travelerNames: ["Rohit", "Ahaana"],
    });
  });
});
