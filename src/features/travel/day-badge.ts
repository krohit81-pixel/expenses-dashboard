/**
 * Formats the day-number column used by TripDetailedList's rows. Pulled
 * out as a pure function (v1.1.7) so the cross-month fix below can be
 * regression-tested directly, the same way detailed-list.ts's filtering
 * logic already is, rather than only being reachable through rendering
 * the component.
 */

export type DayBadge =
  | { kind: "single"; day: string; weekday: string }
  | { kind: "range"; label: string }
  | { kind: "cross-month"; startLabel: string; endLabel: string };

function formatShortMonthDay(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * A multi-day item spanning two different months used to show as e.g.
 * "31–4" — correct for a same-month range, but ambiguous (and reported
 * as such) once the start and end fall in different months: nothing
 * there says which direction the range runs, or that a month boundary
 * is even involved. Cross-month ranges now spell out both months
 * explicitly ("Jul 31" / "Aug 4") instead of just the day numbers.
 */
export function dayBadge(startDate: string, endDate: string): DayBadge {
  const start = new Date(`${startDate}T00:00:00Z`);
  if (startDate === endDate) {
    return {
      kind: "single",
      day: String(start.getUTCDate()),
      weekday: start.toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: "UTC",
      }),
    };
  }
  const end = new Date(`${endDate}T00:00:00Z`);
  const crossesMonth =
    start.getUTCFullYear() !== end.getUTCFullYear() ||
    start.getUTCMonth() !== end.getUTCMonth();
  if (crossesMonth) {
    return {
      kind: "cross-month",
      startLabel: formatShortMonthDay(start),
      endLabel: formatShortMonthDay(end),
    };
  }
  return {
    kind: "range",
    label: `${start.getUTCDate()}–${end.getUTCDate()}`,
  };
}
