import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/require-user";
import { listAccounts, getAccountBalance } from "@/services/AccountService";
import { listRecurringTransactions } from "@/services/RecurringTransactionService";
import { listTransactions } from "@/services/TransactionService";
import { getUserSettings } from "@/services/UserSettingsService";
import {
  addMoney,
  formatMoneyDisplay,
  isNegativeMoney,
  moneyToDbNumber,
  sumMoney,
  ZERO,
  type Money,
} from "@/lib/money";
import { Hero } from "@/components/ui/hero";

export const metadata: Metadata = {
  title: "Dashboard",
};

function monthLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function DashboardPage() {
  const user = await requireUser();
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const in90Days = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [accounts, recurring, settings, upcoming] = await Promise.all([
    listAccounts(),
    listRecurringTransactions(),
    getUserSettings(user.id),
    listTransactions({
      status: "pending",
      occurredFrom: todayIso,
      occurredTo: in90Days,
      limit: 100,
    }),
  ]);

  const currency = settings?.baseCurrency ?? "USD";

  const balances = await Promise.all(
    accounts.map(async (account) => ({
      account,
      balance: await getAccountBalance(account.id),
    })),
  );

  const netAcrossAccounts = sumMoney(balances.map((b) => b.balance));

  // Expected monthly credit per checking/savings account, from matching
  // recurring income templates — drives the "remaining" progress bar.
  // Accounts with no matching income template (or non-checking types)
  // just show a plain balance, no bar.
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

  const upcomingByMonth = new Map<string, typeof upcoming.transactions>();
  for (const transaction of upcoming.transactions) {
    const key = transaction.occurredOn.slice(0, 7);
    upcomingByMonth.set(key, [
      ...(upcomingByMonth.get(key) ?? []),
      transaction,
    ]);
  }
  const upcomingMonths = Array.from(upcomingByMonth.keys()).sort();
  const upcomingTotal = sumMoney(upcoming.transactions.map((t) => t.amount));

  return (
    <div>
      <Hero
        title="Atlas"
        label="Net across all accounts"
        amount={formatMoneyDisplay(netAcrossAccounts, currency)}
        sub={new Date().toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })}
      />

      <div className="space-y-8 p-5 sm:p-8">
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-[15px] font-bold text-ink">
              Current balances
            </h2>
            <span className="text-xs text-ink-faint">
              {accounts.length} account{accounts.length === 1 ? "" : "s"}
            </span>
          </div>

          {balances.length === 0 ? (
            <p className="text-sm text-ink-faint">
              No accounts yet —{" "}
              <a href="/accounts" className="underline">
                add one
              </a>
              .
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(168px,1fr))] sm:overflow-visible">
              {balances.map(({ account, balance }) => {
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

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-[15px] font-bold text-ink">
              Upcoming · next 3 months
            </h2>
            <span className="text-xs text-ink-faint">
              {formatMoneyDisplay(upcomingTotal, currency)} total
            </span>
          </div>

          <div className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
            {upcomingMonths.length === 0 ? (
              <p className="p-4 text-sm text-ink-faint">
                Nothing scheduled yet.
              </p>
            ) : (
              upcomingMonths.map((month) => (
                <div key={month}>
                  <div className="px-[18px] pb-1 pt-3.5 font-display text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                    {monthLabel(`${month}-01`)}
                  </div>
                  <ul>
                    {(upcomingByMonth.get(month) ?? []).map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between gap-3 border-b border-line px-[18px] py-3.5 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-ink">
                            {t.payee || "Untitled"}
                          </div>
                          <div className="text-xs text-ink-faint">One-time</div>
                        </div>
                        <div className="whitespace-nowrap font-display text-[15px] font-bold text-negative">
                          &minus;{formatMoneyDisplay(t.amount, t.currencyCode)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ordinalSuffix(day: number | null | undefined): string {
  if (!day) return "";
  if (day % 10 === 1 && day !== 11) return "st";
  if (day % 10 === 2 && day !== 12) return "nd";
  if (day % 10 === 3 && day !== 13) return "rd";
  return "th";
}
