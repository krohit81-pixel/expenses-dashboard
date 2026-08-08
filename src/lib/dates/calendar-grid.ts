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

/**
 * The 7 dates (Monday–Sunday) of the week containing `referenceDateISO`
 * (defaults to today) — added for RecurringWeekGrid (v2.2.0), which
 * needs a single week's dates rather than a 6-week grid. Same
 * Monday-start, UTC-based convention as getMonthGridDates so a day never
 * shifts under a browser's local timezone.
 */
export function getWeekDates(referenceDateISO?: string): string[] {
  const ref = referenceDateISO
    ? new Date(`${referenceDateISO}T00:00:00Z`)
    : new Date(`${todayISODate()}T00:00:00Z`);
  const daysSinceMonday = (ref.getUTCDay() + 6) % 7;
  const monday = new Date(ref);
  monday.setUTCDate(ref.getUTCDate() - daysSinceMonday);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/**
 * Today's date as "YYYY-MM-DD" — explicitly in India's timezone
 * (Asia/Kolkata), not the server's or browser's local time, same
 * reasoning as getIndiaDateLabel in lib/version.ts.
 *
 * v2.5.2: this used to be `new Date().toISOString().slice(0, 10)`,
 * i.e. today in UTC — wrong for anyone opening the app in the morning
 * IST (UTC+5:30): from midnight to 5:30am IST, UTC is still on the
 * previous calendar day, so "today" (the grid's highlighted cell,
 * WeekScheduleGrid's default week, DayDetailCard's "Today"/"In N days"
 * label) silently lagged a day behind what the calendar should show.
 * The rest of this file's Date.UTC-based grid math is unaffected by
 * this fix — only *which* date counts as "today" changes, not how
 * dates are computed relative to it.
 */
export function todayISODate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

/** `dateISO` shifted by `days` (negative to go back) — the single-day
 * equivalent of month.ts's shiftMonth. Added for DayViewModal's
 * prev/next day navigation (v2.3.0); DayViewModal is gone as of v2.5.0
 * (superseded by DayDetailCard, an inline panel rather than a modal),
 * but this is now also how WeekScheduleGrid pages between weeks
 * (`shiftDate(today, weekOffset * 7)`). Same UTC-based convention as
 * the rest of this file. */
export function shiftDate(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
