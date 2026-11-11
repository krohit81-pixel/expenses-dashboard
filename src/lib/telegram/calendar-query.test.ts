import { describe, expect, it } from "vitest";

import { buildSchoolCalendarItems } from "@/features/travel/school-items";
import {
  formatCalendarAnswer,
  matchCalendarFacts,
  parseCalendarQuery,
  telegramMessageKind,
  type CalendarFact,
  type CalendarQuery,
} from "./calendar-query";

const query: CalendarQuery = {
  intent: "calendar",
  from: "2026-11-01",
  to: "2026-11-30",
  people: ["Ahaana"],
  tag: "vacation",
  keywords: [],
  focus: "end",
  next: false,
};

const schoolFacts: CalendarFact[] = buildSchoolCalendarItems().map((item) => ({
  ...item,
  people: [item.person === "ahaana" ? "Ahaana" : "Rohana"],
  startTime: null,
  endTime: null,
  endKnown: true,
}));

describe("Telegram calendar answers", () => {
  it("finds Actions without mixing in ordinary events", () => {
    const action: CalendarFact = {
      title: "Call school",
      tag: "action",
      people: ["Ahaana"],
      startDate: "2026-11-19",
      endDate: "2026-11-19",
      startTime: "10:00",
      endTime: null,
      endKnown: true,
    };
    const actionQuery = {
      ...query,
      tag: "action" as const,
      focus: "schedule" as const,
    };
    expect(parseCalendarQuery(JSON.stringify(actionQuery)).kind).toBe("query");
    const answer = formatCalendarAnswer([...schoolFacts, action], actionQuery);
    expect(answer).toContain("Call school");
    expect(answer).toContain("10:00 (IST)");
    expect(answer).not.toContain("ends on");
    expect(answer).not.toContain("Diwali");
  });
  it("uses the real inclusive Diwali end date, not the iCal exclusive DTEND", () => {
    const answer = formatCalendarAnswer(schoolFacts, query);
    expect(answer).toBe(
      "Ahaana: Diwali Vacations ends on Tuesday, 17 November 2026.\nStarts: Friday, 6 November 2026.",
    );
    expect(answer).not.toContain("18 November");
  });

  it("keeps the other person's exams out of a vacation answer", () => {
    const matches = matchCalendarFacts(schoolFacts, query);
    expect(matches).toHaveLength(1);
    expect(matches[0].people).toEqual(["Ahaana"]);
    expect(
      formatCalendarAnswer(schoolFacts, { ...query, people: ["Rohana"] }),
    ).toContain("couldn't find");
  });

  it("finds school reopening as a separate recorded fact", () => {
    expect(
      formatCalendarAnswer(schoolFacts, {
        ...query,
        tag: null,
        keywords: ["reopens"],
        focus: "start",
      }),
    ).toContain("Wednesday, 18 November 2026");
  });

  it("includes a vacation that started in December when asked about January", () => {
    expect(
      formatCalendarAnswer(schoolFacts, {
        ...query,
        from: "2027-01-01",
        to: "2027-01-31",
      }),
    ).toContain("Sunday, 3 January 2027");
  });

  it("does not invent the ending of an open-ended vacation", () => {
    const fact: CalendarFact = {
      title: "Summer vacation begins",
      people: ["Ahaana"],
      tag: "vacation",
      startDate: "2027-05-21",
      endDate: "2027-05-21",
      startTime: null,
      endTime: null,
      endKnown: false,
    };
    expect(
      formatCalendarAnswer([fact], {
        ...query,
        from: "2027-05-01",
        to: "2027-05-31",
      }),
    ).toContain("end date isn't recorded");
  });

  it("shows all ambiguous matches instead of picking a random event", () => {
    const answer = formatCalendarAnswer(schoolFacts, {
      ...query,
      people: [],
      tag: null,
    });
    expect(answer).toContain("Diwali Vacations");
    expect(answer).toContain("Rohana: Reading Week");
  });

  it("limits long answers and tells the user how to see remaining matches", () => {
    const answer = formatCalendarAnswer(schoolFacts, {
      ...query,
      people: [],
      tag: null,
      from: "2026-08-01",
      to: "2026-11-30",
    });
    expect(answer).toContain("more matches");
    expect(answer.length).toBeLessThan(3500);
  });

  it("supports case-insensitive person and singular/plural title matching", () => {
    expect(
      matchCalendarFacts(schoolFacts, {
        ...query,
        people: ["ahaana"],
        keywords: ["vacation"],
      }),
    ).toHaveLength(1);
  });

  it("chooses the next match chronologically", () => {
    const matches = matchCalendarFacts(schoolFacts, {
      ...query,
      next: true,
      from: "2026-12-01",
      to: "2027-05-31",
    });
    expect(matches).toHaveLength(1);
    expect(matches[0].title).toBe("Winter Vacations");
  });
});

describe("calendar query boundary", () => {
  it("accepts structured search fields and fenced JSON", () => {
    expect(
      parseCalendarQuery(`\`\`\`json\n${JSON.stringify(query)}\n\`\`\``),
    ).toEqual({ kind: "query", query });
  });
  it.each([
    "not json",
    "null",
    "[]",
    JSON.stringify({ ...query, from: "2026-02-30" }),
    JSON.stringify({ ...query, to: "2026-10-01" }),
    JSON.stringify({ ...query, to: "2030-11-01" }),
    JSON.stringify({ ...query, focus: "delete" }),
    JSON.stringify({ ...query, people: "Ahaana" }),
  ])(
    "asks for clarification for malformed or unbounded extraction: %s",
    (raw) => {
      expect(parseCalendarQuery(raw)).toEqual({ kind: "clarify" });
    },
  );
  it("ignores non-calendar questions", () => {
    expect(parseCalendarQuery('{"intent":"ignore"}')).toEqual({
      kind: "ignore",
    });
  });
});

describe("Telegram message routing", () => {
  it.each([
    "when does Ahaana vacation is ending this month",
    "/ask Show Rohana's classes tomorrow",
    "/ask@AtlasBot Vacation dates",
    "What reminders do we have tomorrow?",
    "When will you remind me about the dentist?",
  ])("routes questions read-only: %s", (text) => {
    expect(telegramMessageKind(text)).toBe("query");
  });
  it.each([
    "remind me tomorrow to call the plumber",
    "Can you remind Rohana to submit her form tomorrow?",
    "remind Aradhana about her appointment",
  ])("preserves reminder creation: %s", (text) => {
    expect(telegramMessageKind(text)).toBe("reminder");
  });
  it("leaves ordinary chat alone", () => {
    expect(telegramMessageKind("Good morning everyone")).toBe("ignore");
  });
});
