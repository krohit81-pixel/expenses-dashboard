import type { Enum } from "@/lib/db/helpers";

export type RecurrenceFrequency = Enum<"recurrence_frequency">;

interface DateParts {
  year: number;
  month: number; // 0-11
  day: number;
}

function parseISODate(value: string): DateParts {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month: month - 1, day };
}

function formatISODate({ year, month, day }: DateParts): string {
  const y = String(year).padStart(4, "0");
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of `month`.
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function addDays(date: DateParts, days: number): DateParts {
  const result = new Date(Date.UTC(date.year, date.month, date.day));
  result.setUTCDate(result.getUTCDate() + days);
  return {
    year: result.getUTCFullYear(),
    month: result.getUTCMonth(),
    day: result.getUTCDate(),
  };
}

/**
 * Advances `date` by `monthsToAdd` months, using `anchorDay` (not `date`'s
 * own day-of-month) for end-of-month clamping.
 *
 * This matters: without an anchor, a monthly recurrence starting on the
 * 31st permanently decays after the first short month (Jan 31 -> Feb 28 ->
 * Mar 28 -> Apr 28 -> ...) because each step clamps against the *previous*
 * step's already-clamped day. Anchoring against the original starts_on day
 * every time gives the billing-system-standard behavior instead: Jan 31 ->
 * Feb 28 -> Mar 31 -> Apr 30 -> May 31 -> ...
 */
function addMonthsAnchored(
  date: DateParts,
  monthsToAdd: number,
  anchorDay: number,
): DateParts {
  const totalMonths = date.year * 12 + date.month + monthsToAdd;
  const year = Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 12) % 12;
  const day = Math.min(anchorDay, daysInMonth(year, month));
  return { year, month, day };
}

/**
 * Computes the next occurrence date after `currentOccurrence`, given the
 * template's original `startsOn` date (used only for its day-of-month, as
 * the clamping anchor — see addMonthsAnchored) and the recurrence rule.
 */
export function computeNextOccurrence(
  startsOn: string,
  currentOccurrence: string,
  frequency: RecurrenceFrequency,
  intervalCount: number,
): string {
  const anchor = parseISODate(startsOn);
  const current = parseISODate(currentOccurrence);

  switch (frequency) {
    case "daily":
      return formatISODate(addDays(current, intervalCount));
    case "weekly":
      return formatISODate(addDays(current, intervalCount * 7));
    case "monthly":
      return formatISODate(
        addMonthsAnchored(current, intervalCount, anchor.day),
      );
    case "quarterly":
      return formatISODate(
        addMonthsAnchored(current, intervalCount * 3, anchor.day),
      );
    case "yearly":
      return formatISODate(
        addMonthsAnchored(current, intervalCount * 12, anchor.day),
      );
    default: {
      const exhaustiveCheck: never = frequency;
      throw new Error(
        `Unhandled recurrence frequency: ${String(exhaustiveCheck)}`,
      );
    }
  }
}

/**
 * Every occurrence date from `startsOn` up to and including `until`
 * (inclusive), respecting `endsOn` if set. Used to generate any occurrences
 * a recurring template missed since it was last run — not just the single
 * next one — so a template that hasn't run in months catches up correctly
 * rather than jumping straight to "today".
 */
export function occurrencesUpTo(
  startsOn: string,
  frequency: RecurrenceFrequency,
  intervalCount: number,
  from: string,
  until: string,
  endsOn: string | null,
): string[] {
  const occurrences: string[] = [];
  let cursor = from;
  let safety = 0;

  while (cursor <= until && (endsOn === null || cursor <= endsOn)) {
    occurrences.push(cursor);
    cursor = computeNextOccurrence(startsOn, cursor, frequency, intervalCount);

    safety += 1;
    if (safety > 10_000) {
      throw new Error(
        "occurrencesUpTo exceeded safety limit — check for a non-advancing rule",
      );
    }
  }

  return occurrences;
}
