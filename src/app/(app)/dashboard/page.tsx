import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/require-user";
import { listAccounts, getAccountBalance } from "@/services/AccountService";
import { listRecurringTransactions } from "@/services/RecurringTransactionService";
import { getUserSettings } from "@/services/UserSettingsService";
import { getMonthlyBudgetSnapshot } from "@/services/BudgetSnapshotService";
import {
  addMoney,
  formatMoneyDisplay,
  isNegativeMoney,
  moneyToDbNumber,
  negateMoney,
  sumMoney,
  ZERO,
  type Money,
} from "@/lib/money";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/dates/month";
import { computeHomeStats } from "@/lib/budget/home-stats";
import { Hero } from "@/components/ui/hero";
import { HomePhaseView, type MonthOption } from "@/features/home/HomePhaseView";

export const metadata: Metadata = {
  title: "Home",
};

function ordinalSuffix(day: number | null | undefined): string {
  if (!day) return "";
  if (day % 10 === 1 && day !== 11) return "st";
  if (day % 10 === 2 && day !== 12) return "nd";
  if (day % 10 === 3 && day !== 13) return "rd";
  return "th";
}

/**
 * v0.5.1: replaces the old Dashboard content. v0.5.3: adds the cycle
 * dropdown — the user picks a month, and the checklist/outlook below
 * refresh to that month's own tagged data, with the phase tabs
 * auto-defaulting per month (see lib/dates/phase.ts's
 * defaultPhaseForMonth) while still browsable within whatever that
 * month allows (see phaseAvailability — past=Tracking only,
 * future=Planning only, current=all three).
 *
 * Fetches a 10-month window (6 back, current, 3 ahead) in parallel up
 * front rather than fetching on-demand when the dropdown changes —
 * avoids a server round-trip per selection, and the data volumes here
 * (a handful of recurring items + one-offs per month) are small enough
 * that fetching 6 months costs little over fetching 2.
 */
export default async function HomePage() {
  const user = await requireUser();
  const thisMonth = currentMonth();
  const monthWindow = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3].map((offset) =>
    shiftMonth(thisMonth, offset),
  );

  const [accounts, recurring, settings, ...snapshots] = await Promise.all([
    listAccounts(),
    listRecurringTransactions(),
    getUserSettings(user.id),
    ...monthWindow.map((m) => getMonthlyBudgetSnapshot(m)),
  ]);

  const months: MonthOption[] = monthWindow.map((month, i) => ({
    month,
    label: monthLabel(month),
    snapshot: snapshots[i]!,
    isCurrentRealMonth: month === thisMonth,
  }));

  const accountName = new Map(
    accounts.map((account) => [account.id, account.name]),
  );
  const currency = settings?.baseCurrency ?? "USD";

  const balances = await Promise.all(
    accounts.map(async (account) => ({
      account,
      balance: await getAccountBalance(account.id),
    })),
  );

  // Savings/checking first, credit cards after — matches how the person
  // actually thinks about these (money you have, then what you owe).
  // Credit cards excluded here on purpose — this section is about money
  // you have, not what you owe; card balances/due dates live on
  // Transactions and Accounts instead.
  const sortedBalances = balances.filter(
    ({ account }) =>
      account.accountType === "checking" || account.accountType === "savings",
  );

  // Expected monthly credit per checking/savings account, from matching
  // recurring income templates — drives the "remaining" progress bar.
  const expectedCreditByAccount = new Map<string, Money>();
  for (const template of recurring) {
    if (template.kind === "income") {
      expectedCreditByAccount.set(
        template.accountId,
        addMoney(
          expectedCreditByAccount.get(template.accountId) ?? ZERO,
          template.amount,
        ),
      );
    }
  }

  // Hero's stat row is always about the real current month specifically
  // — it's the one number that shouldn't shift depending on which cycle
  // you're browsing in the dropdown below.
  const currentSnapshot = months.find((m) => m.isCurrentRealMonth)!.snapshot;
  const homeStats = computeHomeStats(currentSnapshot);
  const availableCash = sumMoney(balances.map((b) => b.balance));
  // "Remaining" means "what you'll actually have left," not "how much
  // of what's committed hasn't been paid yet" (that's homeStats.remaining
  // itself — the unpaid portion). Real report: cash 6,000 minus 5,000
  // still-unpaid committed should read as a projected 1,000 left, not
  // just restate the 5,000 that's unpaid.
  const projectedRemaining = addMoney(
    availableCash,
    negateMoney(homeStats.remaining),
  );

  return (
    <div>
      <Hero
        title="Home"
        label="Available cash right now"
        amount={formatMoneyDisplay(availableCash, currency)}
      >
        <div className="mt-4">
          <div className="font-display text-[10px] font-bold uppercase tracking-wide text-white/45">
            This month &middot; {monthLabel(thisMonth)}
          </div>
          <div className="mt-1.5 grid grid-cols-4 gap-2">
            <div className="rounded-xl bg-white/10 px-2 py-2">
              <div className="text-[9.5px] uppercase text-white/55">
                Expected
              </div>
              <div className="mt-0.5 font-display text-[13px] font-extrabold">
                {formatMoneyDisplay(homeStats.expected, currency)}
              </div>
            </div>
            <div className="rounded-xl bg-white/10 px-2 py-2">
              <div className="text-[9.5px] uppercase text-white/55">
                Committed
              </div>
              <div className="mt-0.5 font-display text-[13px] font-extrabold">
                {formatMoneyDisplay(homeStats.committed, currency)}
              </div>
            </div>
            <div className="rounded-xl bg-white/10 px-2 py-2">
              <div className="text-[9.5px] uppercase text-white/55">Paid</div>
              <div className="mt-0.5 font-display text-[13px] font-extrabold">
                {formatMoneyDisplay(homeStats.paid, currency)}
              </div>
            </div>
            <div className="rounded-xl bg-white/10 px-2 py-2">
              <div className="text-[9.5px] uppercase text-white/55">
                Remaining
              </div>
              <div className="mt-0.5 font-display text-[13px] font-extrabold">
                {formatMoneyDisplay(projectedRemaining, currency)}
              </div>
            </div>
          </div>
        </div>
      </Hero>

      <HomePhaseView
        months={months}
        initialMonth={thisMonth}
        accountName={accountName}
        currency={currency}
      />

      <div className="px-5 pb-2 sm:px-8">
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-[15px] font-bold text-ink">
              Accounts
            </h2>
            <span className="text-xs text-ink-faint">
              {sortedBalances.length} account
              {sortedBalances.length === 1 ? "" : "s"}
            </span>
          </div>

          {sortedBalances.length === 0 ? (
            <p className="text-sm text-ink-faint">
              No accounts yet —{" "}
              <a href="/accounts" className="underline">
                add one
              </a>
              .
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(168px,1fr))] sm:overflow-visible">
              {sortedBalances.map(({ account, balance }) => {
                const expected = expectedCreditByAccount.get(account.id);
                const showBar =
                  expected &&
                  moneyToDbNumber(expected) > 0 &&
                  (account.accountType === "checking" ||
                    account.accountType === "savings");
                const pct = showBar
                  ? Math.max(
                      0,
                      Math.min(
                        100,
                        Math.round(
                          (moneyToDbNumber(balance) /
                            moneyToDbNumber(expected)) *
                            100,
                        ),
                      ),
                    )
                  : null;

                return (
                  <div
                    key={account.id}
                    className="w-[168px] shrink-0 rounded-2xl bg-surface p-4 shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)] sm:w-auto"
                  >
                    <div className="truncate text-xs font-semibold text-ink-soft">
                      {account.name}
                    </div>
                    <div className="mt-0.5 text-[10px] text-ink-faint">
                      {account.creditCard
                        ? `Due by the ${account.creditCard.paymentDueDay ?? "?"}${ordinalSuffix(account.creditCard.paymentDueDay)}`
                        : account.accountType[0].toUpperCase() +
                          account.accountType.slice(1)}
                    </div>
                    <div
                      className={`mt-3 font-display text-[19px] font-extrabold tracking-tight ${isNegativeMoney(balance) ? "text-negative" : "text-ink"}`}
                    >
                      {formatMoneyDisplay(balance, account.currencyCode)}
                    </div>
                    {pct !== null && (
                      <>
                        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line">
                          <div
                            className="h-full rounded-full bg-positive"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="mt-1.5 text-[10px] font-medium text-ink-faint">
                          {pct}% of{" "}
                          {formatMoneyDisplay(
                            expected as Money,
                            account.currencyCode,
                          )}{" "}
                          left
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
