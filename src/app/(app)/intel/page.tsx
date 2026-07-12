import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/require-user";
import {
  getCashFlowSummary,
  getMonthlyExpenditureTrend,
} from "@/services/ReportingService";
import { listCategories } from "@/services/CategoryService";
import { getUserSettings } from "@/services/UserSettingsService";
import { generateInsight } from "@/services/IntelService";
import {
  compareMoney,
  formatMoneyDisplay,
  moneyToDbNumber,
  sumMoney,
  ZERO,
} from "@/lib/money";
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

export default async function IntelPage() {
  const user = await requireUser();
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  )
    .toISOString()
    .slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const [summary, trend, categories, settings, insight] = await Promise.all([
    getCashFlowSummary({ from: monthStart, to: today }),
    getMonthlyExpenditureTrend(6),
    listCategories(true),
    getUserSettings(user.id),
    generateInsight(),
  ]);

  const currency = settings?.baseCurrency ?? "USD";
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  // Top 5 categories by amount, rest bucketed into "Other" — keeps the
  // donut/legend readable regardless of how many categories are in use.
  const sorted = [...summary.expenseByCategory].sort(
    (a, b) => moneyToDbNumber(b.total) - moneyToDbNumber(a.total),
  );
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5);
  const otherTotal = sumMoney(rest.map((c) => c.total));
  const slices = [
    ...top.map((c) => ({
      name: categoryName.get(c.categoryId) ?? "Uncategorized",
      total: c.total,
    })),
    ...(compareMoney(otherTotal, ZERO) > 0
      ? [{ name: "Other", total: otherTotal }]
      : []),
  ];

  const totalExpense = moneyToDbNumber(summary.totalExpense);
  let cumulative = 0;
  const gradientStops = slices.map((slice, i) => {
    const pct =
      totalExpense > 0
        ? (moneyToDbNumber(slice.total) / totalExpense) * 100
        : 0;
    const from = cumulative;
    cumulative += pct;
    return `${CATEGORY_COLORS[i % CATEGORY_COLORS.length]} ${from}% ${cumulative}%`;
  });
  const donutStyle = {
    background: `conic-gradient(${gradientStops.join(", ")})`,
  };

  const trendMax = Math.max(1, ...trend.map((t) => moneyToDbNumber(t.total)));

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
              Insight isn&apos;t available right now — either ANTHROPIC_API_KEY
              isn&apos;t configured, or something went wrong generating it.
              Charts below still reflect real data.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
            <div className="flex items-center justify-between px-[18px] py-4">
              <h2 className="font-display text-sm font-bold text-ink">
                By category &middot; this month
              </h2>
              <span className="font-display text-xs font-bold text-ink-faint">
                {formatMoneyDisplay(summary.totalExpense, currency)}
              </span>
            </div>
            {slices.length === 0 ? (
              <p className="px-[18px] pb-5 text-sm text-ink-faint">
                No expenses recorded yet this month.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-5 px-[18px] pb-5">
                <div
                  className="relative size-[148px] shrink-0 rounded-full"
                  style={donutStyle}
                >
                  <div className="absolute inset-6 flex flex-col items-center justify-center rounded-full bg-surface">
                    <span className="font-display text-base font-extrabold text-ink">
                      {formatMoneyDisplay(summary.totalExpense, currency)}
                    </span>
                    <span className="text-[9px] uppercase tracking-wide text-ink-faint">
                      total
                    </span>
                  </div>
                </div>
                <ul className="min-w-[180px] flex-1">
                  {slices.map((slice, i) => {
                    const pct =
                      totalExpense > 0
                        ? Math.round(
                            (moneyToDbNumber(slice.total) / totalExpense) * 100,
                          )
                        : 0;
                    return (
                      <li
                        key={slice.name}
                        className="flex items-center gap-2 py-1.5 text-sm"
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-[3px]"
                          style={{
                            background:
                              CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                          }}
                        />
                        <span className="flex-1 font-medium text-ink">
                          {slice.name}
                        </span>
                        <span className="font-display text-[11px] font-bold text-ink-faint">
                          {pct}%
                        </span>
                        <span className="w-[76px] text-right font-display text-xs font-semibold text-ink-soft">
                          {formatMoneyDisplay(slice.total, currency)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
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
                {trend.map((t, i) => {
                  const heightPct = Math.max(
                    4,
                    (moneyToDbNumber(t.total) / trendMax) * 100,
                  );
                  const isCurrent = i === trend.length - 1;
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
                        className={`w-3/5 rounded-t-lg ${isCurrent ? "bg-accent" : "bg-accent-soft"}`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-2.5 border-t border-line pt-2">
                {trend.map((t, i) => (
                  <span
                    key={t.month}
                    className={`flex-1 text-center font-display text-[10px] font-semibold ${
                      i === trend.length - 1 ? "text-accent" : "text-ink-faint"
                    }`}
                  >
                    {monthShortLabel(t.month)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border-[1.5px] border-dashed border-line bg-surface p-5 text-center text-ink-faint">
          <div className="mb-1.5 font-display text-[13px] font-bold text-ink-soft">
            Card-level breakdown &middot; needs statement imports
          </div>
          <p className="mx-auto max-w-[440px] text-sm leading-relaxed">
            Once you can upload credit card PDFs, Intel will break each
            card&apos;s spend into categories, flag what&apos;s creeping up, and
            compare card-by-card.
          </p>
        </div>
      </div>
    </div>
  );
}
