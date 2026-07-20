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
 * v1.1.4 excluded every transfer from oneOffCommitted, reasoning that a
 * transfer between your own accounts doesn't change your overall
 * position. True for net worth, but this figure is a cash-on-hand
 * projection, not a net-worth one — v1.1.4 went too far and stopped
 * subtracting real credit-card payments too (a transfer TO a card is a
 * real cash outflow this cycle, even though it doesn't touch net
 * worth). v1.1.5 narrows it back: a transfer only contributes to
 * oneOffCommitted when transferReducesCashOnHand is true (destination
 * isn't a spendable account — see BudgetSnapshotService and
 * lib/accounts/spendable.ts). A transfer between two spendable accounts
 * still contributes nothing, same as v1.1.4 intended.
 */
/**
 * Fixed recurring expenses plus one-off items that behave like a real
 * cash outflow this month (real expenses, and transfers that reduce
 * cash on hand — see BudgetSnapshotService's comment on
 * transferReducesCashOnHand). This is the "committed" half of
 * computeProjectedClosing below, split out as its own function (v1.2)
 * so Intel's month-on-month chart and donut can reuse the exact same
 * "how much will this month cost" figure for a not-yet-real future
 * month (a snapshot for a month with no actual transactions yet still
 * has real fixedExpenses/oneOff data once recurring items are tagged
 * to that cycle) instead of a third hand-copy of this filter.
 */
export function computeCommittedExpenseTotal(
  snapshot: MonthlyBudgetSnapshot,
): Money {
  const oneOffCommitted = sumMoney(
    snapshot.oneOff
      .filter(
        (line) =>
          line.kind === "expense" ||
          (line.kind === "transfer" && line.transferReducesCashOnHand),
      )
      .map((line) => line.amount),
  );
  return addMoney(snapshot.fixedExpenseTotal, oneOffCommitted);
}

/**
 * Just the "transfer that reduces cash on hand" portion of a month's
 * committed expenses -- i.e. planned/logged credit card (or loan)
 * payments tagged to this cycle (same total Home's "Card payments due"
 * shows). Deliberately narrower than computeCommittedExpenseTotal
 * above, which also folds in one-off *expenses* -- those can already
 * be counted by ReportingService.getCashFlowSummary (which sums by
 * occurred_on, not cycle_month, and knows nothing about this snapshot)
 * for the same calendar month, so adding the full committed total on
 * top of a getCashFlowSummary total would double-count them. A
 * transfer, by contrast, is excluded from getCashFlowSummary by design
 * (see that module's own comment on why) -- so it's the one piece of
 * this snapshot that's safe to add on top without double-counting.
 *
 * v1.6.3: this is what Intel's By-category donuts and month-on-month
 * chart use for card spend now, in place of real per-statement data
 * from CreditCardIntelService. Real statement data undercounts the
 * household's true obligation until every card has a parser (today,
 * only one of theirs does) -- this planned/logged figure is whatever
 * they've already tagged for that cycle (e.g. via "Log a card
 * payment" on Transactions, during Atlas's own Planning phase), which
 * is complete regardless of parser coverage.
 */
export function computeCardDuesTotal(snapshot: MonthlyBudgetSnapshot): Money {
  return sumMoney(
    snapshot.oneOff
      .filter(
        (line) => line.kind === "transfer" && line.transferReducesCashOnHand,
      )
      .map((line) => line.amount),
  );
}

export function computeProjectedClosing(
  snapshot: MonthlyBudgetSnapshot,
): Money {
  const oneOffIncome = sumMoney(
    snapshot.oneOff
      .filter((line) => line.kind === "income")
      .map((line) => line.amount),
  );
  const totalIncome = addMoney(snapshot.incomeTotal, oneOffIncome);
  const totalCommitted = computeCommittedExpenseTotal(snapshot);
  return addMoney(totalIncome, negateMoney(totalCommitted));
}
