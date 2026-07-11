import Link from "next/link";
import type { Metadata } from "next";

import { listRecurringTransactions } from "@/services/RecurringTransactionService";
import { listAccounts } from "@/services/AccountService";
import { listCategories } from "@/services/CategoryService";
import { getUserSettings } from "@/services/UserSettingsService";
import { requireUser } from "@/lib/auth/require-user";
import { formatMoneyDisplay } from "@/lib/money";
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Recurring transactions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Templates for bills, salary, and other repeating transactions.
          </p>
        </div>
      </div>

      <GenerateDueTransactionsButton />

      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No recurring transactions yet.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {templates.map((template) => (
            <li
              key={template.id}
              className="flex items-center justify-between p-4"
            >
              <div>
                <p className="font-medium">
                  {template.payee ||
                    (template.categoryId
                      ? categoryName.get(template.categoryId)
                      : `Transfer to ${accountName.get(template.transferAccountId ?? "") ?? "another account"}`)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {accountName.get(template.accountId)} &middot;{" "}
                  {formatFrequency(template.frequency, template.intervalCount)}{" "}
                  &middot; next {template.nextOccurrenceOn}
                </p>
              </div>
              <p className="font-medium tabular-nums">
                {formatMoneyDisplay(template.amount, template.currencyCode)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-4 border-t pt-6">
        <h2 className="text-sm font-medium">Add a recurring transaction</h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
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
  );
}
