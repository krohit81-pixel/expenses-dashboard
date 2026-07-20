import type { Metadata } from "next";

import Link from "next/link";

import { requireUser } from "@/lib/auth/require-user";
import {
  getCashFlowSummary,
  getMonthlyCashFlowTrend,
  type CashFlowSummary,
} from "@/services/ReportingService";
import { listCategories } from "@/services/CategoryService";
import { getUserSettings } from "@/services/UserSettingsService";
import { generateInsight } from "@/services/IntelService";
import {
  getCardCategoryBreakdown,
  getCardExpenseForMonths,
  hasAnyCreditCardStatement,
  type CardCategoryAmount,
} from "@/services/CreditCardIntelService";
import { listAtlasCategories } from "@/services/MerchantService";
import {
  buildDonutGradientStops,
  buildDonutSlices,
  mergeCategoryTotalsByName,
} from "@/lib/intel/donut";
import {
  addMoney,
  formatMoneyDisplay,
  moneyToDbNumber,
  subtractMoney,
  type Money,
} from "@/lib/money";
import {
  currentMonth,
  isValidMonth,
  shiftMonth,
  shortMonthLabel,
} from "@/lib/dates/month";
import { Hero } from "@/components/ui/hero";

export const metadata: Metadata = {
  title: "Intel",
};

const CATEGORY_COLORS = [
  "#5b21b6",
  "#9061e0",
  "#17a054",
  "#e0355b",
  "#f0a63a",
  "#cabfd6",
];

function monthShortLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
}

function monthStartEnd(month: string): { from: string; to: string } {
  const [year, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, m - 1, 1));
  const end = new Date(Date.UTC(year, m, 0));
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

/**
 * Savings rate as a percentage of income, rounded to the nearest whole
 * number. null when there was no income at all that month — a % of
 * zero income isn't a meaningful number (not the same thing as 0% or
 * -100%), so callers should show a dash instead of a rate in that case.
 */
function savingsRatePct(income: Money, expense: Money): number | null {
  const incomeNum = moneyToDbNumber(income);
  if (incomeNum <= 0) return null;
  const net = moneyToDbNumber(subtractMoney(income, expense));
  return Math.round((net / incomeNum) * 100);
}

export default async function IntelPage({
  searchParams,
}: {
  searchParams: Promise<{ cardMonth?: string }>;
}) {
  const { cardMonth: cardMonthParam } = await searchParams;
  const cardMonth = isValidMonth(cardMonthParam)
    ? cardMonthParam
    : currentMonth();
  const isCurrentCardMonth = cardMonth === currentMonth();

  const user = await requireUser();
  const now = new Date();
  const thisMonth = currentMonth();
  const prevMonth = shiftMonth(thisMonth, -1);
  const nextMonth = shiftMonth(thisMonth, 1);

  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  )
    .toISOString()
    .slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const prevRange = monthStartEnd(prevMonth);
  const nextRange = monthStartEnd(nextMonth);

  const [
    trend,
    categories,
    settings,
    insight,
    currentSummary,
    prevSummary,
    nextSummary,
  ] = await Promise.all([
    getMonthlyCashFlowTrend(6),
    listCategories(true),
    getUserSettings(user.id),
    generateInsight(),
    getCashFlowSummary({ from: monthStart, to: today }),
    getCashFlowSummary(prevRange),
    // includePending: true — the whole point of an "upcoming month"
    // donut is to preview what's already been tagged to next month's
    // cycle (recurring items, or a one-off added ahead of time), and
    // that's virtually always sitting as status: "pending" until it
    // actually happens. Empty/zero here just means nothing's been
    // tagged to next month yet, not that anything is broken.
    getCashFlowSummary(nextRange, true),
  ]);

  // Card-level breakdown: a separate Merchant Dictionary category system
  // (atlas_categories) from the ledger's own finance.categories above,
  // by design (see the v1.5.0 migration's comment on why) -- hence its
  // own categories lookup and its own month, independently navigable
  // from the cash-flow charts above.
  const [cardBreakdown, atlasCategories, anyCardStatements] = await Promise.all(
    [
      getCardCategoryBreakdown(cardMonth),
      listAtlasCategories(),
      hasAnyCreditCardStatement(),
    ],
  );
  const atlasCategoryName = new Map(
    atlasCategories.map((c) => [c.id, c.categoryName]),
  );

  // Fold credit card spend into the ledger-only cash-flow charts below
  // (by-category donuts, month-on-month, income vs. expenses, savings
  // rate) -- every month those charts touch, in one query rather than
  // one per month. Safe to add directly (not double-counted against
  // the ledger): paying off a card is logged in the ledger as a
  // transfer into a credit_card-type account (see
  // lib/accounts/spendable.ts's own comment on why "Log a card
  // payment" exists separately from the general transfer form), which
  // getCashFlowSummary already excludes (income/expense kinds only) --
  // the ledger never itemizes individual card purchases, that's what
  // credit_card_transactions is for. So ledger expense and card debit
  // spend are two complementary, non-overlapping slices of the same
  // month, not two views of the same money.
  const cardMonths = [...trend.map((t) => t.month), nextMonth];
  const cardMonthlyTotals = await getCardExpenseForMonths(cardMonths);

  function combinedExpense(month: string, ledgerExpense: Money): Money {
    const cardTotal = cardMonthlyTotals.get(month);
    return cardTotal
      ? addMoney(ledgerExpense, cardTotal.totalSpend)
      : ledgerExpense;
  }

  // Same six-plus-one months as expenditureBars below, with card spend
  // already folded into .expense -- .income is untouched (credit cards
  // have no income concept here, only debit spend).
  const combinedTrend = trend.map((t) => ({
    ...t,
    expense: combinedExpense(t.month, t.expense),
  }));

  function cardDonut(breakdown: {
    totalSpend: Money;
    byCategory: CardCategoryAmount[];
  }) {
    // buildDonutSlices expects a non-nullable categoryId; "" is never a
    // real atlas_categories id, so mapping null -> "" here reuses its
    // existing "no name found -> Uncategorized" fallback as-is, instead
    // of duplicating the top-5-plus-Other bucketing logic for a
    // nullable-id variant.
    const slices = buildDonutSlices(
      breakdown.byCategory.map((c) => ({
        categoryId: c.categoryId ?? "",
        total: c.total,
      })),
      atlasCategoryName,
    );
    const gradientStops = buildDonutGradientStops(
      slices,
      breakdown.totalSpend,
      CATEGORY_COLORS,
    );
    return { slices, gradientStops };
  }

  function renderCardDonut(
    key: string,
    label: string,
    breakdown: { totalSpend: Money; byCategory: CardCategoryAmount[] },
  ) {
    const { slices, gradientStops } = cardDonut(breakdown);
    return (
      <div
        key={key}
        className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]"
      >
        <div className="px-4 py-3.5">
          <h3 className="truncate font-display text-[12.5px] font-bold text-ink">
            {label}
          </h3>
        </div>
        {slices.length === 0 ? (
          <p className="px-4 pb-5 text-[12px] leading-relaxed text-ink-faint">
            No spend recorded.
          </p>
        ) : (
          <div className="flex flex-col items-center gap-3 px-4 pb-5">
            <div
              className="relative size-[104px] shrink-0 rounded-full"
              style={{
                background: `conic-gradient(${gradientStops.join(", ")})`,
              }}
            >
              <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-surface">
                <span className="font-display text-[12.5px] font-extrabold text-ink">
                  {formatMoneyDisplay(breakdown.totalSpend, currency).replace(
                    /\.\d+$/,
                    "",
                  )}
                </span>
              </div>
            </div>
            <ul className="w-full">
              {slices.map((slice, i) => {
                const totalNum = moneyToDbNumber(breakdown.totalSpend);
                const pct =
                  totalNum > 0
                    ? Math.round(
                        (moneyToDbNumber(slice.total) / totalNum) * 100,
                      )
                    : 0;
                return (
                  <li
                    key={slice.name}
                    className="flex items-center gap-1.5 py-0.5 text-[11px]"
                  >
                    <span
                      className="size-2 shrink-0 rounded-[2px]"
                      style={{
                        background: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">
                      {slice.name}
                    </span>
                    <span className="shrink-0 font-display text-[10px] font-bold text-ink-faint">
                      {pct}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const currency = settings?.baseCurrency ?? "USD";
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  // month is optional only for callers with no natural card month at all
  // (none currently -- every one of prev/current/next has one) --
  // required in spirit, just written this way so the signature doesn't
  // have to change if a future caller genuinely has no card data to fold in.
  function donut(summary: CashFlowSummary, month: string) {
    const cardTotal = cardMonthlyTotals.get(month);
    const totalExpense = combinedExpense(month, summary.totalExpense);
    const merged = mergeCategoryTotalsByName([
      { breakdown: summary.expenseByCategory, categoryName },
      {
        breakdown: cardTotal?.byCategory ?? [],
        categoryName: atlasCategoryName,
      },
    ]);
    // Reuse buildDonutSlices' existing top-5-plus-Other bucketing by
    // treating each merged name as its own "id", via an identity map --
    // see mergeCategoryTotalsByName's own comment for why this is safer
    // than duplicating that bucketing logic for a name-keyed variant.
    const slices = buildDonutSlices(
      merged.map((m) => ({ categoryId: m.name, total: m.total })),
      new Map(merged.map((m) => [m.name, m.name])),
    );
    const gradientStops = buildDonutGradientStops(
      slices,
      totalExpense,
      CATEGORY_COLORS,
    );
    return { slices, gradientStops, totalExpense };
  }

  const donuts = [
    {
      key: "prev",
      label: monthShortLabel(prevMonth),
      summary: prevSummary,
      month: prevMonth,
    },
    {
      key: "current",
      label: "This month",
      summary: currentSummary,
      month: thisMonth,
    },
    {
      key: "next",
      label: monthShortLabel(nextMonth),
      summary: nextSummary,
      month: nextMonth,
      isProjected: true,
    },
  ].map((d) => ({ ...d, ...donut(d.summary, d.month) }));

  // Month-on-month expenditure: the 6 actual months from the trend,
  // plus one projected bar for next month — v1.2, per the request to
  // "expand [the chart] to one month ahead." next month has no real
  // transactions yet in the common case, so its bar comes from the
  // same includePending cash-flow query as the "upcoming" donut above,
  // not from getMonthlyCashFlowTrend (which only ever counts posted
  // activity, and would just be zero for a future month). Card spend
  // folded in throughout, same as the donuts above.
  const expenditureBars = [
    ...combinedTrend.map((t) => ({
      month: t.month,
      total: t.expense,
      isProjected: false,
    })),
    {
      month: nextMonth,
      total: combinedExpense(nextMonth, nextSummary.totalExpense),
      isProjected: true,
    },
  ];
  const trendMax = Math.max(
    1,
    ...expenditureBars.map((t) => moneyToDbNumber(t.total)),
  );

  const cashFlowMax = Math.max(
    1,
    ...combinedTrend.flatMap((t) => [
      moneyToDbNumber(t.income),
      moneyToDbNumber(t.expense),
    ]),
  );

  return (
    <div>
      <Hero title="Intel" />

      <div className="space-y-5 p-5 sm:p-8">
        <div className="rounded-[20px] border-[1.5px] border-accent-soft bg-gradient-to-br from-accent-soft to-surface p-5">
          <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 font-display text-[11px] font-bold text-accent">
            &#10024; Auto-generated
          </span>
          {insight ? (
            <p className="text-sm leading-relaxed text-ink">{insight}</p>
          ) : (
            <p className="text-sm leading-relaxed text-ink-faint">
              Insight isn&apos;t available right now — either no AI provider is
              configured (ANTHROPIC_API_KEY or GEMINI_API_KEY), or something
              went wrong generating it. Charts below still reflect real data.
            </p>
          )}
        </div>

        {/* v1.2: three smaller donuts side by side (previous/current/
            upcoming month) instead of one big one for "this month" —
            makes it possible to see at a glance whether a category is
            trending up or down, and to preview what next month already
            looks like from tagged recurring items, without extra taps. */}
        <div>
          <h2 className="mb-3 font-display text-sm font-bold text-ink">
            By category
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {donuts.map((d) => (
              <div
                key={d.key}
                className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]"
              >
                <div className="flex items-center justify-between px-4 py-3.5">
                  <h3 className="font-display text-[12.5px] font-bold text-ink">
                    {d.label}
                  </h3>
                  {d.isProjected && (
                    <span className="rounded-full bg-accent-soft px-1.5 py-0.5 font-display text-[9px] font-extrabold uppercase tracking-wide text-accent">
                      Projected
                    </span>
                  )}
                </div>
                {d.slices.length === 0 ? (
                  <p className="px-4 pb-5 text-[12px] leading-relaxed text-ink-faint">
                    {d.isProjected
                      ? "Nothing tagged to next month's cycle yet."
                      : "No expenses recorded."}
                  </p>
                ) : (
                  <div className="flex flex-col items-center gap-3 px-4 pb-5">
                    <div
                      className="relative size-[104px] shrink-0 rounded-full"
                      style={{
                        background: `conic-gradient(${d.gradientStops.join(", ")})`,
                      }}
                    >
                      <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-surface">
                        <span className="font-display text-[12.5px] font-extrabold text-ink">
                          {formatMoneyDisplay(d.totalExpense, currency).replace(
                            /\.\d+$/,
                            "",
                          )}
                        </span>
                      </div>
                    </div>
                    <ul className="w-full">
                      {d.slices.map((slice, i) => {
                        const totalExpenseNum = moneyToDbNumber(d.totalExpense);
                        const pct =
                          totalExpenseNum > 0
                            ? Math.round(
                                (moneyToDbNumber(slice.total) /
                                  totalExpenseNum) *
                                  100,
                              )
                            : 0;
                        return (
                          <li
                            key={slice.name}
                            className="flex items-center gap-1.5 py-0.5 text-[11px]"
                          >
                            <span
                              className="size-2 shrink-0 rounded-[2px]"
                              style={{
                                background:
                                  CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                              }}
                            />
                            <span className="min-w-0 flex-1 truncate font-medium text-ink">
                              {slice.name}
                            </span>
                            <span className="shrink-0 font-display text-[10px] font-bold text-ink-faint">
                              {pct}%
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <div className="flex items-center justify-between px-[18px] py-4">
            <h2 className="font-display text-sm font-bold text-ink">
              Month on month
            </h2>
            <span className="text-xs text-ink-faint">Total expenditure</span>
          </div>
          <div className="px-[18px] pb-2">
            <div className="flex h-[130px] items-end gap-2.5">
              {expenditureBars.map((t, i) => {
                const heightPct = Math.max(
                  4,
                  (moneyToDbNumber(t.total) / trendMax) * 100,
                );
                const isCurrent =
                  !t.isProjected && i === expenditureBars.length - 2;
                return (
                  <div
                    key={t.month}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                  >
                    <span className="font-display text-[10px] font-semibold text-ink-faint">
                      {formatMoneyDisplay(t.total, currency).replace(
                        /\.\d+$/,
                        "",
                      )}
                    </span>
                    <div
                      className={`w-3/5 rounded-t-lg ${
                        t.isProjected
                          ? "border-2 border-dashed border-accent bg-accent-soft"
                          : isCurrent
                            ? "bg-accent"
                            : "bg-accent-soft"
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex gap-2.5 border-t border-line pt-2">
              {expenditureBars.map((t, i) => {
                const isCurrent =
                  !t.isProjected && i === expenditureBars.length - 2;
                return (
                  <span
                    key={t.month}
                    className={`flex-1 text-center font-display text-[10px] font-semibold ${
                      t.isProjected
                        ? "text-accent"
                        : isCurrent
                          ? "text-accent"
                          : "text-ink-faint"
                    }`}
                  >
                    {monthShortLabel(t.month)}
                    {t.isProjected && "*"}
                  </span>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-ink-faint">
              * {monthShortLabel(nextMonth)} is projected from whatever&apos;s
              already tagged to that cycle — recurring items and any one-off
              transactions added ahead of time.
            </p>
          </div>
        </div>

        {/* v1.2 — new: income next to expense, not just expense alone.
            Same six months as the trend above, reusing the same
            getMonthlyCashFlowTrend call rather than a second query.
            expense here is combinedTrend's (ledger + card spend). */}
        <div className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <div className="flex items-center justify-between px-[18px] py-4">
            <h2 className="font-display text-sm font-bold text-ink">
              Income vs expenses
            </h2>
            <span className="text-xs text-ink-faint">Last 6 months</span>
          </div>
          <div className="px-[18px] pb-4">
            <div className="flex h-[130px] items-end gap-3">
              {combinedTrend.map((t) => {
                const incomeHeightPct = Math.max(
                  4,
                  (moneyToDbNumber(t.income) / cashFlowMax) * 100,
                );
                const expenseHeightPct = Math.max(
                  4,
                  (moneyToDbNumber(t.expense) / cashFlowMax) * 100,
                );
                return (
                  <div
                    key={t.month}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                  >
                    <div className="flex h-full w-full items-end justify-center gap-[3px]">
                      <div
                        className="w-2/5 rounded-t-md bg-positive"
                        style={{ height: `${incomeHeightPct}%` }}
                      />
                      <div
                        className="w-2/5 rounded-t-md bg-negative"
                        style={{ height: `${expenseHeightPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex gap-3 border-t border-line pt-2">
              {combinedTrend.map((t) => (
                <span
                  key={t.month}
                  className="flex-1 text-center font-display text-[10px] font-semibold text-ink-faint"
                >
                  {monthShortLabel(t.month)}
                </span>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[10.5px] text-ink-soft">
                <span className="size-2 rounded-[2px] bg-positive" /> Income
              </span>
              <span className="flex items-center gap-1.5 text-[10.5px] text-ink-soft">
                <span className="size-2 rounded-[2px] bg-negative" /> Expenses
              </span>
            </div>
          </div>
        </div>

        {/* v1.2 — new: what fraction of each month's income was left
            over after expenses. Same trend data as the chart above,
            just read as a rate instead of two absolute figures — the
            "are we actually saving anything" question the totals alone
            don't answer directly. expense here is combinedTrend's
            (ledger + card spend), so the rate reflects real spend. */}
        <div className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <div className="px-[18px] py-4">
            <h2 className="font-display text-sm font-bold text-ink">
              Savings rate
            </h2>
            <p className="mt-0.5 text-[11px] text-ink-faint">
              Share of each month&apos;s income left over after expenses
            </p>
          </div>
          <ul className="px-[18px] pb-4">
            {combinedTrend.map((t) => {
              const rate = savingsRatePct(t.income, t.expense);
              const barPct = rate === null ? 0 : Math.min(100, Math.abs(rate));
              const isNegative = rate !== null && rate < 0;
              return (
                <li
                  key={t.month}
                  className="flex items-center gap-3 border-b border-line py-2 last:border-b-0"
                >
                  <span className="w-9 shrink-0 font-display text-[11px] font-bold text-ink-soft">
                    {monthShortLabel(t.month)}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
                    <div
                      className={`h-full rounded-full ${isNegative ? "bg-negative" : "bg-positive"}`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <span
                    className={`w-12 shrink-0 text-right font-display text-[11.5px] font-bold ${
                      rate === null
                        ? "text-ink-faint"
                        : isNegative
                          ? "text-negative"
                          : "text-positive"
                    }`}
                  >
                    {rate === null ? "—" : `${rate}%`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-sm font-bold text-ink">
              Card-level breakdown
            </h2>
            <div className="flex items-center gap-1.5">
              <Link
                href={`/intel?cardMonth=${shiftMonth(cardMonth, -1)}`}
                className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent"
                aria-label="Previous month"
              >
                &#8249;
              </Link>
              <span className="min-w-[86px] text-center font-display text-xs font-bold text-ink-soft">
                {shortMonthLabel(cardMonth)}
              </span>
              <Link
                href={`/intel?cardMonth=${shiftMonth(cardMonth, 1)}`}
                className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent"
                aria-label="Next month"
              >
                &#8250;
              </Link>
              {!isCurrentCardMonth && (
                <Link
                  href="/intel"
                  className="ml-1 rounded-full bg-accent px-2.5 py-1 font-display text-[10px] font-bold text-white"
                >
                  Today
                </Link>
              )}
            </div>
          </div>

          {!anyCardStatements ? (
            <div className="rounded-[20px] border-[1.5px] border-dashed border-line bg-surface p-5 text-center text-ink-faint">
              <div className="mb-1.5 font-display text-[13px] font-bold text-ink-soft">
                Needs statement imports
              </div>
              <p className="mx-auto max-w-[440px] text-sm leading-relaxed">
                Once you upload a credit card statement PDF on the Imports page,
                this section will break each card&apos;s spend into categories
                and compare card-by-card.
              </p>
            </div>
          ) : cardBreakdown.cards.length === 0 ? (
            <div className="rounded-[20px] border-[1.5px] border-dashed border-line bg-surface p-5 text-center text-ink-faint">
              <p className="text-sm">
                No card spend recorded for {shortMonthLabel(cardMonth)}.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {cardBreakdown.cards.length > 1 &&
                renderCardDonut(
                  "all-cards",
                  "All cards",
                  cardBreakdown.aggregate,
                )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {cardBreakdown.cards.map((card) =>
                  renderCardDonut(card.cardKey, card.cardLabel, card),
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
