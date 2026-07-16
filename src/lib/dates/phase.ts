/**
 * Atlas's monthly cycle, from the product vision doc:
 *   Planning:  15th–24th   — "Will next month be financially healthy?"
 *   Execution: 25th–5th    — "What still needs to be completed?"
 *   Tracking:  6th–14th    — "Has anything changed my forecast?"
 *
 * Execution spans a month boundary (25th of one month through 5th of the
 * next) — the only one of the three that does. Planning and Tracking are
 * both entirely within a single calendar month, so their date ranges
 * don't need month-rollover handling; Execution's display range does.
 */

export type Phase = "planning" | "execution" | "tracking";

export interface PhaseInfo {
  phase: Phase;
  label: string;
  dateRange: string;
  question: string;
}

function shortDate(year: number, monthIndex: number, day: number): string {
  const d = new Date(Date.UTC(year, monthIndex, day));
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

const QUESTIONS: Record<Phase, string> = {
  planning: "Will next month be financially healthy?",
  execution: "What still needs to be completed?",
  tracking: "Has anything changed my forecast?",
};

const LABELS: Record<Phase, string> = {
  planning: "Planning phase",
  execution: "Execution phase",
  tracking: "Tracking phase",
};

/**
 * A given phase's date range, anchored to a reference month — used to
 * show sensible dates for phase tabs other than whichever one "today"
 * falls into (e.g. viewing the Planning tab while actually in
 * Execution). Anchoring to the calendar month rather than trying to
 * pair "which cycle" a non-current phase belongs to relative to today
 * sidesteps a genuinely ambiguous question (if today is 2 Aug, does
 * "Planning" mean the 15–24 Jul window that already passed, or the
 * upcoming 15–24 Aug one?) with a simple, consistent rule instead.
 */
export function getPhaseInfo(
  phase: Phase,
  referenceDate: Date = new Date(),
): PhaseInfo {
  const year = referenceDate.getUTCFullYear();
  const monthIndex = referenceDate.getUTCMonth();

  if (phase === "planning") {
    return {
      phase,
      label: LABELS.planning,
      dateRange: `${shortDate(year, monthIndex, 15)} \u2013 ${shortDate(year, monthIndex, 24)}`,
      question: QUESTIONS.planning,
    };
  }

  if (phase === "tracking") {
    return {
      phase,
      label: LABELS.tracking,
      dateRange: `${shortDate(year, monthIndex, 6)} \u2013 ${shortDate(year, monthIndex, 14)}`,
      question: QUESTIONS.tracking,
    };
  }

  return {
    phase,
    label: LABELS.execution,
    dateRange: `${shortDate(year, monthIndex, 25)} \u2013 ${shortDate(year, monthIndex + 1, 5)}`,
    question: QUESTIONS.execution,
  };
}

/**
 * Which phase a given date falls in, purely from day-of-month — the
 * phase itself doesn't depend on which month it is, only Execution's
 * *display range* does (it needs to know whether "today" is in the
 * 25–31 half or the 1–5 half to show the right two months).
 */
export function getCurrentPhase(date: Date = new Date()): PhaseInfo {
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();

  if (day >= 15 && day <= 24) {
    return getPhaseInfo("planning", date);
  }

  if (day >= 6 && day <= 14) {
    return getPhaseInfo("tracking", date);
  }

  // Execution: day is 25-31 (this month's 25th onward) or 1-5 (still in
  // the cycle that started the 25th of last month).
  const start =
    day >= 25
      ? shortDate(year, monthIndex, 25)
      : shortDate(year, monthIndex - 1, 25);
  const end =
    day >= 25
      ? shortDate(year, monthIndex + 1, 5)
      : shortDate(year, monthIndex, 5);

  return {
    phase: "execution",
    label: LABELS.execution,
    dateRange: `${start} \u2013 ${end}`,
    question: QUESTIONS.execution,
  };
}
