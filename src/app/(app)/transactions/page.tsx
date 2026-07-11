import Link from "next/link";
import type { Metadata } from "next";

import { listTransactions } from "@/services/TransactionService";
import { listAccounts } from "@/services/AccountService";
import { listCategories } from "@/services/CategoryService";
import { getUserSettings } from "@/services/UserSettingsService";
import { requireUser } from "@/lib/auth/require-user";
import { formatMoneyDisplay } from "@/lib/money";
import { CreateTransactionForm } from "@/features/transactions/components/CreateTransactionForm";

export const metadata: Metadata = {
  title: "Transactions",
};

interface TransactionsPageProps {
  searchParams: Promise<{
    account?: string;
    kind?: string;
    search?: string;
    from?: string;
    to?: string;
  }>;
}

const KIND_VALUES = ["income", "expense", "transfer"] as const;

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  const params = await searchParams;
  const user = await requireUser();

  const kind = KIND_VALUES.find((value) => value === params.kind);

  const [accounts, categories, settings, { transactions, total }] =
    await Promise.all([
      listAccounts(),
      listCategories(true),
      getUserSettings(user.id),
      listTransactions({
        accountId: params.account || undefined,
        kind,
        search: params.search || undefined,
        occurredFrom: params.from || undefined,
        occurredTo: params.to || undefined,
      }),
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
      <div>
        <h1 className="text-xl font-semibold">Transactions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} transaction{total === 1 ? "" : "s"}
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="account" className="text-sm font-medium">
            Account
          </label>
          <select
            id="account"
            name="account"
            defaultValue={params.account ?? ""}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="kind" className="text-sm font-medium">
            Type
          </label>
          <select
            id="kind"
            name="kind"
            defaultValue={params.kind ?? ""}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All types</option>
            {KIND_VALUES.map((value) => (
              <option key={value} value={value}>
                {value[0].toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="search" className="text-sm font-medium">
            Search
          </label>
          <input
            id="search"
            name="search"
            defaultValue={params.search ?? ""}
            placeholder="Payee or memo"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="from" className="text-sm font-medium">
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={params.from ?? ""}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="to" className="text-sm font-medium">
            To
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={params.to ?? ""}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <button
          type="submit"
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Filter
        </button>
      </form>

      {transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No transactions match these filters.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {transactions.map((transaction) => (
            <li
              key={transaction.id}
              className="flex items-center justify-between p-4"
            >
              <div>
                <p className="font-medium">
                  {transaction.payee ||
                    (transaction.kind === "transfer"
                      ? `Transfer to ${accountName.get(transaction.transferAccountId ?? "") ?? "another account"}`
                      : "Untitled")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {transaction.occurredOn} &middot;{" "}
                  {accountName.get(transaction.accountId)}
                  {transaction.splits.length > 0 &&
                    ` \u00b7 ${transaction.splits
                      .map(
                        (split) =>
                          categoryName.get(split.categoryId) ?? "Uncategorized",
                      )
                      .join(", ")}`}
                </p>
              </div>
              <p
                className={
                  "font-medium tabular-nums " +
                  (transaction.kind === "income" ? "text-emerald-600" : "")
                }
              >
                {transaction.kind === "expense" ? "-" : ""}
                {formatMoneyDisplay(
                  transaction.amount,
                  transaction.currencyCode,
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-4 border-t pt-6">
        <h2 className="text-sm font-medium">Add a transaction</h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            <Link href="/accounts" className="underline">
              Add an account
            </Link>{" "}
            first before recording transactions.
          </p>
        ) : (
          <CreateTransactionForm
            accounts={accounts}
            categories={categories}
            defaultCurrency={defaultCurrency}
          />
        )}
      </section>
    </div>
  );
}
