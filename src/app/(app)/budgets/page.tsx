import Link from "next/link";
import type { Metadata } from "next";

import { getMonthlyBudgetSnapshot } from "@/services/BudgetSnapshotService";
import { listAccounts } from "@/services/AccountService";
import { listCategories } from "@/services/CategoryService";
import { getUserSettings } from "@/services/UserSettingsService";
import { requireUser } from "@/lib/auth/require-user";
import {
  addMoney,
  formatMoneyDisplay,
  negateMoney,
  sumMoney,
} from "@/lib/money";
import {
  currentMonth,
  isValidMonth,
  monthLabel,
  shiftMonth,
} from "@/lib/dates/month";
import { Hero } from "@/components/ui/hero";
import { transactionDisplayTitle } from "@/features/transactions/format";
import { CreateRecurringTransactionForm } from "@/features/recurring/components/CreateRecurringTransactionForm";

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
  const [snapshot, accounts, categories, settings] = await Promise.all([
    getMonthlyBudgetSnapshot(month),
    listAccounts(),
    listCategories(true),
    getUserSettings(user.id),
  ]);

  const accountName = new Map(
    accounts.map((account) => [account.id, account.name]),
  );
  const currency = settings?.baseCurrency ?? "USD";
  const fixedNet = addMoney(
    snapshot.incomeTotal,
    negateMoney(snapshot.fixedExpenseTotal),
  );

  const oneOffTotal = sumMoney(
    snapshot.oneOff.map((line) =>
      line.kind === "income" ? line.amount : negateMoney(line.amount),
    ),
  );

  return (
    <div>
      <Hero
        title="Budgets"
        label="Fixed net, monthly"
        amount={formatMoneyDisplay(fixedNet, currency)}
        sub={`${formatMoneyDisplay(snapshot.incomeTotal, currency)} in \u2212 ${formatMoneyDisplay(snapshot.fixedExpenseTotal, currency)} fixed out, for ${monthLabel(month)}.`}
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
          <div className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
            <div className="flex items-center justify-between px-[18px] py-4">
              <h2 className="font-display text-sm font-bold text-positive">
                Income &amp; receivables
              </h2>
              <span className="font-display text-xs font-bold text-ink-faint">
                +{formatMoneyDisplay(snapshot.incomeTotal, currency)}
              </span>
            </div>
            {snapshot.income.length === 0 ? (
              <p className="px-[18px] pb-4 text-sm text-ink-faint">
                None this month.
              </p>
            ) : (
              <ul>
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
                        <p className="text-[11px] text-ink-faint">
                          Not yet paid
                        </p>
                      )}
                    </div>
                    <p className="whitespace-nowrap font-display text-sm font-bold text-positive">
                      +{formatMoneyDisplay(line.amount, line.currencyCode)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
            <div className="flex items-center justify-between px-[18px] py-4">
              <h2 className="font-display text-sm font-bold text-negative">
                Fixed expenses
              </h2>
              <span className="font-display text-xs font-bold text-ink-faint">
                &minus;
                {formatMoneyDisplay(snapshot.fixedExpenseTotal, currency)}
              </span>
            </div>
            {snapshot.fixedExpenses.length === 0 ? (
              <p className="px-[18px] pb-4 text-sm text-ink-faint">
                None this month.
              </p>
            ) : (
              <ul>
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
                        <p className="text-[11px] text-ink-faint">
                          Not yet paid
                        </p>
                      )}
                    </div>
                    <p className="whitespace-nowrap font-display text-sm font-bold text-negative">
                      &minus;
                      {formatMoneyDisplay(line.amount, line.currencyCode)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
                  <p
                    className={`whitespace-nowrap font-display text-sm font-bold ${
                      line.kind === "income" ? "text-positive" : "text-negative"
                    }`}
                  >
                    {line.kind === "income" ? "+" : "\u2212"}
                    {formatMoneyDisplay(line.amount, line.currencyCode)}
                  </p>
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

        <div className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <h2 className="mb-4 font-display text-[15px] font-bold text-ink">
            Add income or fixed expense
          </h2>
          {accounts.length === 0 ? (
            <p className="text-sm text-ink-faint">Add an account first.</p>
          ) : (
            <CreateRecurringTransactionForm
              accounts={accounts}
              categories={categories}
              defaultCurrency={currency}
            />
          )}
        </div>
      </div>
    </div>
  );
}
