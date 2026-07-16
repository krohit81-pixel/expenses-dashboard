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
import { getCurrentPhase, getPhaseInfo, type Phase } from "@/lib/dates/phase";
import { computeHomeStats } from "@/lib/budget/home-stats";
import { Hero } from "@/components/ui/hero";
import { HomePhaseView } from "@/features/home/HomePhaseView";

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
 * v0.5.1: replaces the old Dashboard content. Route stays /dashboard
 * (avoids touching middleware/onboarding redirects/nav hrefs for a pure
 * rename) — nav label is "Home" now, matching the product pivot's own
 * language ("the Budget screen becomes the primary dashboard").
 *
 * "Current balances" and its per-account progress bars are carried over
 * unchanged from the old Dashboard — genuinely useful, not part of the
 * phase-aware redesign itself. The old "Upcoming next 3 months" section
 * is gone: superseded by the phase-aware checklist/outlook below, which
 * uses tagged (counted) data instead of a flat list of everything
 * pending in the next 90 days regardless of whether it's tagged to
 * anything.
 */
export default async function HomePage() {
  const user = await requireUser();
  const today = new Date();
  const phaseNow = getCurrentPhase(today);
  const thisMonth = currentMonth();
  const nextMonth = shiftMonth(thisMonth, 1);

  const [accounts, recurring, settings, currentSnapshot, nextSnapshot] =
    await Promise.all([
      listAccounts(),
      listRecurringTransactions(),
      getUserSettings(user.id),
      getMonthlyBudgetSnapshot(thisMonth),
      getMonthlyBudgetSnapshot(nextMonth),
    ]);

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
  const TYPE_ORDER: Record<string, number> = {
    checking: 0,
    savings: 0,
    credit_card: 1,
  };
  const sortedBalances = [...balances].sort(
    (a, b) =>
      (TYPE_ORDER[a.account.accountType] ?? 0) -
      (TYPE_ORDER[b.account.accountType] ?? 0),
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

  const homeStats = computeHomeStats(currentSnapshot);

  // Simple health heuristic: would next month's tagged income cover its
  // tagged commitments? A real "confidence" model (accounting for
  // partial tagging, historical variance, etc.) is future work — this is
  // a first, honest approximation, not a claim of precision.
  const nextOneOffCommitted = sumMoney(
    nextSnapshot.oneOff.filter((l) => l.kind !== "income").map((l) => l.amount),
  );
  const nextCommittedTotal = addMoney(
    nextSnapshot.fixedExpenseTotal,
    nextOneOffCommitted,
  );
  const nextProjectedClosing = addMoney(
    nextSnapshot.incomeTotal,
    negateMoney(nextCommittedTotal),
  );
  const nextHealthy = !isNegativeMoney(nextProjectedClosing);

  const phaseInfos: Record<Phase, ReturnType<typeof getPhaseInfo>> = {
    planning: getPhaseInfo("planning", today),
    execution: getPhaseInfo("execution", today),
    tracking: getPhaseInfo("tracking", today),
  };

  return (
    <div>
      <Hero
        title="Home"
        label="Available cash right now"
        amount={formatMoneyDisplay(
          sumMoney(balances.map((b) => b.balance)),
          currency,
        )}
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
                {formatMoneyDisplay(homeStats.remaining, currency)}
              </div>
            </div>
          </div>
        </div>
      </Hero>

      <HomePhaseView
        currentPhase={phaseNow.phase}
        phaseInfos={phaseInfos}
        currentMonthLabel={monthLabel(thisMonth)}
        nextMonthLabel={monthLabel(nextMonth)}
        currentSnapshot={currentSnapshot}
        nextSnapshot={nextSnapshot}
        nextHealthy={nextHealthy}
        nextProjectedClosing={nextProjectedClosing}
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
              {accounts.length} account{accounts.length === 1 ? "" : "s"}
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
