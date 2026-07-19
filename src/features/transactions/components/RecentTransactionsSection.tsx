"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { SplitCard } from "@/components/ui/split-card";
import {
  TransactionRow,
  type TransactionRowData,
} from "@/features/transactions/components/TransactionRow";
import { groupByCycleMonth } from "@/features/transactions/group-by-cycle";

/**
 * The Transactions page's "Recent" block (v1.1.1) — collapsible (this
 * can be dozens of rows, and there's a whole "Add transaction" form
 * below it that used to require scrolling past all of them), and the
 * Expenses & transfers side is grouped by financial cycle rather than a
 * flat list, matching how Budgets/Home already organize things by
 * cycle_month. Income stays a flat list — it's usually a handful of
 * rows a month, grouping it added structure without adding scannability.
 *
 * v1.2: dropped the running income/expense totals from both column
 * headers. This list has no date filter by default — it's whatever the
 * most recent up-to-200 transactions are, which routinely spans several
 * cycle months at once. Summing "income total" across an arbitrary
 * multi-month window isn't a number that means anything; it just looked
 * like one. A correctly-scoped total (by month, or by whatever filter
 * is actually applied) still exists elsewhere — Home and Budgets.
 */
export function RecentTransactionsSection({
  incomeTransactions,
  expenseTransactions,
  total,
  accountName,
  categoryName,
}: {
  incomeTransactions: TransactionRowData[];
  expenseTransactions: TransactionRowData[];
  /** The exact count from the DB query, not incomeTransactions.length + expenseTransactions.length — those two arrays only cover the current page (listTransactions caps at 200), so deriving the header count from them would under-report once a filter matches more than that. */
  total: number;
  accountName: Map<string, string>;
  categoryName: Map<string, string>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const expenseGroups = groupByCycleMonth(expenseTransactions);

  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="mb-3 flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={!collapsed}
      >
        <h2 className="font-display text-[15px] font-bold text-ink">Recent</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-faint">
            {total} transaction{total === 1 ? "" : "s"}
          </span>
          <ChevronDown
            className={cn(
              "size-4 text-ink-faint transition-transform",
              !collapsed && "rotate-180",
            )}
          />
        </div>
      </button>

      {!collapsed &&
        (incomeTransactions.length + expenseTransactions.length === 0 ? (
          <p className="text-sm text-ink-faint">
            No transactions match these filters.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SplitCard
              title="Income"
              titleColorClass="text-positive"
              isEmpty={incomeTransactions.length === 0}
            >
              {incomeTransactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  accountName={accountName}
                  categoryName={categoryName}
                />
              ))}
            </SplitCard>

            <div className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
              <div className="flex items-center justify-between px-[18px] py-4">
                <h3 className="font-display text-sm font-bold text-negative">
                  Expenses &amp; transfers
                </h3>
              </div>
              {expenseTransactions.length === 0 ? (
                <p className="px-[18px] pb-4 text-sm text-ink-faint">
                  None this month.
                </p>
              ) : (
                expenseGroups.map((group) => (
                  <div key={group.cycleMonth ?? "untagged"}>
                    <div className="bg-bg px-[18px] pb-2 pt-3 font-display text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
                      {group.label}
                    </div>
                    <ul>
                      {group.items.map((transaction) => (
                        <TransactionRow
                          key={transaction.id}
                          transaction={transaction}
                          accountName={accountName}
                          categoryName={categoryName}
                        />
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
    </div>
  );
}
