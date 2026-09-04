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
    ...overrides,
  });

describe("parseReminderMessage", () => {
  it("defaults to a 1-hour reminder when a time is given and no explicit lead time is mentioned", () => {
    const result = parseReminderMessage(rawJson(), "Rohana");
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
    const result = parseReminderMessage(rawJson({ time: null }), "Rohit");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.startTime).toBeNull();
    expect(result.event.remindLeadDays).toBe(1);
    expect(result.event.remindLeadHours).toBeNull();
  });

  it("honors an explicit hours-before lead time when a time of day is given", () => {
    const result = parseReminderMessage(rawJson({ leadHours: 3 }), "Rohit");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.remindLeadHours).toBe(3);
    expect(result.event.remindLeadDays).toBe(0);
  });

  it("honors an explicit days-before lead time when no time of day is given", () => {
    const result = parseReminderMessage(
      rawJson({ time: null, leadDays: 3 }),
      "Rohit",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.remindLeadDays).toBe(3);
    expect(result.event.remindLeadHours).toBeNull();
  });

  it("returns no-date when there's a title but no date", () => {
    const result = parseReminderMessage(rawJson({ date: null }), "Rohit");
    expect(result).toEqual({ ok: false, reason: "no-date" });
  });

  it("returns low-confidence when there's no title at all, even with a date", () => {
    const result = parseReminderMessage(rawJson({ title: null }), "Rohit");
    expect(result).toEqual({ ok: false, reason: "low-confidence" });
  });

  it("returns low-confidence when neither title nor date could be extracted", () => {
    const result = parseReminderMessage(
      rawJson({ title: null, date: null }),
      "Rohit",
    );
    expect(result).toEqual({ ok: false, reason: "low-confidence" });
  });

  it("uses an explicitly named person instead of the sender, without also injecting the sender", () => {
    const result = parseReminderMessage(
      rawJson({ people: ["Ahaana"] }),
      "Rohit",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.people).toEqual(["Ahaana"]);
  });

  it("falls back to the sender's own name when nobody is explicitly named", () => {
    const result = parseReminderMessage(rawJson({ people: [] }), "Rohit");
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
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.people).toEqual(["Rohana"]);
  });

  it("Title-Cases an unrecognized name rather than leaving whatever casing the model returned", () => {
    const result = parseReminderMessage(
      rawJson({ people: ["sunita AUNTY"] }),
      "Rohit",
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
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.tag).toBe("event");
  });

  it("strips a markdown code fence before parsing", () => {
    const fenced = "```json\n" + rawJson() + "\n```";
    const result = parseReminderMessage(fenced, "Rohana");
    expect(result.ok).toBe(true);
  });

  it("returns low-confidence for malformed, non-JSON responses without throwing", () => {
    expect(() =>
      parseReminderMessage("not json at all", "Rohit"),
    ).not.toThrow();
    expect(parseReminderMessage("not json at all", "Rohit")).toEqual({
      ok: false,
      reason: "low-confidence",
    });
  });

  it("returns low-confidence when the response is valid JSON but not an object", () => {
    expect(parseReminderMessage("[]", "Rohit")).toEqual({
      ok: false,
      reason: "low-confidence",
    });
    expect(parseReminderMessage("null", "Rohit")).toEqual({
      ok: false,
      reason: "low-confidence",
    });
  });
});
