import "server-only";

import { z } from "zod";

import {
  addMoney,
  dbNumberToMoney,
  negateMoney,
  ZERO,
  type Money,
} from "@/lib/money";
import { createServiceClient } from "@/lib/supabase/service";
import { OWNER_USER_ID } from "@/lib/owner";

export const cashFlowRangeSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
});

export type CashFlowRange = z.infer<typeof cashFlowRangeSchema>;

export interface CategoryBreakdown {
  categoryId: string;
  total: Money;
}

export interface CashFlowSummary {
  from: string;
  to: string;
  totalIncome: Money;
  totalExpense: Money;
  net: Money;
  expenseByCategory: CategoryBreakdown[];
}

/**
 * Income and expense only — transfers are excluded by design. A transfer
 * moves money between the person's own accounts and nets to zero across
 * the ledger as a whole; it was never income or spending. See
 * TransactionService's note on why "adjustment" transactions don't exist
 * yet either.
 *
 * Sums in application code rather than a SQL aggregate for the same reason
 * as AccountService.getAccountBalance — no aggregate RPC/view exists yet.
 * This is the first candidate to move server-side if dashboard latency
 * ever becomes noticeable (see docs/02).
 */
export async function getCashFlowSummary(
  range: CashFlowRange,
): Promise<CashFlowSummary> {
  const parsed = cashFlowRangeSchema.parse(range);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("transactions")
    .select("amount, kind, transaction_splits(category_id, amount)")
    .eq("user_id", OWNER_USER_ID)
    .eq("status", "posted")
    .in("kind", ["income", "expense"])
    .gte("occurred_on", parsed.from)
    .lte("occurred_on", parsed.to);

  if (error) {
    throw new Error(`Failed to load cash flow summary: ${error.message}`);
  }

  let totalIncome: Money = ZERO;
  let totalExpense: Money = ZERO;
  const expenseByCategoryMap = new Map<string, Money>();

  for (const row of data) {
    const amount = dbNumberToMoney(row.amount);

    if (row.kind === "income") {
      totalIncome = addMoney(totalIncome, amount);
      continue;
    }

    totalExpense = addMoney(totalExpense, amount);

    // Every expense transaction has at least one split row —
    // TransactionService.createTransaction always writes exactly one for
    // the single-category path, so this is never empty in practice.
    for (const split of row.transaction_splits) {
      const splitAmount = dbNumberToMoney(split.amount);
      expenseByCategoryMap.set(
        split.category_id,
        addMoney(
          expenseByCategoryMap.get(split.category_id) ?? ZERO,
          splitAmount,
        ),
      );
    }
  }

  const expenseByCategory: CategoryBreakdown[] = Array.from(
    expenseByCategoryMap.entries(),
  ).map(([categoryId, total]) => ({ categoryId, total }));

  return {
    from: parsed.from,
    to: parsed.to,
    totalIncome,
    totalExpense,
    net: addMoney(totalIncome, negateMoney(totalExpense)),
    expenseByCategory,
  };
}
