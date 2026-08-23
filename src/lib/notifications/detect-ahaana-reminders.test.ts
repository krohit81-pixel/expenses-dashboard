import { describe, expect, it } from "vitest";

import { detectAhaanaActivityReminders } from "./detect-ahaana-reminders";
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
    remindEnabled: true,
    remindLeadDays: 1,
    ...overrides,
  };
}

describe("detectAhaanaActivityReminders", () => {
  it("fires when today is exactly remindLeadDays before an occurrence", () => {
    // 2026-08-11 (Tue) is the first occurrence on/after 2026-08-10.
    const result = detectAhaanaActivityReminders(
      [activity({ remindLeadDays: 1 })],
      "2026-08-10",
      7,
    );
    expect(result).toHaveLength(1);
    expect(result[0].eventType).toBe("ahaana_activity");
    expect(result[0].eventKey).toBe("ahaana_activity:activity-1:2026-08-11");
    expect(result[0].leadTimeUnit).toBe("days");
    expect(result[0].title).toBe("French");
    expect(result[0].body).toContain("5:00 PM");
  });

  it("does not fire on any other day", () => {
    const result = detectAhaanaActivityReminders(
      [activity({ remindLeadDays: 1 })],
      "2026-08-09",
      7,
    );
    expect(result).toHaveLength(0);
  });

  it("ignores an activity with reminders disabled", () => {
    const result = detectAhaanaActivityReminders(
      [activity({ remindEnabled: false, remindLeadDays: 1 })],
      "2026-08-10",
      7,
    );
    expect(result).toHaveLength(0);
  });

  it("ignores an inactive activity even if reminders are enabled", () => {
    const result = detectAhaanaActivityReminders(
      [activity({ active: false, remindLeadDays: 1 })],
      "2026-08-10",
      7,
    );
    expect(result).toHaveLength(0);
  });

  it("produces one candidate per occurrence, not per activity", () => {
    // Tue+Fri occurrences within a 7-day lookahead of 2026-08-10:
    // 8/11 (Tue) and 8/14 (Fri) — only 8/11 is exactly 1 day out from
    // "today" = 8/10, so only that one fires on this specific run.
    const result = detectAhaanaActivityReminders(
      [activity({ remindLeadDays: 1 })],
      "2026-08-10",
      7,
    );
    expect(result.map((r) => r.eventKey)).toEqual([
      "ahaana_activity:activity-1:2026-08-11",
    ]);
  });

  it("produces nothing outside the activity's own start/end date", () => {
    const result = detectAhaanaActivityReminders(
      [
        activity({
          startDate: "2026-08-10",
          endDate: "2026-08-12",
          remindLeadDays: 0,
        }),
      ],
      "2026-08-14", // after the activity's own end_date
      7,
    );
    expect(result).toHaveLength(0);
  });
});
