/**
 * Groups transactions by cycle_month for the Transactions page's Recent
 * list (v1.1.1) — a flat 50-row list of expenses/transfers was hard to
 * scan; grouping by the financial cycle they're tagged to (the same
 * concept Budgets/Home use, not the calendar month they happened on)
 * gives it the same visual structure as those pages. Untagged
 * transactions ("not counted anywhere") get their own trailing group
 * rather than being scattered in among dated ones — see
 * docs/01-product-vision.md's cycle-tagging model for why untagged is a
 * meaningfully different bucket, not just a missing value.
 */

import { monthLabel } from "@/lib/dates/month";

export interface CycleGroup<T> {
  /** null for the untagged bucket. */
  cycleMonth: string | null;
  label: string;
  items: T[];
}

export function groupByCycleMonth<T extends { cycleMonth: string | null }>(
  items: T[],
): CycleGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const key = item.cycleMonth ?? "untagged";
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  const taggedKeys = Array.from(buckets.keys())
    .filter((key) => key !== "untagged")
    .sort((a, b) => b.localeCompare(a)); // most recent cycle first, matching the page's overall recency-first order

  const groups: CycleGroup<T>[] = taggedKeys.map((cycleMonth) => ({
    cycleMonth,
    label: `${monthLabel(cycleMonth)} cycle`,
    items: buckets.get(cycleMonth)!,
  }));

  const untagged = buckets.get("untagged");
  if (untagged) {
    groups.push({
      cycleMonth: null,
      label: "Untagged — not counted",
      items: untagged,
    });
  }

  return groups;
}
