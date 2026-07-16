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
 * A phase's date range for a SPECIFIC target cycle month's own
 * lifecycle — not "today," a specific selected cycle. July's own
 * Execution window is June 25–July 5 (the window that leads into July),
 * not July 25–Aug 5 (which is actually August's window) — getPhaseInfo
 * above always anchors to referenceDate's own calendar month, which is
 * right for "what's happening around today" but wrong once a person can
 * select a different cycle and expects to see *that* cycle's own dates,
 * not today's.
 */
export function getPhaseInfoForCycle(
  phase: Phase,
  cycleMonth: string,
): PhaseInfo {
  const [yearStr, monthStr] = cycleMonth.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1; // 0-indexed; this IS the target cycle month

  if (phase === "planning") {
    return {
      phase,
      label: LABELS.planning,
      dateRange: `${shortDate(year, monthIndex - 1, 15)} \u2013 ${shortDate(year, monthIndex - 1, 24)}`,
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
    dateRange: `${shortDate(year, monthIndex - 1, 25)} \u2013 ${shortDate(year, monthIndex, 5)}`,
    question: QUESTIONS.execution,
  };
}

/**
 * Which phases are selectable for a given cycle month, relative to the
 * real current calendar month — the rule worked out from three concrete
 * examples: a past cycle has nothing left to plan or execute (Tracking
 * only), a future cycle hasn't started (Planning only), and the current
 * cycle allows browsing all three freely.
 */
export function phaseAvailability(
  targetMonth: string,
  currentMonth: string,
): Phase[] {
  if (targetMonth < currentMonth) return ["tracking"];
  if (targetMonth > currentMonth) return ["planning"];
  return ["planning", "execution", "tracking"];
}

/**
 * The phase a cycle month defaults to when first selected. Current
 * month mirrors the real global phase right now — except Planning,
 * which is inherently about *next* month, so the current month falls
 * back to Tracking (its settled state) rather than showing Planning
 * about itself.
 */
export function defaultPhaseForMonth(
  targetMonth: string,
  currentMonth: string,
  today: Date = new Date(),
): Phase {
  if (targetMonth < currentMonth) return "tracking";
  if (targetMonth > currentMonth) return "planning";
  const globalPhase = getCurrentPhase(today).phase;
  return globalPhase === "planning" ? "tracking" : globalPhase;
}
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
