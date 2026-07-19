import Link from "next/link";
import type { Metadata } from "next";
import { Repeat } from "lucide-react";

import { getMonthlyBudgetSnapshot } from "@/services/BudgetSnapshotService";
import { listAccounts } from "@/services/AccountService";
import { getUserSettings } from "@/services/UserSettingsService";
import { requireUser } from "@/lib/auth/require-user";
import { formatMoneyDisplay, negateMoney, sumMoney } from "@/lib/money";
import { computeProjectedClosing } from "@/lib/budget/home-stats";
import {
  currentMonth,
  isValidMonth,
  monthLabel,
  shiftMonth,
} from "@/lib/dates/month";
import { Hero } from "@/components/ui/hero";
import { SplitCard } from "@/components/ui/split-card";
import { transactionDisplayTitle } from "@/features/transactions/format";

export const metadata: Metadata = {
  title: "Budgets",
};

/**
 * This page replaced an earlier "budgets" feature (period + category
 * planned-vs-actual tracking). That code (BudgetService,
 * features/budgets/*) has been removed — recoverable from git history if
 * ever needed again.
 *
 * v0.4: month-aware snapshot, not just the standing plan. Pick any month
 * — past, present, or future — and see every recurring income/expense
 * that applies to it (projected from the template if nothing's been
 * logged yet, or the real transaction amount if something has), plus
 * anything logged one-off for that month (card payments, etc.) that
 * isn't part of the recurring plan at all. Same query works for history
 * (past months naturally show what actually happened, since real
 * transactions exist by then) and planning ahead (future months show
 * projections). Editing/deleting the underlying recurring templates
 * happens on /recurring, not here — a snapshot row might be showing an
 * actual transaction's amount rather than the template's own amount, so
 * "edit" wouldn't have an unambiguous meaning here.
 */
export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const month = isValidMonth(monthParam) ? monthParam : currentMonth();
  const isCurrentMonth = month === currentMonth();

  const user = await requireUser();
  const [snapshot, accounts, settings] = await Promise.all([
    getMonthlyBudgetSnapshot(month),
    listAccounts(),
    getUserSettings(user.id),
  ]);

  const accountName = new Map(
    accounts.map((account) => [account.id, account.name]),
  );
  const currency = settings?.baseCurrency ?? "USD";
  const projectedClosing = computeProjectedClosing(snapshot);

  // v1.1.4 excluded every transfer from this "net" figure. v1.1.5
  // narrows that: a transfer only stays excluded when
  // transferReducesCashOnHand is false (moving money between spendable
  // accounts, e.g. checking -> savings) — a transfer that pays down a
  // credit card or loan (transferReducesCashOnHand: true) is a real
  // cash outflow this cycle and belongs in the total, same reasoning
  // as computeProjectedClosing in lib/budget/home-stats.ts.
  const oneOffTotal = sumMoney(
    snapshot.oneOff
      .filter(
        (line) => line.kind !== "transfer" || line.transferReducesCashOnHand,
      )
      .map((line) =>
        line.kind === "income" ? line.amount : negateMoney(line.amount),
      ),
  );

  return (
    <div>
      <Hero
        title="Budgets"
        label="Projected balance, this cycle"
        amount={formatMoneyDisplay(projectedClosing, currency)}
        sub={`${formatMoneyDisplay(snapshot.incomeTotal, currency)} in \u2212 ${formatMoneyDisplay(snapshot.fixedExpenseTotal, currency)} fixed \u2212 card/one-off commitments, for ${monthLabel(month)}.`}
      >
        <div className="mt-4 flex items-center gap-2">
          <Link
            href={`/budgets?month=${shiftMonth(month, -1)}`}
            className="flex size-8 items-center justify-center rounded-full bg-white/15 text-sm text-white"
            aria-label="Previous month"
          >
            &#8249;
          </Link>
          <span className="min-w-[130px] text-center font-display text-sm font-bold text-white">
            {monthLabel(month)}
          </span>
          <Link
            href={`/budgets?month=${shiftMonth(month, 1)}`}
            className="flex size-8 items-center justify-center rounded-full bg-white/15 text-sm text-white"
            aria-label="Next month"
          >
            &#8250;
          </Link>
          {!isCurrentMonth && (
            <Link
              href="/budgets"
              className="ml-1 rounded-full bg-white px-3 py-1.5 font-display text-xs font-bold text-[hsl(var(--hero-1))]"
            >
              Today
            </Link>
          )}
        </div>
      </Hero>

      <div className="space-y-4 p-5 sm:p-8">
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
            total={`\u2212${formatMoneyDisplay(snapshot.fixedExpenseTotal, currency)}`}
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
                  &minus;{formatMoneyDisplay(line.amount, line.currencyCode)}
                </p>
              </li>
            ))}
          </SplitCard>
        </div>

        <div className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <div className="flex items-center justify-between px-[18px] py-4">
            <h2 className="font-display text-sm font-bold text-accent">
              Logged this month &middot; card payments &amp; other one-off
            </h2>
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
                  {/* v1.1.4 gave every transfer neutral styling, since
                      none of them counted in the "net" total then.
                      v1.1.5: a transfer that reduces cash on hand (pays
                      down a card/loan) IS counted in the total again —
                      showing that specific one in neutral gray while
                      the total includes it would read just as
                      contradictory as the original v1.1.4 problem it
                      was fixing. Only a transfer between spendable
                      accounts (excluded from the total) stays neutral;
                      a card-payment transfer gets the same red minus as
                      a real expense, since it functions like one here. */}
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
                      {line.kind === "income" ? "+" : "\u2212"}
                      {formatMoneyDisplay(line.amount, line.currencyCode)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-xs text-ink-faint">
          Recurring items only show up here once tagged to this month &mdash;
          nothing appears automatically anymore. Tag templates to a cycle, edit
          amounts, or delete them on{" "}
          <Link href="/recurring" className="underline">
            Recurring
          </Link>
          .
        </p>

        {/* v1.2: this used to be a full copy of CreateRecurringTransactionForm,
            duplicating the exact same form that already lives on /recurring —
            the same inline forms in two places. Replaced with a link to
            the one real place to add a recurring item; the paragraph
            above already sends you there to edit/tag one anyway. */}
        <Link
          href="/recurring"
          className="flex items-center gap-3 rounded-[20px] bg-surface p-5 shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-accent-soft text-accent">
            <Repeat className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[14.5px] font-extrabold text-ink">
              Add income or a fixed expense
            </div>
            <div className="mt-0.5 text-[11.5px] text-ink-faint">
              Salary, rent, subscriptions — set up on Recurring, then tag it to
              a cycle here
            </div>
          </div>
          <span className="shrink-0 font-display text-xs font-bold text-accent">
            Go &rarr;
          </span>
        </Link>
      </div>
    </div>
  );
}
