import Link from "next/link";
import type { Metadata } from "next";

import { listRecurringTransactions } from "@/services/RecurringTransactionService";
import { listAccounts } from "@/services/AccountService";
import { listCategories } from "@/services/CategoryService";
import { getUserSettings } from "@/services/UserSettingsService";
import { requireUser } from "@/lib/auth/require-user";
import { formatMoneyDisplay } from "@/lib/money";
import { Hero } from "@/components/ui/hero";
import { CreateRecurringTransactionForm } from "@/features/recurring/components/CreateRecurringTransactionForm";
import { GenerateDueTransactionsButton } from "@/features/recurring/components/GenerateDueTransactionsButton";

export const metadata: Metadata = {
  title: "Recurring transactions",
};

const FREQUENCY_UNIT: Record<string, string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  quarterly: "quarter",
  yearly: "year",
};

function formatFrequency(frequency: string, intervalCount: number): string {
  const unit = FREQUENCY_UNIT[frequency] ?? frequency;
  if (intervalCount === 1) {
    return `every ${unit}`;
  }
  return `every ${intervalCount} ${unit}s`;
}

export default async function RecurringPage() {
  const user = await requireUser();
  const [templates, accounts, categories, settings] = await Promise.all([
    listRecurringTransactions(),
    listAccounts(),
    listCategories(true),
    getUserSettings(user.id),
  ]);

  const accountName = new Map(
    accounts.map((account) => [account.id, account.name]),
  );
  const categoryName = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  const defaultCurrency = settings?.baseCurrency ?? "USD";

  return (
    <div>
      <Hero
        title="Recurring"
        sub="The full list behind Budgets — including transfers."
      />

      <div className="space-y-8 p-5 sm:p-8">
        <GenerateDueTransactionsButton />

        <section>
          <h2 className="mb-3 font-display text-[15px] font-bold text-ink">
            All templates
          </h2>
          {templates.length === 0 ? (
            <p className="text-sm text-ink-faint">
              No recurring transactions yet.
            </p>
          ) : (
            <ul className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
              {templates.map((template) => (
                <li
                  key={template.id}
                  className="flex items-center justify-between gap-3 border-b border-line px-[18px] py-3.5 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {template.payee ||
                        (template.categoryId
                          ? categoryName.get(template.categoryId)
                          : `Transfer to ${accountName.get(template.transferAccountId ?? "") ?? "another account"}`)}
                    </p>
                    <p className="text-xs text-ink-faint">
                      {accountName.get(template.accountId)} &middot;{" "}
                      {formatFrequency(
                        template.frequency,
                        template.intervalCount,
                      )}{" "}
                      &middot; next {template.nextOccurrenceOn}
                    </p>
                  </div>
                  <p className="whitespace-nowrap font-display text-[15px] font-bold text-ink">
                    {formatMoneyDisplay(template.amount, template.currencyCode)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <h2 className="mb-4 font-display text-[15px] font-bold text-ink">
            Add a recurring transaction
          </h2>
          {accounts.length === 0 ? (
            <p className="text-sm text-ink-faint">
              <Link href="/accounts" className="underline">
                Add an account
              </Link>{" "}
              first.
            </p>
          ) : (
            <CreateRecurringTransactionForm
              accounts={accounts}
              categories={categories}
              defaultCurrency={defaultCurrency}
            />
          )}
        </section>
      </div>
    </div>
  );
}
