import { sumMoney, type Money } from "@/lib/money";
import type { MonthlyBudgetSnapshot } from "@/services/BudgetSnapshotService";

/**
 * Every logged expense this cycle, plus transfers that behave like a
 * real cash outflow (paying down a card/loan — see
 * BudgetSnapshotService's comment on `transferReducesCashOnHand`). Used
 * for Dashboard's Net figure and by Intel's month-on-month chart/donut
 * for "how much will this month cost."
 *
 * v3.4.14: simplified alongside BudgetSnapshotService's flattening —
 * there's no more separate "fixed recurring expenses" total to add on
 * top of; every expense line lives in `snapshot.lines` now.
 */
export function computeCommittedExpenseTotal(
  snapshot: MonthlyBudgetSnapshot,
): Money {
  return sumMoney(
    snapshot.lines
      .filter(
        (line) =>
          line.kind === "expense" ||
          (line.kind === "transfer" && line.transferReducesCashOnHand),
      )
      .map((line) => line.amount),
  );
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
 * payment" on Transactions), which is complete regardless of parser
 * coverage.
 */
export function computeCardDuesTotal(snapshot: MonthlyBudgetSnapshot): Money {
  return sumMoney(
    snapshot.lines
      .filter(
        (line) => line.kind === "transfer" && line.transferReducesCashOnHand,
      )
      .map((line) => line.amount),
  );
}
