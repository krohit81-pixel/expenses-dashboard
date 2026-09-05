import { describe, expect, it } from "vitest";

import { createCalendarEventInputSchema } from "./schemas";

const base = {
  title: "Bowling",
  tag: "event" as const,
  startDate: "2026-09-03",
  endDate: "2026-09-03",
};

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
