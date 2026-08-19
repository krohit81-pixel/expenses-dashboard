/** "2026-07" style month strings, used by the Budget snapshot's month navigation. */

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

/**
 * Which cycle month is "current" right now -- distinct from the
 * literal calendar month (currentMonth()). Atlas's monthly billing
 * cycle rolls into next month's cycle starting the 25th: Jul 25 - Aug
 * 5 is explicitly August's own cycle window, not July's, so from the
 * 25th on, "the cycle you're operating in" is next month's even
 * though the calendar date hasn't turned over yet. Days 1-24 stay on
 * the calendar month unchanged.
 *
 * v1.2.2: added after a household report that Home, Intel's
 * Card-level breakdown, and Budgets' default month all used to
 * default to currentMonth() (July, still) rather than this on the
 * 25th. Anywhere a screen means "the cycle I should default to right
 * now," use this instead of currentMonth() -- currentMonth() stays
 * the literal calendar month for anything genuinely calendar-dated
 * (real transaction activity, the Calendar tab's own month view).
 *
 * v2.0.0: the three-phase Planning/Execution/Tracking system this
 * comment used to describe (lib/dates/phase.ts, getPhaseInfoForCycle,
 * HomePhaseView) is gone -- Atlas no longer has an "Execution phase"
 * to switch on. currentCycleMonth's own rollover behavior is
 * unchanged and still exactly what Home/Budgets/Intel default to.
 */
export function currentCycleMonth(date: Date = new Date()): string {
  const day = date.getUTCDate();
  const base = date.toISOString().slice(0, 7);
  return day >= 25 ? shiftMonth(base, 1) : base;
}

/**
 * The last calendar date inside cycle month `cycleMonth`'s own window —
 * "2026-08" (Jul 25 – Aug 24, per currentCycleMonth's rollover rule
 * above) ends on "2026-08-24", the day before it rolls into "2026-09".
 * Always day 24, so no month-length edge cases to handle.
 *
 * v3.1.2: added so a date-driven action can be scoped to whichever
 * cycle is currently being *viewed* rather than literally today — see
 * generateDueTransactionsAction's own comment for why that distinction
 * mattered (Recurring's "Generate due transactions" used to always run
 * against real today, ignoring the cycle shown on screen).
 */
export function cycleWindowEnd(cycleMonth: string): string {
  return `${cycleMonth}-24`;
}

export function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function isValidMonth(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

export function shortMonthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * A short list of upcoming months for a cycle-tagging <select> —
 * defaults to a short label like "Aug 2026". `startOffset` lets a caller
 * start from next month instead of this one (0 = this month, 1 = next
 * month, ...), or go backward with a negative offset.
 */
export function monthOptions(
  count: number,
  startOffset = 0,
): { value: string; label: string }[] {
  const base = currentMonth();
  return Array.from({ length: count }, (_, i) => {
    const value = shiftMonth(base, startOffset + i);
    return { value, label: shortMonthLabel(value) };
  });
}
