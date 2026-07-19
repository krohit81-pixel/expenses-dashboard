import type { ReactNode } from "react";

/**
 * The "titled card with a running total" shell used everywhere a list
 * gets split into income vs. expense — Budgets had this hand-written
 * inline (twice, once per column); Home and Transactions needed the
 * exact same shell, so this is the shared version instead of a third
 * and fourth hand copy.
 *
 * Deliberately doesn't own row rendering — each caller's rows differ too
 * much to force through one shape (Budgets' plain rows, Home's
 * interactive ChecklistItem checkboxes, Transactions' full TransactionRow
 * with edit/delete). This owns only the part that's genuinely identical
 * everywhere: the card, the header, the total, the empty state.
 */
export function SplitCard({
  title,
  titleColorClass,
  total,
  isEmpty,
  emptyText = "None this month.",
  children,
}: {
  title: string;
  titleColorClass: string;
  /** Optional (v1.2) — a running total only makes sense when the list
   * below is scoped to one period. Transactions' "Recent" list can span
   * several cycle months at once (no date filter applied), where a
   * summed total would just be a meaningless number; that caller omits
   * this prop rather than passing a misleading total. */
  total?: string;
  isEmpty: boolean;
  emptyText?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
      <div className="flex items-center justify-between px-[18px] py-4">
        <h2 className={`font-display text-sm font-bold ${titleColorClass}`}>
          {title}
        </h2>
        {total && (
          <span className="font-display text-xs font-bold text-ink-faint">
            {total}
          </span>
        )}
      </div>
      {isEmpty ? (
        <p className="px-[18px] pb-4 text-sm text-ink-faint">{emptyText}</p>
      ) : (
        <ul>{children}</ul>
      )}
    </div>
  );
}
