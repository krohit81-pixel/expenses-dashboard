import { describe, expect, it } from "vitest";

import {
  createCalendarEventInputSchema,
  updateCalendarEventInputSchema,
} from "./schemas";

const base = {
  title: "Bowling",
  tag: "event" as const,
  startDate: "2026-09-03",
  endDate: "2026-09-03",
};

describe("calendar Action category", () => {
  it("accepts one date without an end date or time", () => {
    const result = createCalendarEventInputSchema.parse({
      title: "Call school",
      tag: "action",
      startDate: "2026-11-19",
    });
    expect(result.endDate).toBe("2026-11-19");
    expect(result.startTime).toBeNull();
    expect(result.endTime).toBeNull();
  });

  it("clears an event's stale end fields when changing it to Action", () => {
    const result = updateCalendarEventInputSchema.parse({
      id: "00000000-0000-4000-8000-000000000001",
      title: "Call school",
      tag: "action",
      startDate: "2026-11-19",
      endDate: "2026-11-01",
      startTime: "10:00",
      endTime: "09:00",
    });
    expect(result.endDate).toBe(result.startDate);
    expect(result.endTime).toBeNull();
  });

  it("still requires an end date for other categories", () => {
    expect(
      createCalendarEventInputSchema.safeParse({
        title: "Holiday",
        tag: "holiday",
        startDate: "2026-11-19",
      }).success,
    ).toBe(false);
  });
  it("accepts a timed Action with reminders when creating and editing", () => {
    const action = {
      title: "Call school about subject selection",
      tag: "action",
      people: ["Ahaana"],
      startDate: "2026-11-19",
      endDate: "2026-11-19",
      startTime: "10:00",
      remindEnabled: true,
      remindLeadHours: 1,
    };
    expect(createCalendarEventInputSchema.parse(action).tag).toBe("action");
    expect(
      updateCalendarEventInputSchema.parse({
        ...action,
        id: "00000000-0000-4000-8000-000000000001",
      }).tag,
    ).toBe("action");
  });
});

describe("createCalendarEventInputSchema — endTime", () => {
  it("accepts no time at all", () => {
    const result = createCalendarEventInputSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("accepts a startTime with no endTime (falls back to the 1-hour default downstream)", () => {
    const result = createCalendarEventInputSchema.safeParse({
      ...base,
      startTime: "16:00",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a real 4-hour span", () => {
    const result = createCalendarEventInputSchema.safeParse({
      ...base,
      startTime: "16:00",
      endTime: "20:00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an endTime with no startTime", () => {
    const result = createCalendarEventInputSchema.safeParse({
      ...base,
      endTime: "20:00",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["endTime"]);
    }
  });

  it("rejects an endTime at or before the startTime", () => {
    const same = createCalendarEventInputSchema.safeParse({
      ...base,
      startTime: "16:00",
      endTime: "16:00",
    });
    expect(same.success).toBe(false);

    const before = createCalendarEventInputSchema.safeParse({
      ...base,
      startTime: "16:00",
      endTime: "15:00",
    });
    expect(before.success).toBe(false);
  });
});

describe("createCalendarEventInputSchema — remindLeadHours", () => {
  // v3.7.2 — floor widened from 1 to 0: the Telegram "remind me in N
  // hours/minutes" feature needs to say "fire right at this instant,"
  // not "at least an hour before it." Never offered by the manual Add
  // Event/Recurring forms (still 1-4, see ReminderFields.tsx), but the
  // schema itself must accept it.
  it("accepts 0 (fire right at the event's own time) given a startTime", () => {
    const result = createCalendarEventInputSchema.safeParse({
      ...base,
      startTime: "12:45",
      remindLeadHours: 0,
    });
    expect(result.success).toBe(true);
  });

  it("still rejects a negative remindLeadHours", () => {
    const result = createCalendarEventInputSchema.safeParse({
      ...base,
      startTime: "12:45",
      remindLeadHours: -1,
    });
    expect(result.success).toBe(false);
  });

  it("still rejects remindLeadHours: 0 with no startTime", () => {
    const result = createCalendarEventInputSchema.safeParse({
      ...base,
      remindLeadHours: 0,
    });
    expect(result.success).toBe(false);
  });
});
