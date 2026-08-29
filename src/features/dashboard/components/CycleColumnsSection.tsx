import { SplitCard } from "@/components/ui/split-card";
import {
  TransactionRow,
  type TransactionRowData,
} from "@/features/transactions/components/TransactionRow";

/**
 * v3.5.0 — Dashboard's "Logged This Cycle", replacing the read-only
 * LoggedFeedList (deleted) with a real, interactive two-column split:
 * Expenses on the left, Income on the right (the household's own
 * explicit request, opposite of RecentTransactionsSection's own
 * Income-left/Expenses-right order on /transactions — deliberately a
 * separate, small component rather than a shared-with-Transactions one,
 * so this order isn't silently flipped there too).
 *
 * Reuses TransactionRow directly (mark paid/pending, inline edit,
 * delete — the same "mark done"/undo the household prototyped, since
 * that's exactly what pending<->posted already does) rather than a new
 * read-only row component — a scoped-to-one-cycle server component, so
 * no collapse toggle or cycle-grouping is needed the way
 * RecentTransactionsSection's own multi-month "Recent" list needs.
 */
export function CycleColumnsSection({
  expenseTransactions,
  incomeTransactions,
  accountName,
  categoryName,
}: {
  expenseTransactions: TransactionRowData[];
  incomeTransactions: TransactionRowData[];
  accountName: Map<string, string>;
  categoryName: Map<string, string>;
}) {
  if (expenseTransactions.length === 0 && incomeTransactions.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-surface p-4 text-xs text-ink-faint">
        Nothing logged for this cycle yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
        <div className="flex items-center justify-between px-[18px] py-4">
          <h3 className="font-display text-sm font-bold text-negative">
            Expenses
          </h3>
        </div>
        {expenseTransactions.length === 0 ? (
          <p className="px-[18px] pb-4 text-sm text-ink-faint">
            None this cycle.
          </p>
        ) : (
          <ul>
            {expenseTransactions.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                accountName={accountName}
                categoryName={categoryName}
              />
            ))}
          </ul>
        )}
      </div>

      <SplitCard
        title="Income"
        titleColorClass="text-positive"
        isEmpty={incomeTransactions.length === 0}
        emptyText="None this cycle."
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
    </div>
  );
}
