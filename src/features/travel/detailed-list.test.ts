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

  it("respects the travel visibility toggle when none of the trip's tagged people are visible either", () => {
    // trips[0] is tagged ["Rohit", "Ahaana"] — since v1.1.7, Travel and
    // the person filters are independent (a tagged person's own chip
    // can reveal a trip even with Travel off), so this only hides the
    // trip if Rohit and Ahaana are also turned off, not from Travel
    // alone. See isTripVisible's tests below for that behavior.
    const groups = buildDetailedGroups(trips, schoolItems, {
      ...ALL_VISIBLE,
      travel: false,
      rohit: false,
      ahaana: false,
    });
    const allItems = groups.flatMap((g) => g.items);
    expect(allItems.some((i) => i.kind === "travel")).toBe(false);
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
    // Empty trips/schoolItems here — this test is isolating the manual
    // event's own independence from every toggle, not re-testing trip
    // visibility (see the isTripVisible-focused tests below for that).
    const groups = buildDetailedGroups(
      [],
      [],
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

  it("shows a trip tagged to a visible person even with Travel off (the reported bug)", () => {
    // This is the exact case reported: a trip tagged only "Rohit",
    // Travel turned off, Rohit still on — it used to disappear
    // entirely because v1.1.6 required Travel AND a visible tagged
    // person; Travel and the person filters are independent now.
    const rohitOnlyTrip: Trip[] = [{ ...trips[0], travelerNames: ["Rohit"] }];
    const groups = buildDetailedGroups(rohitOnlyTrip, [], {
      ...ALL_VISIBLE,
      travel: false,
    });
    expect(groups.flatMap((g) => g.items)).toHaveLength(1);
  });

  it("hides a trip when Travel is off and none of its tagged people are visible", () => {
    const rohitOnlyTrip: Trip[] = [{ ...trips[0], travelerNames: ["Rohit"] }];
    const groups = buildDetailedGroups(rohitOnlyTrip, [], {
      ...ALL_VISIBLE,
      travel: false,
      rohit: false,
    });
    expect(groups.flatMap((g) => g.items)).toHaveLength(0);
  });

  it("Travel on shows every trip regardless of the person filters", () => {
    // Travel means "show every trip" outright — it's not an AND with
    // the person filters, so turning off Rohit/Aradhana/Ahaana/Rohana
    // shouldn't hide a trip while Travel is still on.
    const rohitOnlyTrip: Trip[] = [{ ...trips[0], travelerNames: ["Rohit"] }];
    const groups = buildDetailedGroups(rohitOnlyTrip, [], {
      ...ALL_VISIBLE,
      travel: true,
      rohit: false,
    });
    expect(groups.flatMap((g) => g.items)).toHaveLength(1);
  });

  it("with Travel off, a trip tagged to Ahaana shows when the Ahaana chip is on", () => {
    // The person-filter fallback generalizes to Ahaana/Rohana too, not
    // just Rohit/Aradhana — a trip tagged to Ahaana should surface the
    // same way when Travel is off and her chip is on.
    const ahaanaTrip: Trip[] = [{ ...trips[0], travelerNames: ["Ahaana"] }];
    const groups = buildDetailedGroups(ahaanaTrip, [], {
      ...ALL_VISIBLE,
      travel: false,
      ahaana: true,
    });
    expect(groups.flatMap((g) => g.items)).toHaveLength(1);
  });

  it("with Travel off, a trip tagged only to a custom (untracked) name never shows", () => {
    // No chip governs a name that isn't Rohit/Aradhana/Ahaana/Rohana,
    // so there's nothing to reveal it with once Travel is off.
    const customTrip: Trip[] = [{ ...trips[0], travelerNames: ["Grandma"] }];
    const groups = buildDetailedGroups(customTrip, [], {
      ...ALL_VISIBLE,
      travel: false,
    });
    expect(groups.flatMap((g) => g.items)).toHaveLength(0);
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
