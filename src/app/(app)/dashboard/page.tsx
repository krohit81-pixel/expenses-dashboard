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
import { computeCommittedExpenseTotal } from "@/lib/budget/home-stats";
import { currentCycleMonth, isValidMonth, monthLabel } from "@/lib/dates/month";
import { Hero } from "@/components/ui/hero";
import { SplitCard } from "@/components/ui/split-card";
import { transactionDisplayTitle } from "@/features/transactions/format";
import { DashboardMonthNav } from "@/features/dashboard/components/DashboardMonthNav";

export const metadata: Metadata = {
  title: "Dashboard",
};

const STAT_CARD_BG: Record<"positive" | "negative" | "accent", string> = {
  positive: "bg-surface",
  negative: "bg-surface",
  accent: "bg-accent-soft",
};
const STAT_CARD_TEXT: Record<"positive" | "negative" | "accent", string> = {
  positive: "text-positive",
  negative: "text-negative",
  accent: "text-accent",
};

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "accent";
}) {
  return (
    <div
      className={`rounded-2xl p-3 shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)] ${STAT_CARD_BG[tone]}`}
    >
      <div className="font-display text-[9.5px] font-bold uppercase tracking-wide text-ink-faint">
        {label}
      </div>
      <div
        className={`mt-1 truncate font-display text-sm font-extrabold ${STAT_CARD_TEXT[tone]}`}
      >
        {value}
      </div>
    </div>
  );
}

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
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const month = isValidMonth(monthParam) ? monthParam : currentCycleMonth();
  const isCurrentMonth = month === currentCycleMonth();

  const user = await requireUser();
  const [snapshot, accounts, settings] = await Promise.all([
    getMonthlyBudgetSnapshot(month),
    listAccounts(),
    getUserSettings(user.id),
  ]);

  const currency = settings?.baseCurrency ?? "USD";
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));

  const oneOffIncome = snapshot.oneOff.filter((l) => l.kind === "income");
  const oneOffTotal = sumMoney(
    snapshot.oneOff
      .filter(
        (line) => line.kind !== "transfer" || line.transferReducesCashOnHand,
      )
      .map((line) =>
        line.kind === "income" ? line.amount : negateMoney(line.amount),
      ),
  );

  const totalIncome = addMoney(
    snapshot.incomeTotal,
    sumMoney(oneOffIncome.map((l) => l.amount)),
  );
  const totalExpense = computeCommittedExpenseTotal(snapshot);
  const netProjected = addMoney(totalIncome, negateMoney(totalExpense));
  const netIsNegative = isNegativeMoney(netProjected);
  const netAbsolute = netIsNegative ? negateMoney(netProjected) : netProjected;
  const netDisplay = `${netIsNegative ? "−" : "+"}${formatMoneyDisplay(netAbsolute, currency)}`;

  return (
    <div>
      <Hero
        title="Dashboard"
        label={`Projected net for ${monthLabel(month)}`}
        amount={netDisplay}
        sub={`${formatMoneyDisplay(totalIncome, currency)} expected in − ${formatMoneyDisplay(totalExpense, currency)} expected out`}
      >
        <DashboardMonthNav month={month} isCurrentMonth={isCurrentMonth} />
      </Hero>

      <div className="space-y-6 p-5 sm:p-8">
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-[15px] font-bold text-ink">
              This cycle at a glance
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <StatCard
              label="Income"
              value={formatMoneyDisplay(totalIncome, currency)}
              tone="positive"
            />
            <StatCard
              label="Expenses"
              value={formatMoneyDisplay(totalExpense, currency)}
              tone="negative"
            />
            <StatCard label="Net" value={netDisplay} tone="accent" />
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-[15px] font-bold text-ink">
              Full breakdown
            </h2>
            <span className="text-xs text-ink-faint">{monthLabel(month)}</span>
          </div>
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

          <div className="mt-4 rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
            <div className="flex items-center justify-between px-[18px] py-4">
              <h3 className="font-display text-sm font-bold text-accent">
                Logged this cycle &middot; card payments &amp; other one-off
              </h3>
              <span className="font-display text-xs font-bold text-ink-faint">
                {formatMoneyDisplay(oneOffTotal, currency)} net
              </span>
            </div>
            {snapshot.oneOff.length === 0 ? (
              <p className="px-[18px] pb-4 text-sm text-ink-faint">
                Nothing logged for {monthLabel(month)} yet.
              </p>
            ) : (
              <ul>
                {snapshot.oneOff.map((line) => (
                  <li
                    key={line.id}
                    className="flex items-center justify-between gap-3 border-b border-line px-[18px] py-3 last:border-b-0"
                  >
                    <p className="min-w-0 truncate text-sm font-semibold text-ink">
                      {transactionDisplayTitle(line, accountName)}
                    </p>
                    {line.kind === "transfer" &&
                    !line.transferReducesCashOnHand ? (
                      <p className="whitespace-nowrap font-display text-sm font-bold text-ink-faint">
                        Transfer &middot;{" "}
                        {formatMoneyDisplay(line.amount, line.currencyCode)}
                      </p>
                    ) : (
                      <p
                        className={`whitespace-nowrap font-display text-sm font-bold ${
                          line.kind === "income"
                            ? "text-positive"
                            : "text-negative"
                        }`}
                      >
                        {line.kind === "income" ? "+" : "−"}
                        {formatMoneyDisplay(line.amount, line.currencyCode)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
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
