import { describe, expect, it, vi } from "vitest";

// server-only throws unconditionally outside a real Next.js build, and
// importing this module transitively imports lib/ai/providers.ts, which
// reads serverEnv eagerly at module load — same reasoning/convention as
// MerchantMergeSuggestionService.test.ts's own mocks. This file only
// exercises parseReminderMessage (pure, no env/network access at all).
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  serverEnv: {
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    APP_OWNER_USER_ID: "550e8400-e29b-41d4-a716-446655440000",
    APP_ACCESS_PASSWORD: "test-password",
    APP_SESSION_SECRET: "a".repeat(32),
  },
}));

import { parseReminderMessage } from "./parse-reminder";

// 2026-09-05T06:15:00Z is 11:45 AM IST — the exact real-world moment
// behind the v3.7.1/v3.7.2 "remind me in 1 hour" household report
// (docs/00-current-state.md's v3.7.1 section).
const SENT_AT = new Date("2026-09-05T06:15:00Z");

const rawJson = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    title: "Tutorial class",
    date: "2026-09-12",
    time: "08:00",
    people: [],
    tag: "event",
    notes: null,
    leadHours: null,
    leadDays: null,
    inMinutes: null,
    ...overrides,
  });

describe("parseReminderMessage", () => {
  it("defaults to a 1-hour reminder when a time is given and no explicit lead time is mentioned", () => {
    const result = parseReminderMessage(rawJson(), "Rohana", SENT_AT);
    expect(result).toEqual({
      ok: true,
      event: {
        title: "Tutorial class",
        tag: "event",
        people: ["Rohana"],
        startDate: "2026-09-12",
        startTime: "08:00",
        notes: null,
        remindLeadDays: 0,
        remindLeadHours: 1,
      },
    });
  });

  it("defaults to a 1-day reminder when no time of day is given at all", () => {
    const result = parseReminderMessage(
      rawJson({ time: null }),
      "Rohit",
      SENT_AT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.startTime).toBeNull();
    expect(result.event.remindLeadDays).toBe(1);
    expect(result.event.remindLeadHours).toBeNull();
  });

  it("honors an explicit hours-before lead time when a time of day is given", () => {
    const result = parseReminderMessage(
      rawJson({ leadHours: 3 }),
      "Rohit",
      SENT_AT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.remindLeadHours).toBe(3);
    expect(result.event.remindLeadDays).toBe(0);
  });

  it("honors an explicit days-before lead time when no time of day is given", () => {
    const result = parseReminderMessage(
      rawJson({ time: null, leadDays: 3 }),
      "Rohit",
      SENT_AT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.remindLeadDays).toBe(3);
    expect(result.event.remindLeadHours).toBeNull();
  });

  it("returns no-date when there's a title but no date", () => {
    const result = parseReminderMessage(
      rawJson({ date: null }),
      "Rohit",
      SENT_AT,
    );
    expect(result).toEqual({ ok: false, reason: "no-date" });
  });

  it("returns low-confidence when there's no title at all, even with a date", () => {
    const result = parseReminderMessage(
      rawJson({ title: null }),
      "Rohit",
      SENT_AT,
    );
    expect(result).toEqual({ ok: false, reason: "low-confidence" });
  });

  it("returns low-confidence when neither title nor date could be extracted", () => {
    const result = parseReminderMessage(
      rawJson({ title: null, date: null }),
      "Rohit",
      SENT_AT,
    );
    expect(result).toEqual({ ok: false, reason: "low-confidence" });
  });

  it("uses an explicitly named person instead of the sender, without also injecting the sender", () => {
    const result = parseReminderMessage(
      rawJson({ people: ["Ahaana"] }),
      "Rohit",
      SENT_AT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.people).toEqual(["Ahaana"]);
  });

  it("falls back to the sender's own name when nobody is explicitly named", () => {
    const result = parseReminderMessage(
      rawJson({ people: [] }),
      "Rohit",
      SENT_AT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.people).toEqual(["Rohit"]);
  });

  // Confirmed via a real test call against a live provider: the model
  // sometimes mirrors a message's own literal casing into `people`
  // (e.g. "remind rohana..." -> {"people": ["rohana"]}) even while
  // correctly capitalizing the same name elsewhere in its response.
  // That's not cosmetic — offsetMinutesFor (build-calendar-feed.ts,
  // detect-reminders.ts) does a case-sensitive
  // `people.includes("Rohana")` for her Singapore-timezone reminders;
  // an uncorrected "rohana" would silently reintroduce the exact
  // IST-instead-of-Singapore bug v3.6.10 just fixed.
  it("canonicalizes a known household member's name regardless of the casing the model returned", () => {
    const result = parseReminderMessage(
      rawJson({ people: ["rohana"] }),
      "Rohit",
      SENT_AT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.people).toEqual(["Rohana"]);
  });

  it("Title-Cases an unrecognized name rather than leaving whatever casing the model returned", () => {
    const result = parseReminderMessage(
      rawJson({ people: ["sunita AUNTY"] }),
      "Rohit",
      SENT_AT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.people).toEqual(["Sunita Aunty"]);
  });

  it("never lets a hallucinated leadHours through when no startTime was extracted", () => {
    // The model shouldn't be asked to set both, but a defensive parser
    // has to assume it might anyway — this is exactly the case that
    // would otherwise violate createCalendarEventInputSchema's
    // "remindLeadHours needs a startTime" refinement downstream.
    const result = parseReminderMessage(
      rawJson({ time: null, leadHours: 5 }),
      "Rohit",
      SENT_AT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.startTime).toBeNull();
    expect(result.event.remindLeadHours).toBeNull();
    expect(result.event.remindLeadDays).toBe(1);
  });

  it("falls back to 'event' for an unrecognized or missing tag", () => {
    const result = parseReminderMessage(
      rawJson({ tag: "birthday-party" }),
      "Rohit",
      SENT_AT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.tag).toBe("event");
  });

  it("strips a markdown code fence before parsing", () => {
    const fenced = "```json\n" + rawJson() + "\n```";
    const result = parseReminderMessage(fenced, "Rohana", SENT_AT);
    expect(result.ok).toBe(true);
  });

  it("returns low-confidence for malformed, non-JSON responses without throwing", () => {
    expect(() =>
      parseReminderMessage("not json at all", "Rohit", SENT_AT),
    ).not.toThrow();
    expect(parseReminderMessage("not json at all", "Rohit", SENT_AT)).toEqual({
      ok: false,
      reason: "low-confidence",
    });
  });

  it("returns low-confidence when the response is valid JSON but not an object", () => {
    expect(parseReminderMessage("[]", "Rohit", SENT_AT)).toEqual({
      ok: false,
      reason: "low-confidence",
    });
    expect(parseReminderMessage("null", "Rohit", SENT_AT)).toEqual({
      ok: false,
      reason: "low-confidence",
    });
  });
});

// v3.7.2 — a real household report: Rohana said "remind me in 1 hour
// for Gei quiz due today" and got a 1-DAY-before reminder instead,
// because "in 1 hour" isn't "1 hour before a scheduled time" (there
// was no scheduled time at all, just "due today") — it's a delay
// measured from when the message was itself sent. Solved using
// Telegram's own message.date as an exact anchor (see the route
// handler), converted back to a wall-clock date+time via the same
// per-person timezone offset the rest of the reminder system uses.
describe('parseReminderMessage — delay-from-now ("remind me in N hours/minutes")', () => {
  it("computes the wall-clock date+time from the message's own send time, not from an unrelated date/time", () => {
    // SENT_AT is 11:45 AM IST; +60 minutes = 12:45 PM IST, same day.
    const result = parseReminderMessage(
      rawJson({ inMinutes: 60, date: null, time: null }),
      "Rohit",
      SENT_AT,
    );
    expect(result).toEqual({
      ok: true,
      event: {
        title: "Tutorial class",
        tag: "event",
        people: ["Rohit"],
        startDate: "2026-09-05",
        startTime: "12:45",
        notes: null,
        remindLeadDays: 0,
        remindLeadHours: 0,
      },
    });
  });

  it("uses Singapore time, not IST, when the reminder is tagged to Rohana", () => {
    // Same instant as above, but read on Rohana's own (Singapore,
    // UTC+8) clock instead of IST — a different wall-clock time for
    // the exact same underlying moment.
    const result = parseReminderMessage(
      rawJson({ inMinutes: 60, people: ["Rohana"] }),
      "Rohit",
      SENT_AT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.startDate).toBe("2026-09-05");
    expect(result.event.startTime).toBe("15:15");
  });

  it("rolls over into the next calendar day when the delay crosses midnight", () => {
    // 22:30 IST + 2 hours = 00:30 IST the next day.
    const sentLateAtNight = new Date("2026-09-05T17:00:00Z"); // 22:30 IST
    const result = parseReminderMessage(
      rawJson({ inMinutes: 120 }),
      "Rohit",
      sentLateAtNight,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.startDate).toBe("2026-09-06");
    expect(result.event.startTime).toBe("00:30");
  });

  it("fires right at the computed instant (remindLeadHours: 0), not an hour before it", () => {
    const result = parseReminderMessage(
      rawJson({ inMinutes: 30 }),
      "Rohit",
      SENT_AT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.remindLeadHours).toBe(0);
    expect(result.event.remindLeadDays).toBe(0);
  });

  it("takes precedence over date/time/leadHours/leadDays even if the model confusingly sets both", () => {
    const result = parseReminderMessage(
      rawJson({
        inMinutes: 60,
        date: "2026-01-01",
        time: "23:59",
        leadHours: 5,
        leadDays: 5,
      }),
      "Rohit",
      SENT_AT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Derived from SENT_AT + 60 min, not from the bogus date/time above.
    expect(result.event.startDate).toBe("2026-09-05");
    expect(result.event.startTime).toBe("12:45");
    expect(result.event.remindLeadHours).toBe(0);
    expect(result.event.remindLeadDays).toBe(0);
  });

  it("still requires a title, even with a valid inMinutes", () => {
    const result = parseReminderMessage(
      rawJson({ title: null, inMinutes: 60 }),
      "Rohit",
      SENT_AT,
    );
    expect(result).toEqual({ ok: false, reason: "low-confidence" });
  });

  it("ignores an out-of-sane-range inMinutes and falls back to the normal date/time path", () => {
    const result = parseReminderMessage(
      rawJson({ inMinutes: 999_999 }),
      "Rohit",
      SENT_AT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Falls through to the ordinary date-required path using the
    // rawJson fixture's own date/time, exactly as if inMinutes had
    // never been set.
    expect(result.event.startDate).toBe("2026-09-12");
    expect(result.event.startTime).toBe("08:00");
  });
});
