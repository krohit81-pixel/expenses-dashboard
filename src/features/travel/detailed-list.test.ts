import { describe, expect, it } from "vitest";

import { buildDetailedGroups, type VisibilityFilter } from "./detailed-list";
import type { SchoolCalendarItem } from "./school-items";
import type { CalendarEvent } from "@/services/CalendarEventService";
import type { Trip } from "@/services/TripService";

const ALL_VISIBLE: VisibilityFilter = {
  ahaana: true,
  rohana: true,
  travel: true,
  rohit: true,
  aradhana: true,
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
      ...ALL_VISIBLE,
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
      rohit: false,
      aradhana: false,
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

  it("merges manual calendar events in, unaffected by Ahaana/Rohana/Travel", () => {
    const calendarEvents: CalendarEvent[] = [
      {
        id: "e1",
        title: "Dinner with the Sharmas",
        tag: "event",
        people: [],
        startDate: "2026-07-20",
        endDate: "2026-07-20",
        notes: null,
      },
    ];
    const groups = buildDetailedGroups(
      trips,
      schoolItems,
      {
        ahaana: false,
        rohana: false,
        travel: false,
        rohit: true,
        aradhana: true,
      },
      calendarEvents,
    );
    const allItems = groups.flatMap((g) => g.items);
    expect(allItems).toHaveLength(1);
    expect(allItems[0]).toMatchObject({
      kind: "manual",
      title: "Dinner with the Sharmas",
      tag: "event",
    });
  });

  it("hides a trip tagged only to a hidden person", () => {
    // t1 is tagged ["Rohit", "Ahaana"] — Ahaana isn't a rohit/aradhana
    // filter target, so it doesn't keep the trip visible on its own;
    // turning off Rohit hides it.
    const rohitOnlyTrip: Trip[] = [{ ...trips[0], travelerNames: ["Rohit"] }];
    const groups = buildDetailedGroups(rohitOnlyTrip, [], {
      ...ALL_VISIBLE,
      rohit: false,
    });
    expect(groups.flatMap((g) => g.items)).toHaveLength(0);
  });

  it("keeps a trip visible if at least one tagged person is still visible", () => {
    // Tagged both Rohit and Aradhana — hiding Rohit alone shouldn't
    // hide the trip, since Aradhana is still visible.
    const bothTagged: Trip[] = [
      { ...trips[0], travelerNames: ["Rohit", "Aradhana"] },
    ];
    const groups = buildDetailedGroups(bothTagged, [], {
      ...ALL_VISIBLE,
      rohit: false,
    });
    expect(groups.flatMap((g) => g.items)).toHaveLength(1);
  });

  it("keeps an untagged manual event visible even when both person filters are off", () => {
    const calendarEvents: CalendarEvent[] = [
      {
        id: "e1",
        title: "Untagged reminder",
        tag: "event",
        people: [],
        startDate: "2026-07-20",
        endDate: "2026-07-20",
        notes: null,
      },
    ];
    const groups = buildDetailedGroups(
      [],
      [],
      { ...ALL_VISIBLE, rohit: false, aradhana: false },
      calendarEvents,
    );
    expect(groups.flatMap((g) => g.items)).toHaveLength(1);
  });

  it("hides a manual event tagged only to a hidden person", () => {
    const calendarEvents: CalendarEvent[] = [
      {
        id: "e1",
        title: "Rohit's dentist appointment",
        tag: "event",
        people: ["Rohit"],
        startDate: "2026-07-20",
        endDate: "2026-07-20",
        notes: null,
      },
    ];
    const groups = buildDetailedGroups(
      [],
      [],
      { ...ALL_VISIBLE, rohit: false },
      calendarEvents,
    );
    expect(groups.flatMap((g) => g.items)).toHaveLength(0);
  });
});
