import type { Metadata } from "next";

import { listRecurringTransactions } from "@/services/RecurringTransactionService";
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
import { Hero } from "@/components/ui/hero";
import { RecurringLineItem } from "@/features/recurring/components/RecurringLineItem";
import { CreateRecurringTransactionForm } from "@/features/recurring/components/CreateRecurringTransactionForm";

export const metadata: Metadata = {
  title: "Budgets",
};

/**
 * This page replaced an earlier "budgets" feature (period + category
 * planned-vs-actual tracking). That code (BudgetService,
 * features/budgets/*) has been removed — recoverable from git history if
 * ever needed again. The budgets/budget_lines DB tables are untouched
 * (dropping them needs a migration and isn't urgent) but nothing in the
 * app queries them anymore. What's here instead: the standing monthly
 * plan — every recurring income and fixed-expense template, editable in
 * place. Card payments deliberately don't appear here — they vary every
 * cycle and live in Transactions instead.
 */
export default async function BudgetsPage() {
  const user = await requireUser();
  const [recurring, accounts, categories, settings] = await Promise.all([
    listRecurringTransactions(),
    listAccounts(),
    listCategories(true),
    getUserSettings(user.id),
  ]);

  const currency = settings?.baseCurrency ?? "USD";
  const income = recurring.filter((r) => r.kind === "income");
  const expenses = recurring.filter((r) => r.kind === "expense");

  const incomeTotal = sumMoney(income.map((r) => r.amount));
  const expenseTotal = sumMoney(expenses.map((r) => r.amount));
  const fixedNet = addMoney(incomeTotal, negateMoney(expenseTotal));

  return (
    <div>
      <Hero
        title="Budgets"
        label="Fixed net, monthly"
        amount={formatMoneyDisplay(fixedNet, currency)}
        sub={`${formatMoneyDisplay(incomeTotal, currency)} in \u2212 ${formatMoneyDisplay(expenseTotal, currency)} fixed out. Card payments not included \u2014 those vary.`}
      />

      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:p-8">
        <div className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <div className="flex items-center justify-between px-[18px] py-4">
            <h2 className="font-display text-sm font-bold text-positive">
              Income &amp; receivables
            </h2>
            <span className="font-display text-xs font-bold text-ink-faint">
              +{formatMoneyDisplay(incomeTotal, currency)}
            </span>
          </div>
          {income.length === 0 ? (
            <p className="px-[18px] pb-4 text-sm text-ink-faint">None yet.</p>
          ) : (
            <ul>
              {income.map((r) => (
                <RecurringLineItem
                  key={r.id}
                  id={r.id}
                  name={r.payee ?? "Untitled"}
                  amount={r.amount}
                  currencyCode={r.currencyCode}
                  nextOccurrenceOn={r.nextOccurrenceOn}
                  direction="in"
                />
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
              &minus;{formatMoneyDisplay(expenseTotal, currency)}
            </span>
          </div>
          {expenses.length === 0 ? (
            <p className="px-[18px] pb-4 text-sm text-ink-faint">None yet.</p>
          ) : (
            <ul>
              {expenses.map((r) => (
                <RecurringLineItem
                  key={r.id}
                  id={r.id}
                  name={r.payee ?? "Untitled"}
                  amount={r.amount}
                  currencyCode={r.currencyCode}
                  nextOccurrenceOn={r.nextOccurrenceOn}
                  direction="out"
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="p-5 pt-0 sm:p-8 sm:pt-0">
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
