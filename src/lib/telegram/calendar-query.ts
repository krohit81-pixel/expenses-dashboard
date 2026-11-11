import { z } from "zod";

import type { EventTag } from "@/features/calendar/data";

const querySchema = z.object({
  intent: z.literal("calendar"),
  from: z.iso.date(),
  to: z.iso.date(),
  people: z.array(z.string().trim().min(1).max(60)).max(4),
  tag: z
    .enum(["vacation", "holiday", "exam", "event", "action", "trip"])
    .nullable(),
  keywords: z.array(z.string().trim().min(1).max(60)).max(5),
  focus: z.enum(["start", "end", "schedule"]),
  next: z.boolean(),
});

export type CalendarQuery = z.infer<typeof querySchema>;

export interface CalendarFact {
  title: string;
  people: string[];
  tag: EventTag | "class";
  startDate: string;
  /** Atlas dates are inclusive; never use the iCal feed's exclusive DTEND. */
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  endKnown: boolean;
}

export type QueryParseResult =
  | { kind: "query"; query: CalendarQuery }
  | { kind: "ignore" }
  | { kind: "clarify" };

export function parseCalendarQuery(response: string): QueryParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(response.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return { kind: "clarify" };
  }
  if (
    typeof raw === "object" &&
    raw !== null &&
    "intent" in raw &&
    raw.intent === "ignore"
  ) {
    return { kind: "ignore" };
  }
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) return { kind: "clarify" };
  const query = parsed.data;
  const days = (Date.parse(query.to) - Date.parse(query.from)) / 86_400_000;
  // Bounds recurrence expansion and rejects reversed / unexpectedly broad ranges.
  if (days < 0 || days > 366) return { kind: "clarify" };
  return { kind: "query", query };
}

/** Questions are read-only even when they contain the word "reminder".
 * Ordinary group conversation stays silent. /ask is the explicit escape
 * hatch for phrasing that doesn't begin with a question word.
 */
export function telegramMessageKind(
  text: string,
): "query" | "reminder" | "ignore" {
  if (/^\/ask(?:@\w+)?(?:\s|$)/i.test(text.trim())) return "query";
  if (
    /^(?:when|what|which|who|where|how|is|are|do|does)\b/i.test(text.trim())
  ) {
    return "query";
  }
  if (/\bremind\s+(?:me|us|ahaana|rohana|rohit|aradhana)\b/i.test(text)) {
    return "reminder";
  }
  if (
    /^(?:when|what|which|who|where|how|is|are|do|does|can|could)\b/i.test(
      text.trim(),
    ) ||
    text.trim().endsWith("?")
  ) {
    return "query";
  }
  return /remind/i.test(text) ? "reminder" : "ignore";
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((word) => word.replace(/s$/, ""))
    .join(" ")
    .trim();
}

export function matchCalendarFacts(
  facts: CalendarFact[],
  query: CalendarQuery,
): CalendarFact[] {
  const matches = facts
    .filter((fact) => {
      // Overlap, rather than start-in-range: a December holiday can end in January.
      if (fact.startDate > query.to || fact.endDate < query.from) return false;
      if (query.tag !== null && fact.tag !== query.tag) return false;
      if (
        !query.people.every((person) =>
          fact.people.some((p) => normalize(p) === normalize(person)),
        )
      )
        return false;
      return query.keywords.every((word) =>
        normalize(fact.title).includes(normalize(word)),
      );
    })
    .sort((a, b) => {
      const dateA = query.focus === "end" ? a.endDate : a.startDate;
      const dateB = query.focus === "end" ? b.endDate : b.startDate;
      return (
        dateA.localeCompare(dateB) ||
        (a.startTime ?? "").localeCompare(b.startTime ?? "") ||
        a.title.localeCompare(b.title)
      );
    });
  return query.next ? matches.slice(0, 1) : matches;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

/** Replies contain only facts from the matched rows; the model never writes
 * the answer or infers a school reopening date from a vacation's end.
 */
export function formatCalendarAnswer(
  facts: CalendarFact[],
  query: CalendarQuery,
): string {
  const matches = matchCalendarFacts(facts, query);
  if (matches.length === 0) {
    return `I couldn't find a matching event in Atlas Calendar between ${formatDate(query.from)} and ${formatDate(query.to)}. Try naming the person or event more specifically.`;
  }
  const lines = matches.slice(0, 6).map((fact) => {
    const label = `${fact.people.length ? `${fact.people.join(", ")}: ` : ""}${fact.title}`;
    const zone = fact.people.includes("Rohana") ? "Singapore time" : "IST";
    const start = `${formatDate(fact.startDate)}${fact.startTime ? ` at ${fact.startTime} (${zone})` : ""}`;
    const end = `${formatDate(fact.endDate)}${fact.endTime ? ` at ${fact.endTime} (${zone})` : ""}`;
    if (query.focus === "end") {
      return fact.endKnown
        ? `${label} ends on ${end}.\nStarts: ${start}.`
        : `${label} starts on ${start}. Its end date isn't recorded in Atlas.`;
    }
    if (query.focus === "start") return `${label} starts on ${start}.`;
    return `${label}\n${start}${fact.endDate !== fact.startDate || fact.endTime ? ` – ${end}` : ""}${!fact.endKnown ? " (end date not recorded)" : ""}`;
  });
  if (matches.length > 6)
    lines.push(
      `${matches.length - 6} more matches — narrow the date range or person to see them.`,
    );
  return lines.join("\n\n");
}
