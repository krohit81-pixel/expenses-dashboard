import "server-only";

import { OWNER_USER_ID } from "@/lib/owner";
import { createServiceClient } from "@/lib/supabase/service";
import {
  buildCardCategoryBreakdown,
  buildMonthlyCardTotals,
  type CardCategoryBreakdownResult,
  type MonthlyCardTotal,
} from "@/lib/intel/card-category-breakdown";

export type {
  CardCategoryBreakdownResult,
  CardBreakdown,
  CardCategoryAmount,
  MonthlyCardTotal,
} from "@/lib/intel/card-category-breakdown";

/**
 * Whether ANY credit card statement has ever been imported -- used to
 * tell "nothing imported yet" apart from "imported, but nothing this
 * particular month" on the Intel page's card-breakdown section. A
 * single cheap existence check rather than folding into
 * getCardCategoryBreakdown itself, since the two questions ("has
 * anything ever been imported" vs. "what happened this month") have
 * different callers/purposes even though they'll usually be checked
 * together.
 */
export async function hasAnyCreditCardStatement(): Promise<boolean> {
  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from("credit_card_statements")
    .select("id", { count: "exact", head: true })
    .eq("user_id", OWNER_USER_ID);

  if (error) {
    throw new Error(
      `Failed to check for existing credit card statements: ${error.message}`,
    );
  }
  return (count ?? 0) > 0;
}

/**
 * Card-level category breakdown for one cash-flow cycle month, both
 * per-card and aggregated across every card -- the Intel page's
 * "Card-level breakdown" section. Debit transactions only (same
 * reasoning as MerchantService's totalSpend: a credit under a
 * merchant, rare, was never "spend"). Sums in application code via
 * buildCardCategoryBreakdown, not a SQL aggregate -- same reasoning as
 * every other reporting query in this codebase (see ReportingService's
 * own note): no aggregate RPC/view exists yet, and this app's data
 * volume doesn't need one.
 *
 * v1.6.1: filters by the owning statement's cycle_month, not by
 * transaction_date -- see src/lib/statement-cycle.ts for why a
 * statement's cycle can differ from the calendar month its individual
 * transaction dates fall in. `!inner` on credit_card_statements turns
 * the embed into an inner join so the cycle_month filter actually
 * restricts the outer credit_card_transactions rows returned, rather
 * than just filtering the embedded object per PostgREST's default
 * left-join embedding behavior.
 */
export async function getCardCategoryBreakdown(
  month: string,
): Promise<CardCategoryBreakdownResult> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("credit_card_transactions")
    .select(
      "amount, credit_card_statements!inner(issuer, card_type, card_last4, cycle_month), merchants(atlas_category_id)",
    )
    .eq("user_id", OWNER_USER_ID)
    .eq("transaction_type", "debit")
    .eq("credit_card_statements.cycle_month", month);

  if (error) {
    throw new Error(`Failed to load card category breakdown: ${error.message}`);
  }

  const rows = data
    // A transaction always has its own statement (statement_id is
    // required, not nullable) -- this filter is just narrowing the type
    // for TypeScript, not expected to actually drop anything.
    .filter((row) => row.credit_card_statements !== null)
    .map((row) => ({
      amount: row.amount,
      issuer: row.credit_card_statements!.issuer,
      cardType: row.credit_card_statements!.card_type,
      cardLast4: row.credit_card_statements!.card_last4,
      atlasCategoryId: row.merchants?.atlas_category_id ?? null,
    }));

  return buildCardCategoryBreakdown(rows);
}

/**
 * Card debit spend (every card combined) for a set of cash-flow cycle
 * months, keyed by "YYYY-MM" -- built for folding credit card spend
 * into Intel's existing ledger-only cash-flow charts (month-on-month
 * expenditure, income vs. expenses, the by-category donuts), which all
 * work in terms of a handful of specific months at once rather than
 * one at a time. One query covering every requested month via `.in()`,
 * not one query per month.
 *
 * v1.6.1: grouped by the owning statement's cycle_month, not
 * transaction_date -- see src/lib/statement-cycle.ts. A month with no
 * card activity simply has no entry in the returned Map (not a
 * zeroed-out one) -- same "absence means zero" convention as every
 * other summary query in this codebase.
 */
export async function getCardExpenseForMonths(
  months: string[],
): Promise<Map<string, MonthlyCardTotal>> {
  if (months.length === 0) return new Map();

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("credit_card_transactions")
    .select(
      "amount, credit_card_statements!inner(cycle_month), merchants(atlas_category_id)",
    )
    .eq("user_id", OWNER_USER_ID)
    .eq("transaction_type", "debit")
    .in("credit_card_statements.cycle_month", months);

  if (error) {
    throw new Error(`Failed to load monthly card expense: ${error.message}`);
  }

  const rows = data
    // Same "always has a statement" narrowing as getCardCategoryBreakdown.
    .filter((row) => row.credit_card_statements !== null)
    .map((row) => ({
      amount: row.amount,
      cycleMonth: row.credit_card_statements!.cycle_month,
      atlasCategoryId: row.merchants?.atlas_category_id ?? null,
    }));

  return new Map(buildMonthlyCardTotals(rows).map((t) => [t.month, t]));
}
