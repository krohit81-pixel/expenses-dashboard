"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";

import { CreateTransactionForm } from "@/features/transactions/components/CreateTransactionForm";
import type { Account } from "@/services/AccountService";
import type { Category } from "@/services/CategoryService";

/**
 * Collapsed by default (v1.2) — the full income/expense/transfer form
 * used to always be expanded on the page, which meant it took up real
 * estate (and a scroll) on every single visit to Transactions, even
 * the ones where you're just here to look something up. One tap opens
 * it; the request that prompted this specifically offered "remove
 * entirely" as the other option, but this tab is the only place a
 * one-off transaction can be added at all — collapsing behind a button
 * keeps that possible without it being permanently in the way.
 *
 * Deliberately doesn't auto-collapse after a successful add (no
 * onSuccess callback threaded through to CreateTransactionForm) — if
 * you're logging several transactions in a row, closing and reopening
 * the form after each one would be more taps, not fewer.
 */
export function AddTransactionSection({
  accounts,
  categories,
  defaultCurrency,
  hasAccounts,
}: {
  accounts: Account[];
  categories: Category[];
  defaultCurrency: string;
  hasAccounts: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-[20px] bg-accent py-3.5 font-display text-sm font-bold text-white shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]"
      >
        <Plus className="size-4" />
        Add transaction
      </button>
    );
  }

  return (
    <div className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-[15px] font-bold text-ink">
          Add transaction
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="flex size-7 items-center justify-center rounded-full bg-bg text-ink-soft"
        >
          <X className="size-4" />
        </button>
      </div>
      {!hasAccounts ? (
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
  );
}
