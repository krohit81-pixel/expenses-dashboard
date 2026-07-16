import Link from "next/link";
import type { Metadata } from "next";

import { listTransactions } from "@/services/TransactionService";
import { listAccounts } from "@/services/AccountService";
import { listCategories } from "@/services/CategoryService";
import { getUserSettings } from "@/services/UserSettingsService";
import { requireUser } from "@/lib/auth/require-user";
import { monthOptions } from "@/lib/dates/month";
import { Hero } from "@/components/ui/hero";
import { CreateTransactionForm } from "@/features/transactions/components/CreateTransactionForm";
import { CardPaymentQuickLog } from "@/features/transactions/components/CardPaymentQuickLog";
import { TransactionRow } from "@/features/transactions/components/TransactionRow";

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

  // Matches CardPaymentQuickLog's own CYCLE_WINDOW exactly — last month
  // through 3 months ahead, so its cycle selector has real data for
  // every option it offers.
  const cardCycleWindow = monthOptions(5, -1).map((m) => m.value);

  const [
    accounts,
    categories,
    settings,
    { transactions, total },
    ...cycleTransfers
  ] = await Promise.all([
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
    ...cardCycleWindow.map((cycleMonth) =>
      listTransactions({ kind: "transfer", cycleMonth, limit: 200 }),
    ),
  ]);

  const accountName = new Map(
    accounts.map((account) => [account.id, account.name]),
  );
  const categoryName = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  const defaultCurrency = settings?.baseCurrency ?? "USD";

  const cardAccounts = accounts.filter((a) => a.accountType === "credit_card");
  const checkingAccounts = accounts.filter(
    (a) => a.accountType === "checking" || a.accountType === "savings",
  );
  const loggedCardAccountIdsByCycle: Record<
    string,
    Set<string>
  > = Object.fromEntries(
    cardCycleWindow.map((cycleMonth, i) => [
      cycleMonth,
      new Set(
        cycleTransfers[i]!.transactions.map((t) => t.transferAccountId).filter(
          (id): id is string => id !== null,
        ),
      ),
    ]),
  );

  return (
    <div>
      <Hero
        title="Transactions"
        sub="Log a payment, add income, or record a transfer."
      />

      <div className="space-y-6 p-5 sm:p-8">
        <CardPaymentQuickLog
          cardAccounts={cardAccounts}
          checkingAccounts={checkingAccounts}
          loggedCardAccountIdsByCycle={loggedCardAccountIdsByCycle}
          defaultCurrency={defaultCurrency}
        />

        <div className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <h2 className="mb-3 font-display text-[15px] font-bold text-ink">
            Filter
          </h2>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="account"
                className="text-xs font-semibold text-ink-faint"
              >
                Account
              </label>
              <select
                id="account"
                name="account"
                defaultValue={params.account ?? ""}
                className="h-10 rounded-xl border-[1.5px] border-line bg-surface px-3 text-sm"
              >
                <option value="">All accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="kind"
                className="text-xs font-semibold text-ink-faint"
              >
                Type
              </label>
              <select
                id="kind"
                name="kind"
                defaultValue={params.kind ?? ""}
                className="h-10 rounded-xl border-[1.5px] border-line bg-surface px-3 text-sm"
              >
                <option value="">All types</option>
                {KIND_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {value[0].toUpperCase() + value.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="search"
                className="text-xs font-semibold text-ink-faint"
              >
                Search
              </label>
              <input
                id="search"
                name="search"
                defaultValue={params.search ?? ""}
                placeholder="Payee or memo"
                className="h-10 rounded-xl border-[1.5px] border-line bg-surface px-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="from"
                className="text-xs font-semibold text-ink-faint"
              >
                From
              </label>
              <input
                id="from"
                name="from"
                type="date"
                defaultValue={params.from ?? ""}
                className="h-10 rounded-xl border-[1.5px] border-line bg-surface px-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="to"
                className="text-xs font-semibold text-ink-faint"
              >
                To
              </label>
              <input
                id="to"
                name="to"
                type="date"
                defaultValue={params.to ?? ""}
                className="h-10 rounded-xl border-[1.5px] border-line bg-surface px-3 text-sm"
              />
            </div>
            <button
              type="submit"
              className="h-10 rounded-full bg-accent px-5 font-display text-sm font-bold text-white"
            >
              Filter
            </button>
          </form>
        </div>

        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-[15px] font-bold text-ink">
              Recent
            </h2>
            <span className="text-xs text-ink-faint">
              {total} transaction{total === 1 ? "" : "s"}
            </span>
          </div>

          {transactions.length === 0 ? (
            <p className="text-sm text-ink-faint">
              No transactions match these filters.
            </p>
          ) : (
            <ul className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
              {transactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  accountName={accountName}
                  categoryName={categoryName}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <h2 className="mb-4 font-display text-[15px] font-bold text-ink">
            Add transaction
          </h2>
          {accounts.length === 0 ? (
            <p className="text-sm text-ink-faint">
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
        </div>
      </div>
    </div>
  );
}
