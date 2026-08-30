/**
 * Pure aggregation + SVG geometry helpers for the combined credit card
 * PDF report (v3.6.0) — every card's own latest billing cycle
 * (`CreditCardIntelService.getLatestCycleReportData`), rolled up into
 * the several summary/detail views the report needs: an overall
 * category breakdown (feeding the same top-5-plus-Other bucketing
 * `buildDonutSlices` already uses for Intel's own donut), a
 * category-to-merchant drill-down (each merchant tagged with its own
 * subcategory), a per-card summary, top merchants overall, largest
 * individual transactions, and the flat combined transaction table for
 * the report's data-oriented appendix.
 *
 * Split out from the PDF-rendering layer (src/features/intel/pdf/) the
 * same way donut.ts/card-category-breakdown.ts are split from the
 * Intel page and CreditCardIntelService — so every number in the report
 * can be unit tested without rendering a PDF.
 */

import { moneyToDbNumber, sumMoney, ZERO, type Money } from "@/lib/money";
import type { CategoryBreakdown } from "@/services/ReportingService";
import type {
  LatestCycleReportCard,
  LatestCycleReportTransaction,
} from "@/services/CreditCardIntelService";

/** Every transaction across every card, flattened with its own card's label attached — the shape most of this module's aggregations fold over. */
interface FlatReportTransaction extends LatestCycleReportTransaction {
  cardKey: string;
  cardLabel: string;
}

function flattenTransactions(
  cards: LatestCycleReportCard[],
): FlatReportTransaction[] {
  return cards.flatMap((card) =>
    card.transactions.map((txn) => ({
      ...txn,
      cardKey: card.cardKey,
      cardLabel: card.cardLabel,
    })),
  );
}

/** Total spend across every card's latest cycle combined — the denominator every "% of grand total" figure in this report divides into. */
export function computeGrandTotal(cards: LatestCycleReportCard[]): Money {
  return sumMoney(flattenTransactions(cards).map((t) => t.amount));
}

function percentOf(part: Money, total: Money): number {
  const totalNum = moneyToDbNumber(total);
  if (totalNum <= 0) return 0;
  return (moneyToDbNumber(part) / totalNum) * 100;
}

/**
 * Top-level category totals across every card combined, in the exact
 * `{categoryId, total}` shape `buildDonutSlices` (lib/intel/donut.ts)
 * already expects — so the report's own donut reuses Intel's real
 * top-5-plus-Other bucketing unmodified. "" stands for uncategorized,
 * same convention as the rest of lib/intel (see donut.ts's own note).
 */
export function buildReportCategoryTotals(
  cards: LatestCycleReportCard[],
): CategoryBreakdown[] {
  const totals = new Map<string, Money>();
  for (const txn of flattenTransactions(cards)) {
    const categoryId = txn.atlasCategoryId ?? "";
    totals.set(
      categoryId,
      sumMoney([totals.get(categoryId) ?? ZERO, txn.amount]),
    );
  }
  return Array.from(totals.entries()).map(([categoryId, total]) => ({
    categoryId,
    total,
  }));
}

export interface CategoryMerchantRow {
  merchantId: string | null;
  displayName: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
  total: Money;
  transactionCount: number;
  percentOfCategory: number;
}

export interface CategoryMerchantBreakdown {
  categoryId: string;
  categoryName: string;
  total: Money;
  transactionCount: number;
  percentOfGrandTotal: number;
  merchants: CategoryMerchantRow[];
}

/**
 * The category → merchant drill-down section — for each top-level
 * category (sorted by spend desc), every merchant that contributed to
 * it, each carrying its own tagged subcategory. Mirrors
 * CreditCardIntelService.getCardCategoryTransactions's existing
 * byMerchantMap grouping, generalized across every category at once
 * instead of one clicked donut slice. "No merchant tagged" fallback
 * matches that same existing convention.
 */
export function buildReportCategoryMerchantBreakdown(
  cards: LatestCycleReportCard[],
  categoryName: Map<string, string>,
): CategoryMerchantBreakdown[] {
  const grandTotal = computeGrandTotal(cards);
  const byCategory = new Map<string, FlatReportTransaction[]>();
  for (const txn of flattenTransactions(cards)) {
    const categoryId = txn.atlasCategoryId ?? "";
    const list = byCategory.get(categoryId) ?? [];
    list.push(txn);
    byCategory.set(categoryId, list);
  }

  const breakdowns: CategoryMerchantBreakdown[] = Array.from(
    byCategory.entries(),
  ).map(([categoryId, txns]) => {
    const categoryTotal = sumMoney(txns.map((t) => t.amount));

    const byMerchant = new Map<
      string,
      {
        merchantId: string | null;
        displayName: string;
        subcategoryId: string | null;
        total: Money;
        count: number;
      }
    >();
    for (const txn of txns) {
      const key = txn.merchantId ?? "__no_merchant__";
      const existing = byMerchant.get(key);
      if (existing) {
        existing.total = sumMoney([existing.total, txn.amount]);
        existing.count += 1;
      } else {
        byMerchant.set(key, {
          merchantId: txn.merchantId,
          displayName: txn.merchantDisplayName ?? "No merchant tagged",
          subcategoryId: txn.atlasSubcategoryId,
          total: txn.amount,
          count: 1,
        });
      }
    }

    const merchants: CategoryMerchantRow[] = Array.from(byMerchant.values())
      .map((m) => ({
        merchantId: m.merchantId,
        displayName: m.displayName,
        subcategoryId: m.subcategoryId,
        subcategoryName: m.subcategoryId
          ? (categoryName.get(m.subcategoryId) ?? null)
          : null,
        total: m.total,
        transactionCount: m.count,
        percentOfCategory: percentOf(m.total, categoryTotal),
      }))
      .sort((a, b) => moneyToDbNumber(b.total) - moneyToDbNumber(a.total));

    return {
      categoryId,
      categoryName: categoryId
        ? (categoryName.get(categoryId) ?? "Uncategorized")
        : "Uncategorized",
      total: categoryTotal,
      transactionCount: txns.length,
      percentOfGrandTotal: percentOf(categoryTotal, grandTotal),
      merchants,
    };
  });

  return breakdowns.sort(
    (a, b) => moneyToDbNumber(b.total) - moneyToDbNumber(a.total),
  );
}

export interface PerCardSummaryRow {
  cardKey: string;
  cardLabel: string;
  dueDate: string;
  totalAmountDue: Money;
  minimumDue: Money;
  availableCreditLimit: Money;
  totalCreditLimit: Money;
  /** (totalCreditLimit - availableCreditLimit) / totalCreditLimit — null when the card carries no credit limit to divide by. */
  utilizationPercent: number | null;
  cycleSpend: Money;
  transactionCount: number;
  percentOfGrandTotal: number;
}

/** One row per card: the real statement header facts plus that card's own share of this cycle's combined spend. */
export function buildPerCardSummary(
  cards: LatestCycleReportCard[],
): PerCardSummaryRow[] {
  const grandTotal = computeGrandTotal(cards);
  return cards
    .map((card) => {
      const cycleSpend = sumMoney(card.transactions.map((t) => t.amount));
      const totalLimit = moneyToDbNumber(card.totalCreditLimit);
      const availableLimit = moneyToDbNumber(card.availableCreditLimit);
      return {
        cardKey: card.cardKey,
        cardLabel: card.cardLabel,
        dueDate: card.dueDate,
        totalAmountDue: card.totalAmountDue,
        minimumDue: card.minimumDue,
        availableCreditLimit: card.availableCreditLimit,
        totalCreditLimit: card.totalCreditLimit,
        utilizationPercent:
          totalLimit > 0
            ? ((totalLimit - availableLimit) / totalLimit) * 100
            : null,
        cycleSpend,
        transactionCount: card.transactions.length,
        percentOfGrandTotal: percentOf(cycleSpend, grandTotal),
      };
    })
    .sort(
      (a, b) => moneyToDbNumber(b.cycleSpend) - moneyToDbNumber(a.cycleSpend),
    );
}

export interface TopMerchant {
  merchantId: string | null;
  displayName: string;
  total: Money;
  transactionCount: number;
  percentOfGrandTotal: number;
}

/** Merchants ranked by spend across every card and category combined — "who did we actually pay the most," independent of category. */
export function buildTopMerchantsOverall(
  cards: LatestCycleReportCard[],
  limit = 15,
): TopMerchant[] {
  const grandTotal = computeGrandTotal(cards);
  const byMerchant = new Map<
    string,
    {
      merchantId: string | null;
      displayName: string;
      total: Money;
      count: number;
    }
  >();
  for (const txn of flattenTransactions(cards)) {
    const key = txn.merchantId ?? "__no_merchant__";
    const existing = byMerchant.get(key);
    if (existing) {
      existing.total = sumMoney([existing.total, txn.amount]);
      existing.count += 1;
    } else {
      byMerchant.set(key, {
        merchantId: txn.merchantId,
        displayName: txn.merchantDisplayName ?? "No merchant tagged",
        total: txn.amount,
        count: 1,
      });
    }
  }

  return Array.from(byMerchant.values())
    .map((m) => ({
      merchantId: m.merchantId,
      displayName: m.displayName,
      total: m.total,
      transactionCount: m.count,
      percentOfGrandTotal: percentOf(m.total, grandTotal),
    }))
    .sort((a, b) => moneyToDbNumber(b.total) - moneyToDbNumber(a.total))
    .slice(0, limit);
}

export interface LargestTransaction {
  id: string;
  date: string;
  description: string;
  amount: Money;
  cardLabel: string;
  categoryName: string;
  subcategoryName: string | null;
}

/** Individual transactions sorted by amount desc — surfaces one-off spikes that category/merchant rollups smooth over. */
export function buildLargestTransactions(
  cards: LatestCycleReportCard[],
  categoryName: Map<string, string>,
  limit = 20,
): LargestTransaction[] {
  return flattenTransactions(cards)
    .sort((a, b) => moneyToDbNumber(b.amount) - moneyToDbNumber(a.amount))
    .slice(0, limit)
    .map((txn) => ({
      id: txn.id,
      date: txn.date,
      description: txn.description,
      amount: txn.amount,
      cardLabel: txn.cardLabel,
      categoryName: txn.atlasCategoryId
        ? (categoryName.get(txn.atlasCategoryId) ?? "Uncategorized")
        : "Uncategorized",
      subcategoryName: txn.atlasSubcategoryId
        ? (categoryName.get(txn.atlasSubcategoryId) ?? null)
        : null,
    }));
}

export interface AppendixTransactionRow {
  date: string;
  cardLabel: string;
  description: string;
  categoryName: string;
  subcategoryName: string | null;
  amount: Money;
}

/** The full combined transaction list, sorted by date — the appendix's data-oriented table, meant for an external LLM to ingest, not for human skimming. */
export function buildCombinedTransactionTable(
  cards: LatestCycleReportCard[],
  categoryName: Map<string, string>,
): AppendixTransactionRow[] {
  return flattenTransactions(cards)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((txn) => ({
      date: txn.date,
      cardLabel: txn.cardLabel,
      description: txn.description,
      categoryName: txn.atlasCategoryId
        ? (categoryName.get(txn.atlasCategoryId) ?? "Uncategorized")
        : "Uncategorized",
      subcategoryName: txn.atlasSubcategoryId
        ? (categoryName.get(txn.atlasSubcategoryId) ?? null)
        : null,
      amount: txn.amount,
    }));
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180; // 0° = 12 o'clock, clockwise
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * SVG path `d` for one donut slice — react-pdf has no CSS
 * conic-gradient support (unlike Intel's real donut, see
 * buildDonutGradientStops in donut.ts), so the PDF's donut needs actual
 * arc geometry. Caps the end angle short of a full 360° sweep for the
 * single-slice-at-100% case: an SVG elliptical arc command can't
 * describe a full circle (start and end points coincide), which would
 * otherwise collapse the path to nothing.
 */
export function donutArcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngleDeg: number,
  endAngleDeg: number,
): string {
  const end =
    endAngleDeg - startAngleDeg >= 360 ? startAngleDeg + 359.999 : endAngleDeg;
  const largeArc = end - startAngleDeg > 180 ? 1 : 0;

  const outerStart = polarToCartesian(cx, cy, rOuter, end);
  const outerEnd = polarToCartesian(cx, cy, rOuter, startAngleDeg);
  const innerStart = polarToCartesian(cx, cy, rInner, startAngleDeg);
  const innerEnd = polarToCartesian(cx, cy, rInner, end);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 1 ${innerEnd.x} ${innerEnd.y}`,
    "Z",
  ].join(" ");
}

/**
 * The appendix's ready-to-paste LLM analysis prompt — static,
 * template-generated text only, grounded with this cycle's real
 * computed totals. No LLM call happens anywhere in this feature; the
 * household pastes this alongside the PDF into whatever LLM they use,
 * per their own explicit "you don't need to produce that, just the
 * prompt" request.
 */
export function buildLlmAnalysisPrompt(params: {
  cardCount: number;
  cycleLabel: string;
  grandTotal: Money;
  transactionCount: number;
  currency: string;
}): string {
  const { cardCount, cycleLabel, grandTotal, transactionCount, currency } =
    params;
  // Currency CODE, not symbol -- this text is embedded as plain ASCII
  // in the PDF's monospace appendix block, and react-pdf's standard
  // Courier font (like Helvetica, see pdf/theme.ts) has no glyph for
  // "₹" or several other currency symbols.
  const grandTotalDisplay = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "code",
  }).format(moneyToDbNumber(grandTotal));
  return `Attached is my combined credit-card expense report covering ${cardCount} card${cardCount === 1 ? "" : "s"}' most recent billing cycles (statements due in ${cycleLabel}), totaling ${grandTotalDisplay} across ${transactionCount} transactions. The report includes an overall category breakdown, a category-to-merchant drill-down with each merchant's tagged subcategory, a per-card summary, top merchants overall, largest individual transactions, and a complete transaction-level table in this appendix.

Please analyze this data and tell me:
1. Main spending areas — which categories and merchants dominate this cycle's spend, and how concentrated vs. spread out is it (e.g. is a small number of merchants driving most of the total)?
2. Unusually large items — any individual transactions or merchant totals that look substantially larger than similar purchases, or than what you'd expect for that category, and worth a second look?
3. Reducible or discretionary spend — which categories or merchants look like the most flexible or avoidable, as opposed to fixed/necessary costs, and roughly how much could realistically be trimmed?
4. Duplicative or near-duplicate purchases — any transactions that look like the same or a very similar purchase repeated close together (same merchant, similar amount, short time apart), or multiple merchants serving the same purpose that could be consolidated?
5. Anything else notable — patterns across cards (e.g. one card carrying disproportionate spend), a category that grew unexpectedly, or subscriptions/recurring charges worth reviewing.

Use the summary tables for the big picture and the full transaction table in the appendix for line-level detail. Keep the analysis concrete and reference actual merchant/category names and amounts from the data rather than generic advice.`;
}
