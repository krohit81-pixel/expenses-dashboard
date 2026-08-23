import { describe, expect, it } from "vitest";

import {
  detectAhaanaActivityReminders,
  detectAhaanaActivityHourlyReminders,
  detectAhaanaWeeklyReport,
} from "./detect-ahaana-reminders";
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

  it("skips an activity using hour-based reminders instead (mutual exclusivity)", () => {
    // Would otherwise fire on 2026-08-11 (1 day before), same as the
    // very first test above — remindLeadHours being set means the
    // hourly detector owns this activity instead.
    const result = detectAhaanaActivityReminders(
      [activity({ remindLeadDays: 1, remindLeadHours: 2 })],
      "2026-08-10",
      7,
    );
    expect(result).toHaveLength(0);
  });
});

describe("detectAhaanaActivityHourlyReminders", () => {
  it("fires once the reminder threshold passes, until the occurrence starts", () => {
    // French, Tue/Fri 17:00 IST = 11:30 UTC. 2h before 2026-08-11 (Tue)
    // is 2026-08-11T09:30:00Z.
    const activityRow = activity({
      remindLeadDays: 0,
      remindLeadHours: 2,
    });

    const tooEarly = detectAhaanaActivityHourlyReminders(
      [activityRow],
      "2026-08-11T09:00:00Z",
      2,
    );
    expect(tooEarly).toHaveLength(0);

    const withinWindow = detectAhaanaActivityHourlyReminders(
      [activityRow],
      "2026-08-11T10:00:00Z",
      2,
    );
    expect(withinWindow).toHaveLength(1);
    expect(withinWindow[0].eventType).toBe("ahaana_activity");
    expect(withinWindow[0].eventKey).toBe(
      "ahaana_activity:activity-1:2026-08-11",
    );
    expect(withinWindow[0].leadTimeUnit).toBe("hours");
    expect(withinWindow[0].leadTimeDays).toBe(2);
    expect(withinWindow[0].body).toContain("2h before");

    const afterStart = detectAhaanaActivityHourlyReminders(
      [activityRow],
      "2026-08-11T12:00:00Z",
      2,
    );
    expect(afterStart).toHaveLength(0);
  });

  it("ignores an activity using day-based reminders instead", () => {
    const result = detectAhaanaActivityHourlyReminders(
      [activity({ remindLeadDays: 1, remindLeadHours: null })],
      "2026-08-11T10:00:00Z",
      2,
    );
    expect(result).toHaveLength(0);
  });

  it("ignores a disabled or inactive activity", () => {
    const disabled = detectAhaanaActivityHourlyReminders(
      [activity({ remindEnabled: false, remindLeadHours: 2 })],
      "2026-08-11T10:00:00Z",
      2,
    );
    expect(disabled).toHaveLength(0);

    const inactive = detectAhaanaActivityHourlyReminders(
      [activity({ active: false, remindLeadHours: 2 })],
      "2026-08-11T10:00:00Z",
      2,
    );
    expect(inactive).toHaveLength(0);
  });
});

// The week of Mon 2026-08-17 – Sun 2026-08-23. activity()'s default
// daysOfWeek [2, 5] (Tue, Fri) falls on 2026-08-18 and 2026-08-21
// within it.
describe("detectAhaanaWeeklyReport", () => {
  it("produces nothing on a non-Sunday without force", () => {
    const result = detectAhaanaWeeklyReport(
      [activity()],
      [activityLog()],
      "2026-08-20", // Thursday
    );
    expect(result).toHaveLength(0);
  });

  it("fires on Sunday, summarizing the week just ended", () => {
    const result = detectAhaanaWeeklyReport(
      [activity()],
      [activityLog({ occurrenceDate: "2026-08-18" })],
      "2026-08-23", // Sunday
    );
    expect(result).toHaveLength(1);
    expect(result[0].eventType).toBe("ahaana_weekly_report");
    expect(result[0].eventKey).toBe("ahaana_weekly_report:2026-08-17");
    expect(result[0].body).toContain("1 of 2 sessions completed");
    expect(result[0].body).toContain("Covered chapters 3-4");
    expect(result[0].body).toContain("Chapter 5 next");
    expect(result[0].body).toContain("not logged"); // the 8/21 occurrence
  });

  it("bypasses the Sunday gate when force is set", () => {
    const result = detectAhaanaWeeklyReport(
      [activity()],
      [activityLog()],
      "2026-08-20", // Thursday
      { force: true },
    );
    expect(result).toHaveLength(1);
  });

  it("produces nothing when nothing was scheduled that week", () => {
    const result = detectAhaanaWeeklyReport(
      [activity({ active: false })],
      [],
      "2026-08-23",
    );
    expect(result).toHaveLength(0);
  });

  it("ignores an inactive activity's occurrences entirely", () => {
    const result = detectAhaanaWeeklyReport(
      [
        activity({ id: "activity-2", active: false, daysOfWeek: [3] }), // Wed, inactive
        activity({ id: "activity-3", active: true, daysOfWeek: [3] }), // Wed, active
      ],
      [],
      "2026-08-23",
    );
    // 2026-08-19 (Wed) — only the active rule's occurrence counts.
    expect(result).toHaveLength(1);
    expect(result[0].body).toContain("0 of 1 sessions completed");
  });
});
