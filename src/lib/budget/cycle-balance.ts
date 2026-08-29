import { addMoney, negateMoney, sumMoney, type Money } from "@/lib/money";
import type { MonthlyBudgetSnapshot } from "@/services/BudgetSnapshotService";

/**
 * v3.5.0 — the pure math behind Dashboard's Balance section, kept
 * separate from home-stats.ts's own "committed expense total" (which
 * counts a pending line as committed too) — these two functions care
 * specifically about what's actually POSTED vs. still pending, not the
 * whole cycle's plan regardless of status.
 */

/** Expense/transfer(cash-reducing) lines not yet posted — what's still left to pay this cycle. */
export function computeExpensesRemaining(
  snapshot: MonthlyBudgetSnapshot,
): Money {
  return sumMoney(
    snapshot.lines
      .filter(
        (line) =>
          line.status === "pending" &&
          (line.kind === "expense" ||
            (line.kind === "transfer" && line.transferReducesCashOnHand)),
      )
      .map((line) => line.amount),
  );
}

/**
 * `startingBalance + this cycle's posted income − posted expenses`.
 * Returns null when no starting balance has been set for this cycle
 * yet — the caller shows a "set it" prompt rather than treating an
 * unset balance as zero, which would look like a real answer instead
 * of "unknown."
 */
export function computeRunningBalance(
  snapshot: MonthlyBudgetSnapshot,
  startingBalance: Money | null,
): Money | null {
  if (startingBalance === null) return null;

  const postedIncome = sumMoney(
    snapshot.lines
      .filter((line) => line.kind === "income" && line.status === "posted")
      .map((line) => line.amount),
  );
  const postedExpenses = sumMoney(
    snapshot.lines
      .filter(
        (line) =>
          line.status === "posted" &&
          (line.kind === "expense" ||
            (line.kind === "transfer" && line.transferReducesCashOnHand)),
      )
      .map((line) => line.amount),
  );

  return addMoney(
    addMoney(startingBalance, postedIncome),
    negateMoney(postedExpenses),
  );
}
