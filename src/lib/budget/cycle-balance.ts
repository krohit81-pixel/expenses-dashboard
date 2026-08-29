import { addMoney, negateMoney, sumMoney, type Money } from "@/lib/money";
import type { MonthlyBudgetSnapshot } from "@/services/BudgetSnapshotService";

/**
 * v3.5.0 — the pure math behind Dashboard's Balance section, kept
 * separate from home-stats.ts's own "committed expense total" (which
 * counts a pending line as committed too) — this cares specifically
 * about what's still PENDING (not yet paid), not the whole cycle's
 * plan regardless of status.
 *
 * v3.5.1: dropped the earlier "running balance = starting + this
 * cycle's posted income − posted expenses" auto-computation entirely
 * (household request: income shouldn't interfere with Account Balance
 * at all, and posted-expense auto-deduction went with it — Account
 * Balance is now purely "the balance that I keep," a number typed in
 * and read back as-is, never adjusted by marking anything paid).
 * `computeDifference` is the one thing still derived: Account Balance
 * minus what's still pending.
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
 * `accountBalance − expensesRemaining` — "if I paid off everything
 * still pending right now, how much would I actually have left."
 * Deliberately does not touch income at all — Account Balance is a
 * manually-kept figure, not derived from this cycle's transactions.
 * Returns null when no balance has been set for this cycle yet (same
 * "don't show a number when there's nothing real to show" reasoning
 * CycleBalanceService.getCycleStartingBalance already uses).
 */
export function computeDifference(
  accountBalance: Money | null,
  expensesRemaining: Money,
): Money | null {
  if (accountBalance === null) return null;
  return addMoney(accountBalance, negateMoney(expensesRemaining));
}
