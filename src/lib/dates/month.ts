/** "2026-07" style month strings, used by the Budget snapshot's month navigation. */

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
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

/**
 * A short list of upcoming months for a cycle-tagging <select> —
 * defaults to a short label like "Aug 2026". `startOffset` lets a caller
 * start from next month instead of this one (0 = this month, 1 = next
 * month, ...).
 */
export function monthOptions(
  count: number,
  startOffset = 0,
): { value: string; label: string }[] {
  const base = currentMonth();
  return Array.from({ length: count }, (_, i) => {
    const value = shiftMonth(base, startOffset + i);
    const label = new Date(`${value}-01T00:00:00Z`).toLocaleDateString(
      "en-US",
      {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      },
    );
    return { value, label };
  });
}
