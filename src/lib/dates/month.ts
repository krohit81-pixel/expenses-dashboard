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
 * literal calendar month (currentMonth()) once the Execution phase
 * has begun. Atlas's monthly cycle (see lib/dates/phase.ts) rolls
 * into next month's cycle starting the 25th: Jul 25 - Aug 5 is
 * explicitly August's own Execution window, not July's (see
 * getPhaseInfoForCycle), so from the 25th on, "the cycle you're
 * operating in" is next month's even though the calendar date hasn't
 * turned over yet. Days 1-24 stay on the calendar month unchanged
 * (day 1-5 are still the tail of the PREVIOUS month's rolled-over
 * Execution window, but that window's own cycle target is already the
 * calendar month itself -- see getCurrentPhase's day 1-5 branch -- so
 * no rollover is needed there).
 *
 * v1.2.2: added after a household report that the Execution phase
 * hadn't "switched on" for August despite it being the 25th -- Home's
 * cycle dropdown, Intel's Card-level breakdown, Budgets' default
 * month, and the card-payment quick log's reviewing cycle all used to
 * default to currentMonth() (July, still) rather than this. Anywhere
 * a screen means "the cycle I should default to right now," use this
 * instead of currentMonth() -- currentMonth() stays the literal
 * calendar month for anything genuinely calendar-dated (real
 * transaction activity, the Calendar tab's own month view).
 */
export function currentCycleMonth(date: Date = new Date()): string {
  const day = date.getUTCDate();
  const base = date.toISOString().slice(0, 7);
  return day >= 25 ? shiftMonth(base, 1) : base;
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
