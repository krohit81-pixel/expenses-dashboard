import { describe, expect, it } from "vitest";

import {
  computeAhaanaWeeklyStats,
  buildAhaanaRecentLogEntries,
} from "./progress-stats";
import type { AhaanaActivity } from "@/services/AhaanaActivityService";
import type { AhaanaActivityLog } from "@/services/AhaanaActivityLogService";

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
    remindEnabled: true,
    remindLeadDays: 1,
    remindLeadHours: null,
    alternateWeeks: false,
    ...overrides,
  };
}

function activityLog(
  overrides: Partial<AhaanaActivityLog> = {},
): AhaanaActivityLog {
  return {
    id: "log-1",
    activityId: "activity-1",
    occurrenceDate: "2026-08-18",
    completedAt: "2026-08-18T12:00:00Z",
    coveredNotes: "Covered chapters 3-4",
    nextNotes: "Chapter 5 next",
    ...overrides,
  };
}

describe("computeAhaanaWeeklyStats", () => {
  it("returns weeksBack rows, oldest first, ending with the week containing asOf", () => {
    const stats = computeAhaanaWeeklyStats([activity()], [], 3, "2026-08-23");
    expect(stats).toHaveLength(3);
    expect(stats[0].weekStart).toBe("2026-08-03");
    expect(stats[1].weekStart).toBe("2026-08-10");
    expect(stats[2].weekStart).toBe("2026-08-17"); // week containing 2026-08-23 (Sunday)
    expect(stats[2].weekEnd).toBe("2026-08-23");
  });

  it("counts scheduled occurrences and completed logs correctly", () => {
    // Week of 2026-08-17 (Mon) - 2026-08-23 (Sun): activity() fires
    // Tue 8/18 and Fri 8/21 — two scheduled, one logged.
    const stats = computeAhaanaWeeklyStats(
      [activity()],
      [activityLog({ occurrenceDate: "2026-08-18" })],
      1,
      "2026-08-23",
    );
    expect(stats).toHaveLength(1);
    expect(stats[0].scheduled).toBe(2);
    expect(stats[0].completed).toBe(1);
    expect(stats[0].completionRate).toBe(50);
  });

  it("reports 0% (not NaN) for a week with nothing scheduled", () => {
    const stats = computeAhaanaWeeklyStats(
      [activity({ startDate: "2026-09-01", endDate: "2026-09-18" })],
      [],
      1,
      "2026-08-23",
    );
    expect(stats[0].scheduled).toBe(0);
    expect(stats[0].completed).toBe(0);
    expect(stats[0].completionRate).toBe(0);
  });
});

describe("buildAhaanaRecentLogEntries", () => {
  it("joins log rows with their activity's title/category, newest first", () => {
    const entries = buildAhaanaRecentLogEntries(
      [activity({ id: "a1", title: "French", category: "class" })],
      [
        activityLog({
          id: "l1",
          activityId: "a1",
          occurrenceDate: "2026-08-11",
        }),
        activityLog({
          id: "l2",
          activityId: "a1",
          occurrenceDate: "2026-08-18",
        }),
      ],
      10,
    );
    expect(entries).toHaveLength(2);
    expect(entries[0].date).toBe("2026-08-18");
    expect(entries[0].title).toBe("French");
    expect(entries[0].category).toBe("class");
    expect(entries[1].date).toBe("2026-08-11");
  });

  it("respects the limit", () => {
    const logs = ["2026-08-04", "2026-08-11", "2026-08-18"].map((date) =>
      activityLog({ id: date, occurrenceDate: date }),
    );
    const entries = buildAhaanaRecentLogEntries([activity()], logs, 2);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.date)).toEqual(["2026-08-18", "2026-08-11"]);
  });

  it("silently drops a log whose activity no longer exists", () => {
    const entries = buildAhaanaRecentLogEntries(
      [],
      [activityLog({ activityId: "gone" })],
      10,
    );
    expect(entries).toHaveLength(0);
  });
});
