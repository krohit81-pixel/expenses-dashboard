"use client";

import { useActionState, useState } from "react";

import { Spinner } from "@/components/ui/spinner";

import {
  logCardPaymentAction,
  type LogCardPaymentFormState,
} from "@/features/transactions/api/actions";
import type { Account } from "@/services/AccountService";

const initialState: LogCardPaymentFormState = {};

function defaultPayOnDate(): string {
  const now = new Date();
  const nextMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  return nextMonth.toISOString().slice(0, 10);
}

export function CardPaymentQuickLog({
  cardAccounts,
  checkingAccounts,
  loggedCardAccountIds,
  defaultCurrency,
}: {
  cardAccounts: Account[];
  checkingAccounts: Account[];
  loggedCardAccountIds: Set<string>;
  defaultCurrency: string;
}) {
  const [state, formAction, isPending] = useActionState(
    logCardPaymentAction,
    initialState,
  );
  const [open, setOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string>(
    cardAccounts.find((c) => !loggedCardAccountIds.has(c.id))?.id ??
      cardAccounts[0]?.id ??
      "",
  );

  const loggedCount = cardAccounts.filter((c) =>
    loggedCardAccountIds.has(c.id),
  ).length;

  if (cardAccounts.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-[18px] py-4"
      >
        <h2 className="font-display text-[15px] font-bold text-ink">
          Log a card payment
        </h2>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 font-display text-[11px] font-bold text-accent">
          {loggedCount} of {cardAccounts.length} &middot;{" "}
          {open ? "close" : "open"}
        </span>
      </button>

      {open && (
        <form action={formAction} className="px-[18px] pb-[18px]">
          <p className="mb-3.5 text-xs text-ink-faint">
            Statement came in? Pick the card, enter what&apos;s due, confirm
            when it&apos;ll be paid.
          </p>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {cardAccounts.map((card) => {
              const logged = loggedCardAccountIds.has(card.id);
              const selected = selectedCard === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  disabled={logged}
                  onClick={() => setSelectedCard(card.id)}
                  className={`rounded-2xl px-2 py-3 text-center text-xs font-semibold transition-colors ${
                    logged
                      ? "bg-positive-soft text-positive"
                      : selected
                        ? "bg-accent text-white"
                        : "bg-bg text-ink-soft"
                  }`}
                >
                  {card.name}
                  {logged ? " \u2713" : ""}
                </button>
              );
            })}
          </div>

          <input type="hidden" name="cardAccountId" value={selectedCard} />
          <input type="hidden" name="currencyCode" value={defaultCurrency} />

          <div className="mb-3 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="amount"
                className="text-xs font-semibold text-ink-faint"
              >
                Amount due
              </label>
              <input
                id="amount"
                name="amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                required
                className="h-11 rounded-2xl border-[1.5px] border-line px-3.5 font-display text-sm font-bold"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="payOn"
                className="text-xs font-semibold text-ink-faint"
              >
                Pay on
              </label>
              <input
                id="payOn"
                name="payOn"
                type="date"
                defaultValue={defaultPayOnDate()}
                required
                className="h-11 rounded-2xl border-[1.5px] border-line px-3.5 text-sm"
              />
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-1.5">
            <label
              htmlFor="fromAccountId"
              className="text-xs font-semibold text-ink-faint"
            >
              From account
            </label>
            <select
              id="fromAccountId"
              name="fromAccountId"
              required
              className="h-11 rounded-2xl border-[1.5px] border-line px-3.5 text-sm"
            >
              {checkingAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4 flex flex-col gap-1.5">
            <label
              htmlFor="memo"
              className="text-xs font-semibold text-ink-faint"
            >
              Note &middot; which billing cycle (optional)
            </label>
            <input
              id="memo"
              name="memo"
              placeholder="e.g. August cycle — paying early from July salary"
              className="h-11 rounded-2xl border-[1.5px] border-line px-3.5 text-sm"
            />
          </div>

          {state.error && (
            <p className="mb-3 text-sm text-negative">{state.error}</p>
          )}
          {state.success && (
            <p className="mb-3 text-sm text-positive">Logged.</p>
          )}

          <button
            type="submit"
            disabled={isPending || !selectedCard}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 font-display text-sm font-bold text-white disabled:opacity-50"
          >
            {isPending && <Spinner className="size-4" />}
            Log payment
          </button>
        </form>
      )}
    </div>
  );
}
