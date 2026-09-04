import "server-only";

import { callConfiguredProvider } from "@/lib/ai/providers";
import { todayISODate } from "@/lib/dates/calendar-grid";
import { knownTravelers } from "@/features/travel/travelers";

/**
 * v3.7.0 — turns a free-text Telegram message ("can you remind Rohana
 * to fill the online application before 10th sept") into the fields
 * needed to create a real calendar event. Mirrors
 * MerchantMergeSuggestionService.ts's exact shape: buildPrompt ->
 * callConfiguredProvider -> stripCodeFence -> JSON.parse -> defensive
 * field-by-field validation -> never throw. Deliberately DB-free (no
 * Supabase access anywhere in this file) — lives under lib/, not
 * services/, same reasoning as lib/ical/build-calendar-feed.ts staying
 * out of services/.
 *
 * The reminder-timing defaulting (remindLeadDays/remindLeadHours) is
 * computed here in code from whether a startTime was extracted, never
 * copied verbatim from the model's own raw fields — this is what keeps
 * an LLM hallucination (e.g. an hours-before lead time with no time of
 * day at all) from ever reaching createCalendarEvent's Zod refinement
 * that remindLeadHours requires a non-null startTime. See
 * parseReminderMessage's own comment below for the exact rule.
 */

const EVENT_TAGS = ["vacation", "holiday", "exam", "event"] as const;
type EventTag = (typeof EVENT_TAGS)[number];

const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface ParsedReminder {
  title: string;
  tag: EventTag;
  people: string[];
  startDate: string;
  startTime: string | null;
  notes: string | null;
  remindLeadDays: number;
  remindLeadHours: number | null;
}

export type ParseReminderResult =
  | { ok: true; event: ParsedReminder }
  | { ok: false; reason: "no-date" | "low-confidence" | "provider-error" };

function buildPrompt(
  messageText: string,
  senderFirstName: string,
  todayISO: string,
): string {
  return `You are extracting a calendar event from one message posted in a family's group chat. Today's date is ${todayISO} (use it to resolve relative phrases like "tomorrow" or "next Friday" into an actual date). The message was sent by "${senderFirstName}".

Message: "${messageText}"

Extract:
- "title": a short description of what the reminder is for (a few words, not a full sentence). null if you can't tell at all what this is about.
- "date": the date the reminder/event is for, as "YYYY-MM-DD". null if no date or day reference is given anywhere in the message.
- "time": a specific time of day, as 24-hour "HH:MM". null if no specific time is mentioned.
- "people": an array of household member names EXPLICITLY mentioned in the message (e.g. ["Rohana"]). Do NOT include the sender's own name unless their name is also literally written in the message — just leave this empty if nobody is named. Empty array if nobody is named.
- "tag": one of "exam", "vacation", "holiday", or "event" — only pick something other than "event" if the message clearly implies it (e.g. mentions an exam, a school holiday, a vacation/trip). Default "event" otherwise.
- "notes": any extra detail worth keeping that isn't already captured in the title. null if there's nothing extra.
- "leadHours": if the message explicitly says how many HOURS before the event to remind (e.g. "2 hours before"), that number. null otherwise.
- "leadDays": if the message explicitly says how many DAYS before the event to remind (e.g. "a day in advance", "3 days before"), that number. null otherwise. Never set both leadHours and leadDays.

Respond with ONLY a JSON object, no markdown formatting and no commentary before or after it. It must look exactly like this shape:
{"title": "...", "date": "2026-09-12", "time": "08:00", "people": [], "tag": "event", "notes": null, "leadHours": null, "leadDays": null}`;
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

interface RawExtraction {
  title?: unknown;
  date?: unknown;
  time?: unknown;
  people?: unknown;
  tag?: unknown;
  notes?: unknown;
  leadHours?: unknown;
  leadDays?: unknown;
}

function asTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 200) : null;
}

function asDate(value: unknown): string | null {
  return typeof value === "string" && ISO_DATE_PATTERN.test(value)
    ? value
    : null;
}

function asTime(value: unknown): string | null {
  return typeof value === "string" && TIME_OF_DAY_PATTERN.test(value)
    ? value
    : null;
}

/**
 * Confirmed via a real test call: the model sometimes mirrors the
 * message's own literal casing for a name it copies into `people`
 * (e.g. "remind me to inform ahaana..." -> {"people": ["ahaana"]}),
 * even while correctly capitalizing the same name in its own `title`.
 * That's not just cosmetic — offsetMinutesFor (build-calendar-feed.ts,
 * detect-reminders.ts) does a case-sensitive `people.includes("Rohana")`
 * for her Singapore-timezone reminders; a lowercase "rohana" would
 * silently reintroduce the exact IST-instead-of-Singapore bug v3.6.10
 * just fixed, just via a different path. Canonicalizes against the
 * same known-household roster travelerColorClass etc. already use
 * (features/travel/travelers.ts) case-insensitively; anyone else
 * (a friend, not one of the four) still gets a reasonable
 * Title-Cased fallback rather than whatever raw casing came back.
 */
function canonicalizePersonName(name: string): string {
  const known = knownTravelers();
  const match = known.find(
    (person) => person.toLowerCase() === name.toLowerCase(),
  );
  if (match) return match;
  return name
    .split(/\s+/)
    .map((word) =>
      word.length > 0
        ? word[0].toUpperCase() + word.slice(1).toLowerCase()
        : word,
    )
    .join(" ");
}

function asPeople(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const names = value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && v.length <= 60)
    .map(canonicalizePersonName);
  return Array.from(new Set(names));
}

function asTag(value: unknown): EventTag {
  return typeof value === "string" &&
    (EVENT_TAGS as readonly string[]).includes(value)
    ? (value as EventTag)
    : "event";
}

function asNotes(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 1000) : null;
}

/** A whole number in [min, max], else null — used for both leadHours/leadDays, which have different valid ranges (matches zHourlyReminderFields/zReminderFields in features/calendar/schemas.ts). */
function asBoundedInt(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
    ? value
    : null;
}

/**
 * Pure, exported for direct testing — never throws. A malformed/
 * unparseable response, or one with nothing sensible to extract at
 * all, comes back as a `low-confidence` result rather than an error:
 * "the model had nothing to say" and "the model's output was junk"
 * should look the same to whoever sent the message — either way,
 * nothing worth creating was found, and the caller replies with a
 * rephrasing nudge instead of a wrong calendar event.
 */
export function parseReminderMessage(
  responseText: string,
  senderFirstName: string,
): ParseReminderResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(responseText));
  } catch {
    return { ok: false, reason: "low-confidence" };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, reason: "low-confidence" };
  }

  const raw = parsed as RawExtraction;
  const title = asTitle(raw.title);
  const startDate = asDate(raw.date);

  // A date with no title (or neither) isn't a usable event — there's
  // nothing to remind about. Only "title present, date missing" gets
  // its own more specific "I need a date" reply (see the route
  // handler); every other missing combination is just "couldn't tell
  // what this is about" — the model had nothing confident to say.
  if (title === null) {
    return { ok: false, reason: "low-confidence" };
  }
  if (startDate === null) {
    return { ok: false, reason: "no-date" };
  }

  const startTime = asTime(raw.time);
  const explicitPeople = asPeople(raw.people);
  const people =
    explicitPeople.length > 0
      ? explicitPeople
      : [canonicalizePersonName(senderFirstName)];

  // Reminder timing is computed here, from whether a startTime exists —
  // never copied verbatim from the model's own leadHours/leadDays, so a
  // hallucinated leadHours with no time of day at all is simply never
  // read (it isn't in scope in the startTime === null branch below),
  // and createCalendarEventInputSchema's "remindLeadHours needs a
  // startTime" refinement can never be violated by this function's
  // output.
  const remindLeadDays =
    startTime === null ? (asBoundedInt(raw.leadDays, 0, 365) ?? 1) : 0;
  const remindLeadHours =
    startTime === null ? null : (asBoundedInt(raw.leadHours, 1, 23) ?? 1);

  return {
    ok: true,
    event: {
      title,
      tag: asTag(raw.tag),
      people,
      startDate,
      startTime,
      notes: asNotes(raw.notes),
      remindLeadDays,
      remindLeadHours,
    },
  };
}

/**
 * Orchestrator — builds the prompt (today's date via todayISODate() so
 * the model can resolve relative phrases), calls the configured AI
 * provider, and delegates to parseReminderMessage. Never throws: a
 * thrown/failed provider call or an unconfigured provider both come
 * back as `provider-error`, distinct from a genuine parsing failure.
 */
export async function extractReminderFromMessage(
  messageText: string,
  senderFirstName: string,
): Promise<ParseReminderResult> {
  const prompt = buildPrompt(messageText, senderFirstName, todayISODate());

  let responseText: string | null;
  try {
    // Generous budget — a Gemini response's "thinking" tokens share the
    // same maxTokens count as its actual output (confirmed directly:
    // 300 truncated every real response below the closing JSON brace),
    // so the tiny JSON object this prompt asks for still needs real
    // headroom, same order of magnitude as IntelService's own 800.
    responseText = await callConfiguredProvider(prompt, 1000);
  } catch {
    return { ok: false, reason: "provider-error" };
  }
  if (responseText === null) {
    return { ok: false, reason: "provider-error" };
  }

  return parseReminderMessage(responseText, senderFirstName);
}
