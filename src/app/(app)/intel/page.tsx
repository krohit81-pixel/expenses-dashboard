import type { Metadata } from "next";

import { Suspense } from "react";

import { requireUser } from "@/lib/auth/require-user";
import {
  getCashFlowSummary,
  getMonthlyCashFlowTrend,
  type CashFlowSummary,
} from "@/services/ReportingService";
import { listCategories } from "@/services/CategoryService";
import { getUserSettings } from "@/services/UserSettingsService";
import { getStoredInsight } from "@/services/IntelService";
import {
  getCardCategoryBreakdown,
  hasAnyCreditCardStatement,
  type CardCategoryAmount,
} from "@/services/CreditCardIntelService";
import { getPlannedCardDuesForMonths } from "@/services/BudgetSnapshotService";
import { listAtlasCategories } from "@/services/MerchantService";
import { buildDonutGradientStops, buildDonutSlices } from "@/lib/intel/donut";
import {
  addMoney,
  compareMoney,
  formatMoneyDisplay,
  moneyToDbNumber,
  ZERO,
  type Money,
} from "@/lib/money";
import {
  currentMonth,
  isValidMonth,
  shiftMonth,
  shortMonthLabel,
} from "@/lib/dates/month";
import { Hero } from "@/components/ui/hero";
import { Spinner } from "@/components/ui/spinner";
import { GenerateInsightButton } from "@/features/intel/components/GenerateInsightButton";
import { CardMonthNav } from "@/features/intel/components/CardMonthNav";
import { DonutSliceLink } from "@/features/intel/components/DonutSliceLink";

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

/**
 * Sentinel "category id" for credit card dues in the ledger-only
 * charts below (by-category donuts) — v1.6.1, at the household's
 * request: card dues show there as one lumped "Credit Card Dues" line,
 * not broken out by its own Merchant Dictionary category, since that
 * per-category detail already has its own dedicated section further
 * down the page. Never collides with a real finance.categories id
 * (those are uuids).
 *
 * v1.6.3: the amount behind this line is the household's own
 * planned/logged card payment for the cycle (see
 * getPlannedCardDuesForMonths), not real per-statement spend -- see
 * that function's own comment for why.
 */
const CARD_DUES_CATEGORY_ID = "__credit_card_dues__";
const CARD_DUES_LABEL = "Credit Card Dues";

/**
 * The disclosure triangle for a collapsible section's <summary> --
 * v1.2, "make month on month, by category and the card-level breakdown
 * sections collapsible." Plain native <details>/<summary> (no client
 * component, no JS) does the actual collapsing; this is just the
 * chevron, rotated via the group-open: variant on the parent
 * <details className="group">. Every section defaults open (the
 * `open` attribute on <details>) so existing behavior is unchanged
 * until someone actually collapses one.
 */
function SectionChevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      className="size-3 shrink-0 text-ink-faint transition-transform duration-150 group-open:rotate-90"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Builds the query string for one donut slice's drill-down link -- see the new /intel/card-category route. */
function cardCategoryHref(params: {
  cardMonth: string;
  cardKey: string;
  categoryIds: string[];
  label: string;
}): string {
  const search = new URLSearchParams({
    month: params.cardMonth,
    card: params.cardKey,
    categories: params.categoryIds.join(","),
    label: params.label,
  });
  return `/intel/card-category?${search.toString()}`;
}

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

function formatGeneratedAt(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

function cardDonut(
  breakdown: { totalSpend: Money; byCategory: CardCategoryAmount[] },
  atlasCategoryName: Map<string, string>,
) {
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

/**
 * v1.2: `variant` distinguishes the "All cards" aggregate donut (bolder,
 * slightly larger, an "Overall" badge -- the parent view) from each
 * individual card's own donut (the child breakdown below it) -- see the
 * household's request to "visually show overall card slightly more
 * parent/bolder...and separately its detailed credit cards below as
 * separate child section." `cardMonth`/`cardKeyForLink` build each
 * slice's click-through link to /intel/card-category (the "when you
 * click on groceries...I would like to see the transactions" request);
 * cardKeyForLink is "all" for the aggregate donut, or one card's own
 * cardKey for a per-card donut.
 */
function renderCardDonut(
  key: string,
  label: string,
  breakdown: { totalSpend: Money; byCategory: CardCategoryAmount[] },
  atlasCategoryName: Map<string, string>,
  currency: string,
  cardMonth: string,
  cardKeyForLink: string,
  variant: "aggregate" | "card" = "card",
) {
  const { slices, gradientStops } = cardDonut(breakdown, atlasCategoryName);
  const isAggregate = variant === "aggregate";
  return (
    <div
      key={key}
      className={`rounded-2xl bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)] ${
        isAggregate ? "border-2 border-accent-soft" : ""
      }`}
    >
      <div className="flex items-center gap-1.5 px-3.5 pb-1 pt-3">
        {isAggregate && (
          <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 font-display text-[9px] font-extrabold uppercase tracking-wide text-white">
            Overall
          </span>
        )}
        <h3
          className={`truncate font-display font-bold text-ink ${
            isAggregate ? "text-[13px]" : "text-[11.5px]"
          }`}
        >
          {label}
        </h3>
      </div>
      {slices.length === 0 ? (
        <p className="px-3.5 pb-3.5 text-[12px] leading-relaxed text-ink-faint">
          No spend recorded.
        </p>
      ) : (
        // v1.6.2: donut + legend side by side (was stacked, donut on
        // top) -- a stacked layout left a lot of unused width in each
        // card; a household-flagged issue ("lot of empty spaces...if
        // required shrink it").
        <div className="flex items-center gap-3 px-3.5 pb-3.5">
          <div
            className={`relative shrink-0 rounded-full ${isAggregate ? "size-[92px]" : "size-[76px]"}`}
            style={{
              background: `conic-gradient(${gradientStops.join(", ")})`,
            }}
          >
            <div className="absolute inset-[10px] flex flex-col items-center justify-center rounded-full bg-surface text-center">
              <span className="font-display text-[9.5px] font-extrabold leading-tight text-ink">
                {formatMoneyDisplay(breakdown.totalSpend, currency).replace(
                  /\.\d+$/,
                  "",
                )}
              </span>
            </div>
          </div>
          <ul className="min-w-0 flex-1">
            {slices.map((slice, i) => {
              const totalNum = moneyToDbNumber(breakdown.totalSpend);
              const pct =
                totalNum > 0
                  ? Math.round((moneyToDbNumber(slice.total) / totalNum) * 100)
                  : 0;
              return (
                <li key={slice.name}>
                  <DonutSliceLink
                    href={cardCategoryHref({
                      cardMonth,
                      cardKey: cardKeyForLink,
                      categoryIds: slice.categoryIds,
                      label: slice.name,
                    })}
                    colorSwatch={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                    name={slice.name}
                    amountText={formatMoneyDisplay(
                      slice.total,
                      currency,
                    ).replace(/\.\d+$/, "")}
                    pctText={`${pct}%`}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function CardBreakdownSkeleton() {
  return (
    <div className="flex items-center justify-center rounded-[20px] border-[1.5px] border-dashed border-line bg-surface p-10">
      <Spinner className="size-6 text-accent" />
    </div>
  );
}

/**
 * The per-card, per-category breakdown — split into its own async
 * component (rather than fetched alongside everything else in the
 * page's own top-level Promise.all) so it can be wrapped in its own
 * <Suspense> boundary below. v1.6.1, at the household's request: this
 * is the slowest thing on the page (it's the query joining every
 * card's transactions to their statements and merchants for one
 * cycle month), and blocking the entire page behind it made every
 * visit feel slow — now the rest of Intel renders immediately and
 * this section shows a loading ring while its own data streams in.
 */
async function CardLevelBreakdownSection({
  cardMonth,
  currency,
}: {
  cardMonth: string;
  currency: string;
}) {
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

  if (!anyCardStatements) {
    return (
      <div className="rounded-[20px] border-[1.5px] border-dashed border-line bg-surface p-5 text-center text-ink-faint">
        <div className="mb-1.5 font-display text-[13px] font-bold text-ink-soft">
          Needs statement imports
        </div>
        <p className="mx-auto max-w-[440px] text-sm leading-relaxed">
          Once you upload a credit card statement PDF on the Imports page, this
          section will break each card&apos;s spend into categories and compare
          card-by-card.
        </p>
      </div>
    );
  }

  if (cardBreakdown.cards.length === 0) {
    return (
      <div className="rounded-[20px] border-[1.5px] border-dashed border-line bg-surface p-5 text-center text-ink-faint">
        <p className="text-sm">
          No card spend recorded for {shortMonthLabel(cardMonth)}.
        </p>
      </div>
    );
  }

  const hasMultipleCards = cardBreakdown.cards.length > 1;

  return (
    <div className="space-y-4">
      {hasMultipleCards &&
        renderCardDonut(
          "all-cards",
          "All cards",
          cardBreakdown.aggregate,
          atlasCategoryName,
          currency,
          cardMonth,
          "all",
          "aggregate",
        )}
      {/* v1.2: per-card donuts are the child section beneath "All
          cards" -- the left border + indent + "By card" label visually
          subordinate them to the bolder aggregate donut above, per the
          household's request. Only shown as a distinct child block when
          there's actually a parent aggregate above it; a single card
          has nothing to be a child of, so it renders exactly as before. */}
      <div
        className={
          hasMultipleCards ? "space-y-2 border-l-2 border-line pl-3" : ""
        }
      >
        {hasMultipleCards && (
          <h3 className="font-display text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            By card
          </h3>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {cardBreakdown.cards.map((card) =>
            renderCardDonut(
              card.cardKey,
              card.cardLabel,
              card,
              atlasCategoryName,
              currency,
              cardMonth,
              card.cardKey,
              "card",
            ),
          )}
        </div>
      </div>
    </div>
  );
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
    storedInsight,
    currentSummary,
    prevSummary,
    nextSummary,
  ] = await Promise.all([
    getMonthlyCashFlowTrend(6),
    listCategories(true),
    getUserSettings(user.id),
    getStoredInsight(),
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

  // Fold credit card cycle dues into the ledger-only cash-flow charts
  // below (by-category donuts, month-on-month) -- every month those
  // charts touch, in one query rather than one per month.
  //
  // v1.6.3: this now comes from the household's own planned/logged
  // credit card payment for that cycle (a one-off transfer tagged to
  // cycle_month, the same thing Home's "Card payments due" shows --
  // see getPlannedCardDuesForMonths / computeCardDuesTotal), not from
  // real per-statement data (CreditCardIntelService). v1.6.1/v1.6.2
  // used real statement data for settled months and the planned figure
  // only for the projected month, but that was still wrong for
  // June/July: only one of the household's cards has a statement
  // parser today, so real per-statement data for ANY month undercounts
  // their true multi-card obligation, not just a future one. The
  // planned/logged figure is what the household actually tracks as
  // their full card cycle payment regardless of parser coverage, so it
  // now applies uniformly to every month here. Safe to add directly on
  // top of the ledger's own expense total (not double-counted): this
  // transfer is excluded from getCashFlowSummary by design (see that
  // module's own comment on why), and computeCardDuesTotal deliberately
  // excludes one-off *expenses* (which getCashFlowSummary already
  // counts) -- see that function's own comment. The dedicated
  // Card-level breakdown section below is unaffected by any of this;
  // it's still real per-statement data on purpose, since showing what
  // statement data actually exists is its whole point.
  const cardDuesMonths = [...trend.map((t) => t.month), nextMonth];
  const plannedCardDues = await getPlannedCardDuesForMonths(cardDuesMonths);

  function combinedExpense(month: string, ledgerExpense: Money): Money {
    const dues = plannedCardDues.get(month);
    return dues ? addMoney(ledgerExpense, dues) : ledgerExpense;
  }

  // Same six-plus-one months as expenditureBars below, with card dues
  // already folded into .expense -- .income is untouched.
  const combinedTrend = trend.map((t) => ({
    ...t,
    expense: combinedExpense(t.month, t.expense),
  }));

  const currency = settings?.baseCurrency ?? "USD";
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  // Card dues show in these charts as one lumped "Credit Card Dues"
  // entry (see CARD_DUES_CATEGORY_ID above), not broken out by
  // category -- that detail lives in the dedicated Card-level
  // breakdown section instead. The lumped entry competes for a top-5
  // slot in buildDonutSlices' bucketing like any other category, so a
  // month with heavy card dues shows it prominently rather than always
  // pinning it to a fixed position.
  function donut(summary: CashFlowSummary, month: string) {
    const dues = plannedCardDues.get(month);
    const totalExpense = combinedExpense(month, summary.totalExpense);

    const categoriesWithCardDues = [
      ...summary.expenseByCategory,
      ...(dues && compareMoney(dues, ZERO) > 0
        ? [{ categoryId: CARD_DUES_CATEGORY_ID, total: dues }]
        : []),
    ];
    const namesWithCardDues = new Map(categoryName);
    namesWithCardDues.set(CARD_DUES_CATEGORY_ID, CARD_DUES_LABEL);

    const slices = buildDonutSlices(categoriesWithCardDues, namesWithCardDues);
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
  // activity, and would just be zero for a future month). Card dues
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

  return (
    <div>
      <Hero title="Intel" />

      <div className="space-y-5 p-5 sm:p-8">
        <div className="rounded-[20px] border-[1.5px] border-accent-soft bg-gradient-to-br from-accent-soft to-surface p-5">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 font-display text-[11px] font-bold text-accent">
              &#10024; AI insight
            </span>
            {storedInsight && (
              <span className="text-[10px] text-ink-faint">
                Generated {formatGeneratedAt(storedInsight.generatedAt)}
              </span>
            )}
          </div>
          {storedInsight ? (
            <p className="text-sm leading-relaxed text-ink">
              {storedInsight.text}
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-ink-faint">
              Pending generation — press the button below to generate your first
              insight from this month&apos;s data.
            </p>
          )}
          <GenerateInsightButton />
        </div>

        {/* v1.2: three smaller donuts side by side (previous/current/
            upcoming month) instead of one big one for "this month" —
            makes it possible to see at a glance whether a category is
            trending up or down, and to preview what next month already
            looks like from tagged recurring items, without extra taps. */}
        <details open className="group">
          <summary className="mb-3 flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
            <SectionChevron />
            <span className="font-display text-sm font-bold text-ink">
              By category
            </span>
          </summary>
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
                            {/* Both the amount and the percentage, matching
                                the card-level breakdown's legend above
                                (renderCardDonut) -- v1.6.3 there for the
                                same reasoning. */}
                            <span className="shrink-0 font-display text-[10px] font-bold text-ink-faint">
                              {formatMoneyDisplay(
                                slice.total,
                                currency,
                              ).replace(/\.\d+$/, "")}
                            </span>
                            <span className="w-8 shrink-0 text-right font-display text-[10px] font-bold text-ink-faint">
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
        </details>

        <details
          open
          className="group rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between px-[18px] py-4 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-1.5">
              <SectionChevron />
              <span className="font-display text-sm font-bold text-ink">
                Month on month
              </span>
            </span>
            <span className="text-xs text-ink-faint">Total expenditure</span>
          </summary>
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
        </details>

        <details open className="group">
          <summary className="mb-3 flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
            <SectionChevron />
            <span className="font-display text-sm font-bold text-ink">
              Card-level breakdown
            </span>
          </summary>
          <CardMonthNav
            cardMonth={cardMonth}
            isCurrentCardMonth={isCurrentCardMonth}
          />

          <Suspense key={cardMonth} fallback={<CardBreakdownSkeleton />}>
            <CardLevelBreakdownSection
              cardMonth={cardMonth}
              currency={currency}
            />
          </Suspense>
        </details>
      </div>
    </div>
  );
}
