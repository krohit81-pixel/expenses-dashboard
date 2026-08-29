import "server-only";

import { sumMoney, type Money } from "@/lib/money";
import { isSpendableAccountType } from "@/lib/accounts/spendable";
import { computeCardDuesTotal } from "@/lib/budget/home-stats";
import { listAccounts } from "@/services/AccountService";
import { listTransactions } from "@/services/TransactionService";

export interface OneOffLine {
  id: string;
  payee: string | null;
  amount: Money;
  currencyCode: string;
  kind: "income" | "expense" | "transfer";
  transferAccountId: string | null;
  status: "pending" | "posted";
  /**
   * Only meaningful for kind: "transfer" (always false otherwise). True
   * when the transfer's destination account is NOT itself a spendable
   * cash account (checking/savings/cash) — i.e. it's paying down a
   * credit card or loan. That kind of transfer really does reduce how
   * much spendable cash you have this cycle, even though it doesn't
   * touch net worth (see NetWorthService's comment on why a card
   * payment nets to zero for net worth specifically — this is a
   * different, cash-flow question, not a net-worth one). A transfer
   * between two of your own spendable accounts is false here: your
   * total spendable cash hasn't changed, just which account it's in.
   */
  transferReducesCashOnHand: boolean;
}

export interface MonthlyBudgetSnapshot {
  /** "2026-08" */
  month: string;
  /** Every live (non-void) transaction tagged to this cycle_month, income/expense/transfer alike. */
  lines: OneOffLine[];
  incomeTotal: Money;
  expenseTotal: Money;
}

/**
 * v3.4.14 flattening: Recurring (templates + `recurring_transaction_id`
 * routing) is gone entirely — the household found the template/bulk-tag
 * workflow too complicated for how they actually use the app, and
 * Transactions is the plain add/edit/delete/tag-to-cycle screen again
 * (see docs/00-current-state.md). Every line here is now just a real
 * `finance.transactions` row tagged to this cycle_month; there's no more
 * "recurring income/fixed-expense" vs. "one-off" distinction to route
 * between, so this returns one flat, uniformly-shaped array instead of
 * the old income/fixedExpenses/oneOff split. `status` (pending vs
 * posted) still distinguishes "committed but not yet paid" from
 * "already happened."
 */
export async function getMonthlyBudgetSnapshot(
  month: string,
): Promise<MonthlyBudgetSnapshot> {
  const [accounts, { transactions: tagged }] = await Promise.all([
    // includeArchived: true — a transfer tagged to a past cycle can
    // point at an account that's since been archived; excluding
    // archived accounts here would make accountType.get(...) return
    // undefined for that historical transfer and silently stop
    // counting it as reducing cash-on-hand.
    listAccounts(true),
    listTransactions({ cycleMonth: month, limit: 300 }),
  ]);

  const accountType = new Map(accounts.map((a) => [a.id, a.accountType]));

  const live = tagged.filter((t) => t.status !== "void");

  const lines: OneOffLine[] = live.map((transaction) => {
    const destinationType = transaction.transferAccountId
      ? accountType.get(transaction.transferAccountId)
      : undefined;
    return {
      id: transaction.id,
      payee: transaction.payee,
      amount: transaction.amount,
      currencyCode: transaction.currencyCode,
      kind: transaction.kind as "income" | "expense" | "transfer",
      transferAccountId: transaction.transferAccountId,
      status: transaction.status === "posted" ? "posted" : "pending",
      transferReducesCashOnHand:
        transaction.kind === "transfer" &&
        destinationType !== undefined &&
        !isSpendableAccountType(destinationType),
    };
  });

  const incomeTotal = sumMoney(
    lines.filter((l) => l.kind === "income").map((l) => l.amount),
  );
  const expenseTotal = sumMoney(
    lines.filter((l) => l.kind === "expense").map((l) => l.amount),
  );

  return { month, lines, incomeTotal, expenseTotal };
}

/**
 * Planned/logged credit card (or loan) payments for a set of cycle
 * months, keyed by "YYYY-MM" -- v1.6.3, built for Intel's By-category
 * donuts and month-on-month chart, which need this same figure for
 * several specific months at once (prev/current/next, plus the trend
 * months). One getMonthlyBudgetSnapshot call per month, run in
 * parallel -- each is already a small, fixed number of queries (see
 * that function's own reasoning). Still used by IntelService's AI
 * insight generation; Intel's own Card-level breakdown switched to
 * real per-statement dues in v1.12.2 and Home dropped this figure
 * entirely in v2.0.0 (see dashboard/page.tsx's own comment).
 * Every requested month gets an entry, "0.00" when there's no such
 * transfer that cycle -- callers don't need to special-case absence.
 */
export async function getPlannedCardDuesForMonths(
  months: string[],
): Promise<Map<string, Money>> {
  const snapshots = await Promise.all(
    months.map((month) => getMonthlyBudgetSnapshot(month)),
  );
  return new Map(
    snapshots.map((snapshot) => [
      snapshot.month,
      computeCardDuesTotal(snapshot),
    ]),
  );
}
