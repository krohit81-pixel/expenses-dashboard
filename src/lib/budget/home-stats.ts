import { addMoney, negateMoney, sumMoney, type Money } from "@/lib/money";
import type { MonthlyBudgetSnapshot } from "@/services/BudgetSnapshotService";

/**
 * All income (recurring + one-off) minus everything committed to go out
 * (fixed recurring expenses, card payments, and other one-off expenses)
 * — "will this month end up positive."
 *
 * One-off income counts here now — it didn't in an earlier version,
 * which excluded it as "not income receivables specifically." That fell
 * apart on a real case: a one-off entry representing starting cash
 * ("Balance left in July," tagged as income) sat outside the formula
 * entirely and made the projected balance read as far more negative
 * than the person's actual position. Any money coming in should offset
 * money going out regardless of whether it's recurring or one-off —
 * the narrower reading was over-strict, not the intended behavior.
 *
 * v1.1.4: transfers are excluded from oneOffCommitted entirely, not
 * lumped in with expenses. A transfer moves money between two of your
 * own accounts — it doesn't leave your overall position, so subtracting
 * it here double-counted it as a real cost (moving 10,000 from checking
 * to savings made the projected closing balance look 10,000 worse, when
 * your actual total across both accounts hadn't changed at all). Only
 * `expense` reduces what's "committed to go out" in this net-worth-level
 * projection; `income` still adds, and `transfer` now contributes
 * nothing either way.
 */
export function computeProjectedClosing(
  snapshot: MonthlyBudgetSnapshot,
): Money {
  const oneOffIncome = sumMoney(
    snapshot.oneOff
      .filter((line) => line.kind === "income")
      .map((line) => line.amount),
  );
  const oneOffCommitted = sumMoney(
    snapshot.oneOff
      .filter((line) => line.kind === "expense")
      .map((line) => line.amount),
  );
  const totalIncome = addMoney(snapshot.incomeTotal, oneOffIncome);
  const totalCommitted = addMoney(snapshot.fixedExpenseTotal, oneOffCommitted);
  return addMoney(totalIncome, negateMoney(totalCommitted));
}
