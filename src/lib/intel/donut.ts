/**
 * Pure helpers for building a category-breakdown donut (Intel page,
 * v1.1 for the single this-month donut, extended in v1.2 to back three
 * side-by-side donuts — prev/current/upcoming month — instead of one).
 * Split out so the top-5-plus-Other bucketing and conic-gradient math
 * can be unit tested without rendering anything, and so all three
 * donuts build their slices identically.
 */

import {
  compareMoney,
  moneyToDbNumber,
  sumMoney,
  ZERO,
  type Money,
} from "@/lib/money";
import type { CategoryBreakdown } from "@/services/ReportingService";

export interface DonutSlice {
  name: string;
  total: Money;
}

/** Top 5 categories by amount, everything else bucketed into "Other" — keeps the donut and its legend readable regardless of how many categories are actually in use. */
export function buildDonutSlices(
  expenseByCategory: CategoryBreakdown[],
  categoryName: Map<string, string>,
): DonutSlice[] {
  const sorted = [...expenseByCategory].sort(
    (a, b) => moneyToDbNumber(b.total) - moneyToDbNumber(a.total),
  );
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5);
  const otherTotal = sumMoney(rest.map((c) => c.total));

  return [
    ...top.map((c) => ({
      name: categoryName.get(c.categoryId) ?? "Uncategorized",
      total: c.total,
    })),
    ...(compareMoney(otherTotal, ZERO) > 0
      ? [{ name: "Other", total: otherTotal }]
      : []),
  ];
}

/** One conic-gradient stop per slice, in order — feed straight into a `background: conic-gradient(...)` style. */
export function buildDonutGradientStops(
  slices: DonutSlice[],
  totalExpense: Money,
  colors: readonly string[],
): string[] {
  const total = moneyToDbNumber(totalExpense);
  let cumulative = 0;

  return slices.map((slice, i) => {
    const pct = total > 0 ? (moneyToDbNumber(slice.total) / total) * 100 : 0;
    const from = cumulative;
    cumulative += pct;
    return `${colors[i % colors.length]} ${from}% ${cumulative}%`;
  });
}
