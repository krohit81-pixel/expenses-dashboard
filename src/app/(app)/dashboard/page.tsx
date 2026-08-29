import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/lib/auth/require-user";
import { listAccounts } from "@/services/AccountService";
import { getUserSettings } from "@/services/UserSettingsService";
import { getMonthlyBudgetSnapshot } from "@/services/BudgetSnapshotService";
import {
  addMoney,
  formatMoneyDisplay,
  isNegativeMoney,
  negateMoney,
} from "@/lib/money";
import { computeCommittedExpenseTotal } from "@/lib/budget/home-stats";
import {
  currentCycleMonth,
  cycleCloseLabel,
  isValidMonth,
  monthLabel,
  shiftMonth,
} from "@/lib/dates/month";
import { Hero } from "@/components/ui/hero";
import { SectionHeading } from "@/features/dashboard/components/SectionHeading";
import { DashboardMonthNav } from "@/features/dashboard/components/DashboardMonthNav";
import { LoggedFeedList } from "@/features/dashboard/components/LoggedFeedList";
import { RepeatLastCycleButton } from "@/features/dashboard/components/RepeatLastCycleButton";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * v3.4.14 rewrite: a plain running total, replacing the v3.1.0
 * comparison-framed rebuild below (kept for history). Recurring
 * (templates + bulk cycle-tag) is gone entirely — the household found
 * it too complicated for how they actually use the app — and this page
 * no longer compares this cycle against last cycle's snapshot at all;
 * it just shows what's real: this cycle's income, expenses, net, and
 * the actual list of what's logged, sourced from
 * BudgetSnapshotService's own flattened shape (see that service's
 * v3.4.14 comment). The old "Full Breakdown" (two SplitCards, income
 * vs. fixed-expense) and "Logged This Cycle" (LoggedFeedList) sections
 * showed the same underlying data two different ways once there's no
 * more recurring-vs-one-off distinction — merged into one list here,
 * reusing LoggedFeedList unchanged. The old `/recurring` link-card is
 * replaced by `RepeatLastCycleButton` — Recurring's replacement, a
 * one-tap duplicate of last cycle's transactions into this one.
 *
 * `DashboardMonthNav` used to render *inside* the now-deleted
 * CycleBriefCard; it's rendered directly here now — it's the real
 * prev/next/Today cycle pager, not cosmetic.
 *
 * (v3.1.0, superseded above): the household pointed at another app's
 * header/dashboard for a "more professional finance planner" look —
 * net moved into a Cycle Brief card (deficit/surplus meter + summary
 * sentence), a 4-stat "this cycle vs last" grid, and a "Biggest
 * Changes" comparison section. All three needed a second
 * getMonthlyBudgetSnapshot(prevMonth) call and lib/budget/cycle-compare.ts
 * (now deleted) to build.
 *
 * (v2.1, superseded further back): absorbed Budgets entirely — one
 * monthly-cycle budget view instead of two nearly-identical pages.
 * `/budgets` itself is now deleted too (v3.4.14) — it depended on the
 * exact recurring-template routing that's gone, and nothing linked to
 * it anymore anyway.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const month = isValidMonth(monthParam) ? monthParam : currentCycleMonth();
  const isCurrentMonth = month === currentCycleMonth();
  const prevMonth = shiftMonth(month, -1);

  const user = await requireUser();
  const [snapshot, prevSnapshot, accounts, settings] = await Promise.all([
    getMonthlyBudgetSnapshot(month),
    getMonthlyBudgetSnapshot(prevMonth),
    listAccounts(),
    getUserSettings(user.id),
  ]);

  const currency = settings?.baseCurrency ?? "USD";
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));

  const expenseTotal = computeCommittedExpenseTotal(snapshot);
  const net = addMoney(snapshot.incomeTotal, negateMoney(expenseTotal));
  const netIsNegative = isNegativeMoney(net);
  const netDisplay = `${netIsNegative ? "−" : "+"}${formatMoneyDisplay(netIsNegative ? negateMoney(net) : net, currency)}`;

  const stats = [
    {
      label: "Income",
      display: `+${formatMoneyDisplay(snapshot.incomeTotal, currency)}`,
      tone: "text-positive",
    },
    {
      label: "Expenses",
      display: `−${formatMoneyDisplay(expenseTotal, currency)}`,
      tone: "text-negative",
    },
    {
      label: "Net",
      display: netDisplay,
      tone: netIsNegative ? "text-negative" : "text-positive",
    },
  ];

  // "Repeat last cycle" preview — same live-only, non-void set the
  // action itself will actually copy (BudgetSnapshotService already
  // filters void rows out of `lines`), so this count/total is exactly
  // what clicking through will do, not an approximation.
  const prevExpenseTotal = computeCommittedExpenseTotal(prevSnapshot);
  const prevNet = addMoney(
    prevSnapshot.incomeTotal,
    negateMoney(prevExpenseTotal),
  );
  const prevNetIsNegative = isNegativeMoney(prevNet);
  const prevNetDisplay = `${prevNetIsNegative ? "−" : "+"}${formatMoneyDisplay(prevNetIsNegative ? negateMoney(prevNet) : prevNet, currency)}`;

  return (
    <div>
      <Hero subtitle={`${monthLabel(month)} cycle`} />

      <div className="space-y-6 p-5 sm:p-8">
        <section>
          <SectionHeading
            index="01"
            title="This Cycle"
            meta={`closes ${cycleCloseLabel(month)}`}
          />
          <DashboardMonthNav month={month} isCurrentMonth={isCurrentMonth} />
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-line bg-surface p-3"
              >
                <div className="text-[11px] font-semibold text-ink-soft">
                  {stat.label}
                </div>
                <div
                  className={`mt-1 truncate font-display text-lg font-extrabold tracking-tight ${stat.tone}`}
                >
                  {stat.display}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading
            index="02"
            title="Logged This Cycle"
            meta={monthLabel(month)}
          />
          <LoggedFeedList items={snapshot.lines} accountName={accountName} />
        </section>

        <RepeatLastCycleButton
          targetMonth={month}
          lastCycleLabel={monthLabel(prevMonth)}
          count={prevSnapshot.lines.length}
          totalDisplay={prevNetDisplay}
        />

        <Link
          href="/intel"
          className="flex items-center gap-3 rounded-[20px] bg-gradient-to-br from-accent-soft to-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-accent text-white">
            📊
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[13.5px] font-extrabold text-ink">
              See the full picture
            </div>
            <div className="mt-0.5 text-[11px] text-ink-faint">
              Compare {monthLabel(month)} against recent cycles on Intel
            </div>
          </div>
          <span className="shrink-0 font-display text-xs font-bold text-accent">
            Open &rarr;
          </span>
        </Link>
      </div>
    </div>
  );
}
