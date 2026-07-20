/**
 * Pure helpers for building the Intel page's card-level category
 * breakdown: for a given month, how much was spent on each card, split
 * by Merchant Dictionary category (see MerchantDictionaryService) --
 * both aggregated across every card and sliced per individual card.
 * Split out from CreditCardIntelService.ts the same way donut.ts is
 * split from the page itself: so the grouping/summing logic can be unit
 * tested without a database, and so "group by card" and "group by
 * category within a card" are each done in exactly one place.
 *
 * Deliberately independent of the ledger's own category system
 * (finance.categories, via ReportingService/CategoryService) -- credit
 * card spend is categorized through the Merchant Dictionary
 * (atlas_categories), a separate system by design (see the v1.5.0
 * migration's own comment on why). categoryId here is always an
 * atlas_categories id, or null for a transaction whose merchant has no
 * category yet (or has no merchant_id at all).
 */

import {
  addMoney,
  dbNumberToMoney,
  moneyToDbNumber,
  sumMoney,
  ZERO,
  type Money,
} from "@/lib/money";

/** One transaction, already flattened out of the join CreditCardIntelService runs -- just the fields this module actually needs. */
export interface CardTransactionRow {
  amount: number;
  issuer: string;
  cardType: string;
  cardLast4: string;
  /** null if the transaction has no merchant, or its merchant has no category yet. */
  atlasCategoryId: string | null;
}

export interface CardCategoryAmount {
  /** null = uncategorized (see CardTransactionRow.atlasCategoryId). */
  categoryId: string | null;
  total: Money;
}

export interface CardBreakdown {
  /** Stable grouping key (issuer|cardType|cardLast4) -- not meant for display, see cardLabel. */
  cardKey: string;
  /** e.g. "HDFC Infinia •••• 5252" -- same shape as MerchantService's cardLabelFor. */
  cardLabel: string;
  totalSpend: Money;
  byCategory: CardCategoryAmount[];
}

export interface CardCategoryBreakdownResult {
  /** Every card with at least one debit transaction this month, highest spend first. */
  cards: CardBreakdown[];
  /** The same breakdown, summed across every card. */
  aggregate: {
    totalSpend: Money;
    byCategory: CardCategoryAmount[];
  };
}

function cardKeyFor(
  issuer: string,
  cardType: string,
  cardLast4: string,
): string {
  return `${issuer}|${cardType}|${cardLast4}`;
}

function cardLabelFor(
  issuer: string,
  cardType: string,
  cardLast4: string,
): string {
  return `${issuer} ${cardType} •••• ${cardLast4}`;
}

function summarize(rows: CardTransactionRow[]): {
  totalSpend: Money;
  byCategory: CardCategoryAmount[];
} {
  const byCategoryMap = new Map<string | null, Money>();
  for (const row of rows) {
    const amount = dbNumberToMoney(row.amount);
    byCategoryMap.set(
      row.atlasCategoryId,
      addMoney(byCategoryMap.get(row.atlasCategoryId) ?? ZERO, amount),
    );
  }

  const byCategory: CardCategoryAmount[] = Array.from(
    byCategoryMap.entries(),
  ).map(([categoryId, total]) => ({ categoryId, total }));

  return {
    totalSpend: sumMoney(rows.map((r) => dbNumberToMoney(r.amount))),
    byCategory,
  };
}

/**
 * Groups a month's debit transactions by card, and within each card by
 * category -- plus one more summary across every card combined. Rows
 * are expected already filtered to one calendar month and
 * transaction_type = "debit" by the caller (CreditCardIntelService);
 * this function doesn't know or care about dates.
 */
export function buildCardCategoryBreakdown(
  rows: CardTransactionRow[],
): CardCategoryBreakdownResult {
  const byCard = new Map<
    string,
    { label: string; rows: CardTransactionRow[] }
  >();
  for (const row of rows) {
    const key = cardKeyFor(row.issuer, row.cardType, row.cardLast4);
    const existing = byCard.get(key);
    if (existing) {
      existing.rows.push(row);
    } else {
      byCard.set(key, {
        label: cardLabelFor(row.issuer, row.cardType, row.cardLast4),
        rows: [row],
      });
    }
  }

  const cards: CardBreakdown[] = Array.from(byCard.entries())
    .map(([cardKey, group]) => ({
      cardKey,
      cardLabel: group.label,
      ...summarize(group.rows),
    }))
    // Biggest spender first -- the card that mattered most this month leads.
    .sort(
      (a, b) => moneyToDbNumber(b.totalSpend) - moneyToDbNumber(a.totalSpend),
    );

  return { cards, aggregate: summarize(rows) };
}

/** One row for buildMonthlyCardTotals -- same idea as CardTransactionRow, but keyed by cycle month instead of by card, since Intel's existing month-over-month charts fold every card together and only ever care about the month. */
export interface MonthlyCardTransactionRow {
  amount: number;
  /**
   * "YYYY-MM" -- the owning statement's cycle_month (see
   * credit_card_statements.cycle_month / src/lib/statement-cycle.ts),
   * NOT the transaction's own transaction_date. v1.6.1: every
   * transaction on one statement shares that statement's cycle
   * regardless of its individual date, since a billing period can span
   * a calendar-month boundary -- the whole point of cycle tagging is
   * that the statement (not the purchase date) decides which month's
   * plan it counts toward.
   */
  cycleMonth: string;
  atlasCategoryId: string | null;
}

export interface MonthlyCardTotal {
  /** "YYYY-MM" */
  month: string;
  totalSpend: Money;
  byCategory: CardCategoryAmount[];
}

/**
 * Groups debit transactions (across every card combined -- no per-card
 * split here, see buildCardCategoryBreakdown above for that) by cycle
 * month, and within each month by category. Built for folding credit
 * card spend into Intel's existing ledger-only cash-flow charts
 * (month-on-month expenditure, income vs. expenses, and the
 * by-category donuts) alongside finance.transactions activity -- see
 * CreditCardIntelService.getCardExpenseForMonths for the query this
 * feeds. v1.6.1: the Intel page now shows card spend as a single
 * lumped "Credit Card Dues" line in those charts rather than merging
 * in each individual category, so byCategory here mainly backs the
 * dedicated Card-level breakdown section, not the merge itself.
 */
export function buildMonthlyCardTotals(
  rows: MonthlyCardTransactionRow[],
): MonthlyCardTotal[] {
  const byMonth = new Map<string, MonthlyCardTransactionRow[]>();
  for (const row of rows) {
    const list = byMonth.get(row.cycleMonth);
    if (list) {
      list.push(row);
    } else {
      byMonth.set(row.cycleMonth, [row]);
    }
  }

  return Array.from(byMonth.entries()).map(([month, monthRows]) => {
    const byCategoryMap = new Map<string | null, Money>();
    for (const row of monthRows) {
      const amount = dbNumberToMoney(row.amount);
      byCategoryMap.set(
        row.atlasCategoryId,
        addMoney(byCategoryMap.get(row.atlasCategoryId) ?? ZERO, amount),
      );
    }
    return {
      month,
      totalSpend: sumMoney(monthRows.map((r) => dbNumberToMoney(r.amount))),
      byCategory: Array.from(byCategoryMap.entries()).map(
        ([categoryId, total]) => ({ categoryId, total }),
      ),
    };
  });
}
