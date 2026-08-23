import { describe, expect, it } from "vitest";

import {
  expandAhaanaOccurrences,
  getAhaanaWeekDates,
} from "./ahaana-activities";
import type { AhaanaActivity } from "@/services/AhaanaActivityService";

function activity(overrides: Partial<AhaanaActivity> = {}): AhaanaActivity {
  return {
    id: "activity-1",
    title: "French",
    category: "class",
    daysOfWeek: [2, 5], // Tue, Fri
    startTime: "17:00",
    endTime: "18:00",
    startDate: "2026-08-10",
    endDate: "2026-09-18",
    planNotes: null,
    active: true,
    remindEnabled: false,
    remindLeadDays: 0,
    remindLeadHours: null,
    ...overrides,
  };
}

describe("expandAhaanaOccurrences", () => {
  it("produces one occurrence per matching weekday in range", () => {
    // 2026-08-10 is a Monday; the first Tue/Fri after it are 8/11 and 8/14.
    const occurrences = expandAhaanaOccurrences(
      [activity()],
      "2026-08-10",
      "2026-08-16",
    );
    expect(occurrences.map((o) => o.date)).toEqual([
      "2026-08-11",
      "2026-08-14",
    ]);
  });

  it("carries the activity's fields onto each occurrence", () => {
    const occurrences = expandAhaanaOccurrences(
      [activity({ planNotes: "Focus on verb conjugation" })],
      "2026-08-10",
      "2026-08-16",
    );
    expect(occurrences[0]).toMatchObject({
      activityId: "activity-1",
      title: "French",
      category: "class",
      startTime: "17:00",
      endTime: "18:00",
      planNotes: "Focus on verb conjugation",
    });
  });

  it("never produces an occurrence outside the activity's own start/end date, even if the query range is wider", () => {
    const occurrences = expandAhaanaOccurrences(
      [activity({ startDate: "2026-08-10", endDate: "2026-08-12" })],
      "2026-08-01",
      "2026-08-31",
    );
    expect(occurrences.map((o) => o.date)).toEqual(["2026-08-11"]);
  });

  it("sorts by date, then start time, then key", () => {
    const occurrences = expandAhaanaOccurrences(
      [
        activity({ id: "b", daysOfWeek: [2], startTime: "18:00" }),
        activity({ id: "a", daysOfWeek: [2], startTime: "09:00" }),
      ],
      "2026-08-11",
      "2026-08-11",
    );
    expect(occurrences.map((o) => o.activityId)).toEqual(["a", "b"]);
  });

  it("produces nothing for an empty activity list", () => {
    expect(expandAhaanaOccurrences([], "2026-08-01", "2026-08-31")).toEqual([]);
  });
});

describe("getAhaanaWeekDates", () => {
  it("returns Sunday-Saturday when the reference date is itself a Sunday", () => {
    // 2026-08-23 is a Sunday.
    expect(getAhaanaWeekDates("2026-08-23")).toEqual([
      "2026-08-23",
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
      "2026-08-29",
    ]);
  });

  it("returns the same Sunday-Saturday week for any day within it", () => {
    // 2026-08-26 (Wed) falls in the same week as the Sunday above.
    expect(getAhaanaWeekDates("2026-08-26")).toEqual([
      "2026-08-23",
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
      "2026-08-29",
    ]);
  });

  it("rolls back to the previous Sunday when the reference date is a Saturday", () => {
    // 2026-08-22 is a Saturday, the last day of the PRIOR Sun-Sat week.
    expect(getAhaanaWeekDates("2026-08-22")).toEqual([
      "2026-08-16",
      "2026-08-17",
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
    ]);
  });
});
