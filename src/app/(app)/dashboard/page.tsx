import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/lib/auth/require-user";
import { listAccounts } from "@/services/AccountService";
import { listCategories } from "@/services/CategoryService";
import { listTransactions } from "@/services/TransactionService";
import { getUserSettings } from "@/services/UserSettingsService";
import { getMonthlyBudgetSnapshot } from "@/services/BudgetSnapshotService";
import { getCycleStartingBalance } from "@/services/CycleBalanceService";
import {
  addMoney,
  formatMoneyDisplay,
  isNegativeMoney,
  negateMoney,
} from "@/lib/money";
import { computeCommittedExpenseTotal } from "@/lib/budget/home-stats";
import {
  computeExpensesRemaining,
  computeRunningBalance,
} from "@/lib/budget/cycle-balance";
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
import { CycleColumnsSection } from "@/features/dashboard/components/CycleColumnsSection";
import { CycleBalanceCard } from "@/features/dashboard/components/CycleBalanceCard";
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
 * v3.5.0: "Logged This Cycle" is a real interactive two-column split
 * now (CycleColumnsSection — Expenses left, Income right on wider
 * screens, stacked on narrow ones), replacing the read-only
 * LoggedFeedList (deleted) — reuses TransactionRow directly, so mark
 * paid/pending, inline edit, and delete all work right here, not just
 * on /transactions. New "Balance" section (CycleBalanceCard):
 * Expenses Remaining (pending expense/transfer lines not yet paid) and
 * Account Balance (an editable per-cycle starting balance +
 * live-computed posted income/expenses — CycleBalanceService,
 * lib/budget/cycle-balance.ts). See both files' own comments for why
 * the editable figure is the STARTING balance, never the derived
 * running total directly.
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
  const [
    snapshot,
    prevSnapshot,
    accounts,
    categories,
    settings,
    startingBalance,
    { transactions: cycleTransactions },
  ] = await Promise.all([
    getMonthlyBudgetSnapshot(month),
    getMonthlyBudgetSnapshot(prevMonth),
    listAccounts(),
    listCategories(true),
    getUserSettings(user.id),
    getCycleStartingBalance(month),
    listTransactions({ cycleMonth: month, limit: 300 }),
  ]);

  const currency = settings?.baseCurrency ?? "USD";
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  // Same income/expense split convention /transactions itself uses —
  // "expense" here also covers transfers (card dues), matching
  // TransactionRow's own kind handling.
  const incomeTransactions = cycleTransactions.filter(
    (t) => t.kind === "income",
  );
  const expenseTransactions = cycleTransactions.filter(
    (t) => t.kind !== "income",
  );

  const expensesRemaining = computeExpensesRemaining(snapshot);
  const runningBalance = computeRunningBalance(snapshot, startingBalance);

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
          <CycleColumnsSection
            expenseTransactions={expenseTransactions}
            incomeTransactions={incomeTransactions}
            accountName={accountName}
            categoryName={categoryName}
          />
        </section>

        <section>
          <SectionHeading index="03" title="Balance" />
          <CycleBalanceCard
            cycleMonth={month}
            currency={currency}
            expensesRemaining={expensesRemaining}
            startingBalance={startingBalance}
            runningBalance={runningBalance}
          />
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
