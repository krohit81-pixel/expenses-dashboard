import Link from "next/link";
import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/require-user";
import { listAccounts } from "@/services/AccountService";
import { getUserSettings } from "@/services/UserSettingsService";
import { getMonthlyBudgetSnapshot } from "@/services/BudgetSnapshotService";
import {
  addMoney,
  formatMoneyDisplay,
  isNegativeMoney,
  moneyToDbNumber,
  negateMoney,
  sumMoney,
  type Money,
} from "@/lib/money";
import { computeCommittedExpenseTotal } from "@/lib/budget/home-stats";
import {
  currentCycleMonth,
  isValidMonth,
  monthLabel,
  shiftMonth,
} from "@/lib/dates/month";
import { Hero } from "@/components/ui/hero";
import { transactionDisplayTitle } from "@/features/transactions/format";

export const metadata: Metadata = {
  title: "Home",
};

interface OutlookLine {
  id: string;
  title: string;
  amount: Money;
  currencyCode: string;
}

const MAX_ROWS = 6;

function sortDescending(lines: OutlookLine[]): OutlookLine[] {
  return [...lines].sort(
    (a, b) => moneyToDbNumber(b.amount) - moneyToDbNumber(a.amount),
  );
}

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

function OutlookList({
  title,
  hint,
  lines,
  currency,
  emptyLabel,
  amountTone,
}: {
  title: string;
  hint: string;
  lines: OutlookLine[];
  currency: string;
  emptyLabel: string;
  amountTone: "positive" | "negative";
}) {
  const shown = lines.slice(0, MAX_ROWS);
  const remaining = lines.length - shown.length;

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-[15px] font-bold text-ink">{title}</h2>
        <span className="text-xs text-ink-faint">{hint}</span>
      </div>

      {lines.length === 0 ? (
        <div className="rounded-[20px] bg-surface p-4 shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <p className="text-sm text-ink-faint">{emptyLabel}</p>
        </div>
      ) : (
        <div className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          {shown.map((line) => (
            <div
              key={line.id}
              className="flex items-center justify-between gap-3 border-b border-line px-[18px] py-3.5 last:border-b-0"
            >
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                {line.title}
              </p>
              <p
                className={`whitespace-nowrap font-display text-sm font-bold ${
                  amountTone === "positive" ? "text-positive" : "text-negative"
                }`}
              >
                {amountTone === "positive" ? "+" : "−"}
                {formatMoneyDisplay(line.amount, line.currencyCode || currency)}
              </p>
            </div>
          ))}
          {remaining > 0 && (
            <div className="px-[18px] py-2.5 text-xs text-ink-faint">
              +{remaining} more on{" "}
              <Link
                href="/budgets"
                className="font-semibold text-accent underline"
              >
                Budgets
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * v2.0.0: total Home rewrite, replacing HomePhaseView's three-phase
 * Planning/Execution/Tracking view entirely (deleted, along with
 * lib/dates/phase.ts and features/home/ChecklistItem.tsx). At the
 * household's request, Atlas is moving away from being an
 * execution/transaction-tracking app (log it, mark it paid, confirm
 * it happened) toward a reporting/intel-first one: you key in what a
 * cycle is expected to look like — via Recurring templates tagged to
 * that cycle_month, exactly as before — and Home just reports how
 * that cycle is shaping up. There is no more "mark as paid/received"
 * step on Home; whatever is tagged to a cycle is assumed to happen.
 * Actually editing/tagging still happens on Recurring/Budgets (kept
 * exactly as they were) — Home only renders a condensed read of the
 * same getMonthlyBudgetSnapshot data Budgets already shows, capped to
 * the largest lines, with a link out to Budgets for the full list.
 *
 * The Accounts strip (cash balances) that used to sit at the bottom
 * of Home is gone too, at the household's explicit request — real
 * balances routinely drift from what's tagged/expected here, and
 * showing both side by side read as if they should reconcile when
 * they don't. Balances still live on /accounts.
 *
 * The Transactions tab (logging, marking paid, ad-hoc entries) is
 * also retired as of v2.0 — nothing here links to "log a payment"
 * anymore. It's still reachable, read-only, from More.
 */
export default async function HomePage({
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
    // Only used to label one-off transfers ("Credit card dues" instead
    // of "Transfer to another account") — not for balances, which no
    // longer appear on Home at all.
    listAccounts(),
    getUserSettings(user.id),
  ]);

  const currency = settings?.baseCurrency ?? "USD";
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));

  const oneOffIncome = snapshot.oneOff.filter((l) => l.kind === "income");
  const oneOffCommitted = snapshot.oneOff.filter(
    (l) =>
      l.kind === "expense" ||
      (l.kind === "transfer" && l.transferReducesCashOnHand),
  );

  const incomeLines = sortDescending([
    ...snapshot.income.map((l) => ({
      id: l.id,
      title: l.name,
      amount: l.amount,
      currencyCode: l.currencyCode,
    })),
    ...oneOffIncome.map((l) => ({
      id: l.id,
      title: transactionDisplayTitle(l, accountName),
      amount: l.amount,
      currencyCode: l.currencyCode,
    })),
  ]);

  const expenseLines = sortDescending([
    ...snapshot.fixedExpenses.map((l) => ({
      id: l.id,
      title: l.name,
      amount: l.amount,
      currencyCode: l.currencyCode,
    })),
    ...oneOffCommitted.map((l) => ({
      id: l.id,
      title: transactionDisplayTitle(l, accountName),
      amount: l.amount,
      currencyCode: l.currencyCode,
    })),
  ]);

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
        title="Home"
        label={`Projected net for ${monthLabel(month)}`}
        amount={netDisplay}
        sub={`${formatMoneyDisplay(totalIncome, currency)} expected in − ${formatMoneyDisplay(totalExpense, currency)} expected out`}
      >
        <div className="mt-4 flex items-center gap-2">
          <Link
            href={`/dashboard?month=${shiftMonth(month, -1)}`}
            className="flex size-8 items-center justify-center rounded-full bg-white/15 text-sm text-white"
            aria-label="Previous cycle"
          >
            &#8249;
          </Link>
          <span className="min-w-[150px] text-center font-display text-sm font-bold text-white">
            {monthLabel(month)} cycle
          </span>
          <Link
            href={`/dashboard?month=${shiftMonth(month, 1)}`}
            className="flex size-8 items-center justify-center rounded-full bg-white/15 text-sm text-white"
            aria-label="Next cycle"
          >
            &#8250;
          </Link>
          {!isCurrentMonth && (
            <Link
              href="/dashboard"
              className="ml-1 rounded-full bg-white px-3 py-1.5 font-display text-xs font-bold text-[hsl(var(--hero-1))]"
            >
              Today
            </Link>
          )}
        </div>
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

        <OutlookList
          title="Major expenses this month"
          hint={`${expenseLines.length} keyed in`}
          lines={expenseLines}
          currency={currency}
          amountTone="negative"
          emptyLabel={
            "Nothing tagged to this cycle yet — tag a recurring template on Recurring, or add one on Budgets."
          }
        />

        <OutlookList
          title="Income expected"
          hint={`${incomeLines.length} keyed in`}
          lines={incomeLines}
          currency={currency}
          amountTone="positive"
          emptyLabel={
            "No income tagged to this cycle yet — tag a recurring template on Recurring, or add one on Budgets."
          }
        />

        <Link
          href={`/budgets?month=${month}`}
          className="flex items-center justify-between rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]"
        >
          <div>
            <div className="font-display text-[14.5px] font-extrabold text-ink">
              Key in or edit this cycle
            </div>
            <div className="mt-0.5 text-[11.5px] text-ink-faint">
              Full editable breakdown lives on Budgets
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
