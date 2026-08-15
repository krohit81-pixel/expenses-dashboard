import Link from "next/link";
import type { Metadata } from "next";
import { Repeat } from "lucide-react";

import { requireUser } from "@/lib/auth/require-user";
import { listAccounts } from "@/services/AccountService";
import { getUserSettings } from "@/services/UserSettingsService";
import { getMonthlyBudgetSnapshot } from "@/services/BudgetSnapshotService";
import {
  addMoney,
  formatMoneyDisplay,
  isNegativeMoney,
  negateMoney,
  sumMoney,
} from "@/lib/money";
import {
  computeCardDuesTotal,
  computeCommittedExpenseTotal,
} from "@/lib/budget/home-stats";
import {
  buildCycleSummary,
  computeBiggestChanges,
  computeCycleDelta,
  cycleCloseLabel,
  findLargestExpenseName,
  meterPosition,
  pickCycleState,
} from "@/lib/budget/cycle-compare";
import {
  currentCycleMonth,
  isValidMonth,
  monthLabel,
  shiftMonth,
} from "@/lib/dates/month";
import { Hero } from "@/components/ui/hero";
import { SplitCard } from "@/components/ui/split-card";
import { SectionHeading } from "@/features/dashboard/components/SectionHeading";
import { CycleBriefCard } from "@/features/dashboard/components/CycleBriefCard";
import {
  CycleStatGrid,
  type CycleStat,
} from "@/features/dashboard/components/CycleStatGrid";
import { BiggestChanges } from "@/features/dashboard/components/BiggestChanges";
import { LoggedFeedList } from "@/features/dashboard/components/LoggedFeedList";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * v2.1: absorbs Budgets entirely — one monthly-cycle budget view instead
 * of two nearly-identical pages (a condensed Home glance that just linked
 * out to a separate, fuller Budgets page for the real breakdown). The
 * household's own framing for this version: Dashboard is "where I see
 * the budget: monthly cycle-wise break up of expenses/income" — so this
 * now shows both the quick glance (income/expenses/net stat row) AND the
 * full editable-style breakdown (every recurring income/fixed-expense
 * line, plus one-off/card-due items tagged to this cycle) on one screen,
 * exactly what /budgets used to show, sourced from the same
 * getMonthlyBudgetSnapshot data.
 *
 * /budgets itself is left running, untouched, in case anything still
 * links to it directly — it's just no longer in More's nav, since
 * everything it showed now lives here.
 *
 * No accounts balance strip (removed in v2.0, still gone) and no "mark
 * as paid" anywhere — whatever's tagged to a cycle (via Recurring, see
 * Log) is assumed to happen. Editing/tagging still happens on Recurring;
 * this page is a read of that same data, not a second place to edit it.
 *
 * v3.1.0 rebuild: the household pointed at another app's header and
 * dashboard for a "more professional finance planner" look — see
 * Hero's own v3.1.0 comment for the header half, and
 * lib/budget/cycle-compare.ts for the pure logic behind everything
 * below. Concretely: the net figure moved out of Hero into a new
 * "Cycle Brief" card (a deficit/surplus meter plus a real, data-only
 * summary paragraph); the old 3-stat "at a glance" row is replaced by
 * a 4-stat grid compared against last cycle's snapshot (one extra
 * getMonthlyBudgetSnapshot call — the function already takes any
 * month, no schema change needed); "Biggest Changes" is new, built
 * from the same two snapshots; the Full breakdown split-cards and the
 * bottom Recurring/Intel link-cards are unchanged. "Logged this
 * cycle" is restyled (pill tags instead of a plain list) but reads
 * the exact same snapshot.oneOff data as before.
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

  function cycleTotals(snap: typeof snapshot) {
    const oneOffIncome = sumMoney(
      snap.oneOff.filter((l) => l.kind === "income").map((l) => l.amount),
    );
    const totalIncome = addMoney(snap.incomeTotal, oneOffIncome);
    const totalExpense = computeCommittedExpenseTotal(snap);
    const net = addMoney(totalIncome, negateMoney(totalExpense));
    const cardDues = computeCardDuesTotal(snap);
    return { totalIncome, totalExpense, net, cardDues };
  }

  const current = cycleTotals(snapshot);
  const previous = cycleTotals(prevSnapshot);

  const netIsNegative = isNegativeMoney(current.net);
  const netAbsolute = netIsNegative ? negateMoney(current.net) : current.net;
  const netDisplay = `${netIsNegative ? "−" : "+"}${formatMoneyDisplay(netAbsolute, currency)}`;

  const oneOffTotal = sumMoney(
    snapshot.oneOff
      .filter(
        (line) => line.kind !== "transfer" || line.transferReducesCashOnHand,
      )
      .map((line) =>
        line.kind === "income" ? line.amount : negateMoney(line.amount),
      ),
  );

  // Cycle Brief
  const cycleState = pickCycleState(current.net, current.totalIncome);
  const netDelta = computeCycleDelta(current.net, previous.net);
  const qualifier =
    netDelta.direction === "pos"
      ? "Better than last cycle"
      : netDelta.direction === "neg"
        ? "Tighter than last cycle"
        : "About the same as last cycle";
  const meterPct = meterPosition(
    current.net,
    addMoney(current.totalIncome, current.totalExpense),
  );
  const summary = buildCycleSummary({
    totalIncome: current.totalIncome,
    net: current.net,
    currency,
    largestExpenseName: findLargestExpenseName(snapshot),
  });
  const closeLabel = cycleCloseLabel(month);

  // This Cycle vs Last
  const stats: CycleStat[] = (
    [
      {
        label: "Income",
        current: current.totalIncome,
        previous: previous.totalIncome,
        moreIsGood: true,
      },
      {
        label: "Expenses",
        current: current.totalExpense,
        previous: previous.totalExpense,
        moreIsGood: false,
      },
      {
        label: "Net",
        current: current.net,
        previous: previous.net,
        moreIsGood: true,
      },
      {
        label: "Card dues",
        current: current.cardDues,
        previous: previous.cardDues,
        moreIsGood: false,
      },
    ] as const
  ).map(({ label, current: cur, previous: prev, moreIsGood }) => {
    const delta = computeCycleDelta(cur, prev);
    const curNeg = isNegativeMoney(cur);
    const prevNeg = isNegativeMoney(prev);
    return {
      label,
      valueDisplay: `${curNeg ? "−" : label === "Net" ? "+" : ""}${formatMoneyDisplay(curNeg ? negateMoney(cur) : cur, currency)}`,
      prevDisplay: `${prevNeg ? "−" : label === "Net" ? "+" : ""}${formatMoneyDisplay(prevNeg ? negateMoney(prev) : prev, currency)}`,
      current: cur,
      previous: prev,
      direction:
        delta.direction === "flat"
          ? "flat"
          : (delta.direction === "pos") === moreIsGood
            ? "pos"
            : "neg",
      changeLabel: delta.label ?? "No change",
    } satisfies CycleStat;
  });

  // Biggest Changes
  const biggestChanges = computeBiggestChanges(
    snapshot,
    prevSnapshot,
    currency,
  );

  return (
    <div>
      <Hero subtitle={`${monthLabel(month)} cycle`} />

      <div className="space-y-6 p-5 sm:p-8">
        <section>
          <SectionHeading index="01" title="Cycle Brief" meta="this cycle" />
          <CycleBriefCard
            month={month}
            isCurrentMonth={isCurrentMonth}
            state={cycleState}
            qualifier={qualifier}
            qualifierTone={netDelta.direction}
            netDisplay={netDisplay}
            meterPct={meterPct}
            summary={summary}
            closeLabel={closeLabel}
          />
        </section>

        <section>
          <SectionHeading
            index="02"
            title="This Cycle vs Last"
            meta="4 figures"
          />
          <CycleStatGrid stats={stats} />
        </section>

        <section>
          <SectionHeading
            index="03"
            title="Biggest Changes"
            meta="vs last cycle"
          />
          <BiggestChanges tiles={biggestChanges} />
        </section>

        <section>
          <SectionHeading
            index="04"
            title="Full Breakdown"
            meta={monthLabel(month)}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SplitCard
              title="Income & receivables"
              titleColorClass="text-positive"
              total={`+${formatMoneyDisplay(snapshot.incomeTotal, currency)}`}
              isEmpty={snapshot.income.length === 0}
            >
              {snapshot.income.map((line) => (
                <li
                  key={line.id}
                  className="flex items-center justify-between gap-3 border-b border-line px-[18px] py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {line.name}
                    </p>
                    {line.status === "pending" && (
                      <p className="text-[11px] text-ink-faint">Not yet paid</p>
                    )}
                  </div>
                  <p className="whitespace-nowrap font-display text-sm font-bold text-positive">
                    +{formatMoneyDisplay(line.amount, line.currencyCode)}
                  </p>
                </li>
              ))}
            </SplitCard>

            <SplitCard
              title="Fixed expenses"
              titleColorClass="text-negative"
              total={`−${formatMoneyDisplay(snapshot.fixedExpenseTotal, currency)}`}
              isEmpty={snapshot.fixedExpenses.length === 0}
            >
              {snapshot.fixedExpenses.map((line) => (
                <li
                  key={line.id}
                  className="flex items-center justify-between gap-3 border-b border-line px-[18px] py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {line.name}
                    </p>
                    {line.status === "pending" && (
                      <p className="text-[11px] text-ink-faint">Not yet paid</p>
                    )}
                  </div>
                  <p className="whitespace-nowrap font-display text-sm font-bold text-negative">
                    &minus;
                    {formatMoneyDisplay(line.amount, line.currencyCode)}
                  </p>
                </li>
              ))}
            </SplitCard>
          </div>
        </section>

        <section>
          <SectionHeading
            index="05"
            title="Logged This Cycle"
            meta={`${formatMoneyDisplay(oneOffTotal, currency)} net`}
          />
          <LoggedFeedList items={snapshot.oneOff} accountName={accountName} />
        </section>

        <p className="text-xs text-ink-faint">
          Recurring items only show up here once tagged to this cycle &mdash;
          tag templates, edit amounts, or delete them on{" "}
          <Link href="/log" className="underline">
            Log
          </Link>
          .
        </p>

        <Link
          href="/recurring"
          className="flex items-center gap-3 rounded-[20px] bg-surface p-5 shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-accent-soft text-accent">
            <Repeat className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[14.5px] font-extrabold text-ink">
              Key in or edit this cycle
            </div>
            <div className="mt-0.5 text-[11.5px] text-ink-faint">
              Tag recurring income/expenses to {monthLabel(month)} on Recurring
            </div>
          </div>
          <span className="shrink-0 font-display text-xs font-bold text-accent">
            Go &rarr;
          </span>
        </Link>

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
