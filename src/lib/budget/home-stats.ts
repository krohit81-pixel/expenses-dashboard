import { addMoney, negateMoney, sumMoney, ZERO, type Money } from "@/lib/money";
import type { MonthlyBudgetSnapshot } from "@/services/BudgetSnapshotService";

export interface HomeStats {
  expected: Money;
  committed: Money;
  paid: Money;
  remaining: Money;
}

/**
 * The four headline numbers on Home: how much income is expected this
 * month, how much is committed to go out, how much of that's already
 * paid, and what's left. Pure — takes an already-fetched snapshot rather
 * than querying anything itself, so this is fully unit-testable without
 * a database.
 */
export function computeHomeStats(snapshot: MonthlyBudgetSnapshot): HomeStats {
  const expected = sumMoney([
    ...snapshot.income.map((line) => line.amount),
    ...snapshot.oneOff
      .filter((line) => line.kind === "income")
      .map((line) => line.amount),
  ]);

  const committedLines = [
    ...snapshot.fixedExpenses,
    ...snapshot.oneOff.filter((line) => line.kind !== "income"),
  ];
  const committed = sumMoney(committedLines.map((line) => line.amount));
  const paid = sumMoney(
    committedLines
      .filter((line) => line.status === "posted")
      .map((line) => line.amount),
  );
  const remaining =
    committedLines.length === 0 ? ZERO : addMoney(committed, negateMoney(paid));

  return { expected, committed, paid, remaining };
}

/**
 * Income receivables minus everything committed to go out (fixed
 * recurring expenses, card payments, and other one-off expenses/
 * transfers) — the actual "will this month end up positive" number.
 * One-off INCOME (e.g. rent received) is deliberately excluded from
 * both sides here: it's not part of "income receivables" (that's the
 * recurring income section specifically), and it already isn't a
 * commitment, so it doesn't belong in the subtracted half either.
 *
 * Extracted from what used to be a duplicate inline function inside
 * HomePhaseView — Budgets' headline needed the exact same math, and
 * hand-copying it a second time is exactly the kind of thing that
 * quietly drifts apart later.
 */
export function computeProjectedClosing(
  snapshot: MonthlyBudgetSnapshot,
): Money {
  const oneOffCommitted = sumMoney(
    snapshot.oneOff
      .filter((line) => line.kind !== "income")
      .map((line) => line.amount),
  );
  const committed = addMoney(snapshot.fixedExpenseTotal, oneOffCommitted);
  return addMoney(snapshot.incomeTotal, negateMoney(committed));
}
