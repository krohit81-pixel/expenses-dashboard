import type { Metadata } from "next";

import { listTransactions } from "@/services/TransactionService";
import { listAccounts } from "@/services/AccountService";
import { listCategories } from "@/services/CategoryService";
import { Hero } from "@/components/ui/hero";
import { RecentTransactionsSection } from "@/features/transactions/components/RecentTransactionsSection";

export const metadata: Metadata = {
  title: "Transactions",
};

/**
 * v2.0.0: retired as a primary destination (dropped from the bottom
 * nav) and demoted to a read-only historical log, reachable from
 * More. The household is moving Atlas away from an execution/logging
 * app toward a reporting one — "key in what a cycle is expected to
 * look like" now happens entirely on Recurring (tag a template to a
 * cycle) and Budgets (view/edit what's tagged), neither of which
 * needed anything from this page to begin with. What's gone from
 * here specifically: CardPaymentQuickLog (logging a card due as a
 * one-off transfer) and AddTransactionSection (ad-hoc income/expense/
 * transfer entry) — both still exist as files, just unused, in case a
 * future version wants either back. RecentTransactionsSection is
 * still rendered, but with readOnly passed all the way down to
 * TransactionRow — no edit, delete, or mark-paid/pending controls on
 * any row anymore, just a filterable list of what already happened.
 */

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

  const kind = KIND_VALUES.find((value) => value === params.kind);

  const [accounts, categories, { transactions, total }] = await Promise.all([
    listAccounts(),
    listCategories(true),
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
  const incomeTransactions = transactions.filter((t) => t.kind === "income");
  const expenseTransactions = transactions.filter((t) => t.kind !== "income");

  return (
    <div>
      <Hero
        title="Transactions"
        sub="Read-only historical log. To key in what a cycle is expected to look like, use Recurring or Budgets."
      />

      <div className="space-y-6 p-5 sm:p-8">
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

        <RecentTransactionsSection
          incomeTransactions={incomeTransactions}
          expenseTransactions={expenseTransactions}
          total={total}
          accountName={accountName}
          categoryName={categoryName}
          readOnly
        />
      </div>
    </div>
  );
}
