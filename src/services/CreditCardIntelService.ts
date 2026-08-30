import "server-only";

import {
  dbNumberToMoney,
  moneyToDbNumber,
  sumMoney,
  type Money,
} from "@/lib/money";
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

export interface LatestCycleCardTransaction {
  date: string;
  /** The resolved merchant display name when one's been tagged, else the statement's own raw description. */
  description: string;
  amount: Money;
  currency: string;
}

export interface LatestCycleCard {
  cardLabel: string;
  cycleMonth: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  transactions: LatestCycleCardTransaction[];
}

/**
 * The full statement-header column set both `getLatestCycleTransactionsPerCard`
 * and `getLatestCycleReportData` (v3.6.0) need — kept as one shared select
 * list/query so a card's "latest statement" is found identically by both,
 * even though each caller only reads a subset of the columns back out.
 */
const LATEST_STATEMENT_COLUMNS =
  "id, issuer, card_type, card_last4, primary_cardholder, statement_date, cycle_month, billing_period_start, billing_period_end, due_date, total_amount_due, minimum_due, previous_statement_due, payments_received, purchases_debit, finance_charges, available_credit_limit, total_credit_limit";

type LatestStatementRow = {
  id: string;
  issuer: string;
  card_type: string;
  card_last4: string;
  primary_cardholder: string;
  statement_date: string;
  cycle_month: string;
  billing_period_start: string;
  billing_period_end: string;
  due_date: string;
  total_amount_due: number;
  minimum_due: number;
  previous_statement_due: number;
  payments_received: number;
  purchases_debit: number;
  finance_charges: number;
  available_credit_limit: number;
  total_credit_limit: number;
};

/**
 * Every card's own MOST RECENT statement (by `statement_date`, not
 * `cycle_month` — a household could import an old backlog statement
 * after a newer one, and "most recent" should mean the latest real
 * cycle, not whichever row happened to import last), one entry per
 * distinct card (issuer/card_type/card_last4). Extracted from
 * `getLatestCycleTransactionsPerCard` in v3.6.0 so the combined
 * credit-card report's own richer query (`getLatestCycleReportData`)
 * shares this exact same "find latest per card" step rather than
 * re-implementing it.
 *
 * Groups in application code, not a SQL DISTINCT ON — same "no
 * aggregate RPC/view exists yet, this app's data volume doesn't need
 * one" reasoning every other query in this file already follows.
 * Statements fetched newest-first so the first one seen per card key
 * is already the latest — no separate max() pass needed.
 */
async function loadLatestStatementPerCard(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<LatestStatementRow[]> {
  const { data: statements, error } = await supabase
    .from("credit_card_statements")
    .select(LATEST_STATEMENT_COLUMNS)
    .eq("user_id", OWNER_USER_ID)
    .order("statement_date", { ascending: false });

  if (error) {
    throw new Error(`Failed to load credit card statements: ${error.message}`);
  }

  const latestByCard = new Map<string, LatestStatementRow>();
  for (const statement of statements) {
    const cardKey = `${statement.issuer}|${statement.card_type}|${statement.card_last4}`;
    if (!latestByCard.has(cardKey)) {
      latestByCard.set(cardKey, statement);
    }
  }
  return Array.from(latestByCard.values());
}

/**
 * v3.5.4 — every card's own latest statement (see
 * `loadLatestStatementPerCard`) and its debit transactions. Built for
 * IntelService's "Generate commentary" — feeding the model each card's
 * latest cycle so it can flag potentially-avoidable spending patterns
 * (repeated similar purchases, back-to-back dining, one outsized
 * one-off), the same way getCardCategoryBreakdown already feeds it one
 * month's aggregate total, just at transaction-line granularity
 * instead.
 */
export async function getLatestCycleTransactionsPerCard(): Promise<
  LatestCycleCard[]
> {
  const supabase = createServiceClient();

  const latestStatements = await loadLatestStatementPerCard(supabase);
  if (latestStatements.length === 0) return [];
  const statementIds = latestStatements.map((s) => s.id);

  const { data: transactions, error: transactionsError } = await supabase
    .from("credit_card_transactions")
    .select(
      "statement_id, transaction_date, description, amount, currency, merchants(display_name)",
    )
    .eq("user_id", OWNER_USER_ID)
    .eq("transaction_type", "debit")
    .in("statement_id", statementIds)
    .order("transaction_date", { ascending: true });

  if (transactionsError) {
    throw new Error(
      `Failed to load credit card transactions: ${transactionsError.message}`,
    );
  }

  const transactionsByStatement = new Map<string, typeof transactions>();
  for (const txn of transactions) {
    const list = transactionsByStatement.get(txn.statement_id) ?? [];
    list.push(txn);
    transactionsByStatement.set(txn.statement_id, list);
  }

  return latestStatements.map((statement) => ({
    cardLabel: `${statement.issuer} ${statement.card_type} •••• ${statement.card_last4}`,
    cycleMonth: statement.cycle_month,
    billingPeriodStart: statement.billing_period_start,
    billingPeriodEnd: statement.billing_period_end,
    transactions: (transactionsByStatement.get(statement.id) ?? []).map(
      (txn) => ({
        date: txn.transaction_date,
        description: txn.merchants?.display_name ?? txn.description,
        amount: dbNumberToMoney(txn.amount),
        currency: txn.currency,
      }),
    ),
  }));
}

export interface LatestCycleReportTransaction {
  id: string;
  date: string;
  /** The resolved merchant display name when one's been tagged, else the statement's own raw description — same fallback as LatestCycleCardTransaction. */
  description: string;
  amount: Money;
  currency: string;
  merchantId: string | null;
  merchantDisplayName: string | null;
  atlasCategoryId: string | null;
  atlasSubcategoryId: string | null;
}

export interface LatestCycleReportCard {
  cardKey: string;
  cardLabel: string;
  issuer: string;
  primaryCardholder: string;
  statementDate: string;
  cycleMonth: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  dueDate: string;
  totalAmountDue: Money;
  minimumDue: Money;
  availableCreditLimit: Money;
  totalCreditLimit: Money;
  transactions: LatestCycleReportTransaction[];
}

/**
 * v3.6.0 — the richer sibling of `getLatestCycleTransactionsPerCard`,
 * built for the combined credit-card PDF report: every card's own
 * latest statement (shared "find latest per card" step, see
 * `loadLatestStatementPerCard`), but carrying the statement's own
 * header facts (due date, total/minimum due, credit limits) and each
 * transaction's resolved merchant + atlas category/subcategory ids —
 * none of which `getLatestCycleTransactionsPerCard` needs for its own
 * caller (the AI insight prompt), so that function is left untouched
 * and this is additive, not a replacement.
 */
export async function getLatestCycleReportData(): Promise<
  LatestCycleReportCard[]
> {
  const supabase = createServiceClient();

  const latestStatements = await loadLatestStatementPerCard(supabase);
  if (latestStatements.length === 0) return [];
  const statementIds = latestStatements.map((s) => s.id);

  const { data: transactions, error: transactionsError } = await supabase
    .from("credit_card_transactions")
    .select(
      "id, statement_id, transaction_date, description, amount, currency, merchants(id, display_name, atlas_category_id, atlas_subcategory_id)",
    )
    .eq("user_id", OWNER_USER_ID)
    .eq("transaction_type", "debit")
    .in("statement_id", statementIds)
    .order("transaction_date", { ascending: true });

  if (transactionsError) {
    throw new Error(
      `Failed to load credit card transactions: ${transactionsError.message}`,
    );
  }

  const transactionsByStatement = new Map<string, typeof transactions>();
  for (const txn of transactions) {
    const list = transactionsByStatement.get(txn.statement_id) ?? [];
    list.push(txn);
    transactionsByStatement.set(txn.statement_id, list);
  }

  return latestStatements.map((statement) => ({
    cardKey: `${statement.issuer}|${statement.card_type}|${statement.card_last4}`,
    cardLabel: `${statement.issuer} ${statement.card_type} •••• ${statement.card_last4}`,
    issuer: statement.issuer,
    primaryCardholder: statement.primary_cardholder,
    statementDate: statement.statement_date,
    cycleMonth: statement.cycle_month,
    billingPeriodStart: statement.billing_period_start,
    billingPeriodEnd: statement.billing_period_end,
    dueDate: statement.due_date,
    totalAmountDue: dbNumberToMoney(statement.total_amount_due),
    minimumDue: dbNumberToMoney(statement.minimum_due),
    availableCreditLimit: dbNumberToMoney(statement.available_credit_limit),
    totalCreditLimit: dbNumberToMoney(statement.total_credit_limit),
    transactions: (transactionsByStatement.get(statement.id) ?? []).map(
      (txn) => ({
        id: txn.id,
        date: txn.transaction_date,
        description: txn.merchants?.display_name ?? txn.description,
        amount: dbNumberToMoney(txn.amount),
        currency: txn.currency,
        merchantId: txn.merchants?.id ?? null,
        merchantDisplayName: txn.merchants?.display_name ?? null,
        atlasCategoryId: txn.merchants?.atlas_category_id ?? null,
        atlasSubcategoryId: txn.merchants?.atlas_subcategory_id ?? null,
      }),
    ),
  }));
}

export interface CardCategoryDrilldownTransaction {
  id: string;
  transactionDate: string;
  description: string;
  amount: Money;
  currency: string;
  cardLabel: string;
  merchantId: string | null;
  merchantDisplayName: string | null;
}

export interface CardCategoryDrilldownMerchant {
  merchantId: string | null;
  displayName: string;
  total: Money;
  transactionCount: number;
}

export interface CardCategoryDrilldown {
  totalSpend: Money;
  transactions: CardCategoryDrilldownTransaction[];
  byMerchant: CardCategoryDrilldownMerchant[];
}

/**
 * The transactions (and, folded from those, the merchants) behind one
 * donut slice in the Card-level breakdown section -- v1.2, "when you
 * click on groceries on the donut chart...I would like to see the
 * transactions, along with merchants which have contributed to that
 * number." categoryIds is a whole array (not a single id) because a
 * clicked slice might be the "Other" bucket, which folds several
 * categories together (see DonutSlice.categoryIds in lib/intel/donut.ts)
 * -- "" inside that array means uncategorized, same convention as
 * cardDonut() in the Intel page. cardKey, if given, narrows to one
 * card's own donut instead of the "All cards" aggregate; undefined
 * matches every card, same rows getCardCategoryBreakdown would combine
 * into its aggregate for this same month.
 */
export async function getCardCategoryTransactions(params: {
  month: string;
  categoryIds: string[];
  cardKey?: string;
}): Promise<CardCategoryDrilldown> {
  const { month, categoryIds, cardKey } = params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("credit_card_transactions")
    .select(
      "id, transaction_date, description, amount, currency, credit_card_statements!inner(issuer, card_type, card_last4, cycle_month), merchants(id, display_name, atlas_category_id)",
    )
    .eq("user_id", OWNER_USER_ID)
    .eq("transaction_type", "debit")
    .eq("credit_card_statements.cycle_month", month)
    .order("transaction_date", { ascending: false });

  if (error) {
    throw new Error(
      `Failed to load card category transactions: ${error.message}`,
    );
  }

  const categoryIdSet = new Set(categoryIds);
  const cardLabelFor = (statement: {
    issuer: string;
    card_type: string;
    card_last4: string;
  }) =>
    `${statement.issuer} ${statement.card_type} •••• ${statement.card_last4}`;
  const cardKeyFor = (statement: {
    issuer: string;
    card_type: string;
    card_last4: string;
  }) => `${statement.issuer}|${statement.card_type}|${statement.card_last4}`;

  const transactions: CardCategoryDrilldownTransaction[] = data
    .filter((row) => row.credit_card_statements !== null)
    .filter((row) => categoryIdSet.has(row.merchants?.atlas_category_id ?? ""))
    .filter(
      (row) => !cardKey || cardKeyFor(row.credit_card_statements!) === cardKey,
    )
    .map((row) => ({
      id: row.id,
      transactionDate: row.transaction_date,
      description: row.description,
      amount: dbNumberToMoney(row.amount),
      currency: row.currency,
      cardLabel: cardLabelFor(row.credit_card_statements!),
      merchantId: row.merchants?.id ?? null,
      merchantDisplayName: row.merchants?.display_name ?? null,
    }));

  const byMerchantMap = new Map<
    string,
    {
      merchantId: string | null;
      displayName: string;
      total: Money;
      count: number;
    }
  >();
  for (const txn of transactions) {
    const key = txn.merchantId ?? "__no_merchant__";
    const existing = byMerchantMap.get(key);
    if (existing) {
      existing.total = sumMoney([existing.total, txn.amount]);
      existing.count += 1;
    } else {
      byMerchantMap.set(key, {
        merchantId: txn.merchantId,
        displayName: txn.merchantDisplayName ?? "No merchant tagged",
        total: txn.amount,
        count: 1,
      });
    }
  }

  const byMerchant = Array.from(byMerchantMap.values())
    .map((m) => ({
      merchantId: m.merchantId,
      displayName: m.displayName,
      total: m.total,
      transactionCount: m.count,
    }))
    .sort((a, b) => moneyToDbNumber(b.total) - moneyToDbNumber(a.total));

  return {
    totalSpend: sumMoney(transactions.map((t) => t.amount)),
    transactions,
    byMerchant,
  };
}
