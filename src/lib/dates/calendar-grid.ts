/**
 * Month-grid math for the Travel-in-Calendar feature (v1.0). Separate
 * from month.ts's "YYYY-MM" navigation helpers because this operates one
 * level down — actual day cells for a 6-week, Monday-start grid — which
 * month.ts has no existing concept of.
 */

/** Every date shown on a 6-week (42-cell) Monday-start grid for `month`, including the leading/trailing days that belong to adjacent months. Always Date.UTC-based, matching month.ts's approach, so a day never shifts under a browser's local timezone. */
export function getMonthGridDates(month: string): string[] {
  const [year, m] = month.split("-").map(Number);
  const firstOfMonth = new Date(Date.UTC(year, m - 1, 1));
  // getUTCDay(): 0 = Sunday .. 6 = Saturday. Convert to "days since the
  // most recent Monday" (0 when the 1st is itself a Monday).
  const daysSinceMonday = (firstOfMonth.getUTCDay() + 6) % 7;
  const gridStart = new Date(Date.UTC(year, m - 1, 1 - daysSinceMonday));

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/** Whether an ISO date ("YYYY-MM-DD") falls within `month` ("YYYY-MM") — used to dim the leading/trailing days from adjacent months on the grid. */
export function isInMonth(dateISO: string, month: string): boolean {
  return dateISO.startsWith(month);
}

/** Today's date as "YYYY-MM-DD", UTC-based like the rest of this file. */
export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}
