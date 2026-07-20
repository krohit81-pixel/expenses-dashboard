/**
 * Pure helpers for building a category-breakdown donut (Intel page,
 * v1.1 for the single this-month donut, extended in v1.2 to back three
 * side-by-side donuts — prev/current/upcoming month — instead of one).
 * Split out so the top-5-plus-Other bucketing and conic-gradient math
 * can be unit tested without rendering anything, and so all three
 * donuts build their slices identically.
 */

import {
  addMoney,
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

export interface NamedAmount {
  name: string;
  total: Money;
}

/**
 * Merges category breakdowns that come from DIFFERENT id namespaces --
 * e.g. the ledger's finance.categories (via ReportingService) and the
 * Merchant Dictionary's atlas_categories (via credit card spend) --
 * into one, by matching on resolved display NAME rather than id, since
 * name is the only sensible join key across two unrelated id spaces. A
 * category that exists in only one of the two groups just becomes its
 * own entry with whatever total it already had; a name present in both
 * gets its amounts added together. categoryId null in any group's
 * breakdown (a transaction with no category yet) is treated the same
 * as an id with no matching name -- both fall into "Uncategorized",
 * merged across groups too rather than kept as separate buckets.
 *
 * Feed the result into buildDonutSlices by using each returned name as
 * its own "id" together with an identity name map (Map(name -> name))
 * -- reuses that function's existing top-5-plus-Other bucketing as-is,
 * rather than duplicating it for a name-keyed variant.
 */
export function mergeCategoryTotalsByName(
  groups: {
    breakdown: { categoryId: string | null; total: Money }[];
    categoryName: Map<string, string>;
  }[],
): NamedAmount[] {
  const combined = new Map<string, Money>();
  for (const group of groups) {
    for (const item of group.breakdown) {
      const name = item.categoryId
        ? (group.categoryName.get(item.categoryId) ?? "Uncategorized")
        : "Uncategorized";
      combined.set(name, addMoney(combined.get(name) ?? ZERO, item.total));
    }
  }
  return Array.from(combined.entries()).map(([name, total]) => ({
    name,
    total,
  }));
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
