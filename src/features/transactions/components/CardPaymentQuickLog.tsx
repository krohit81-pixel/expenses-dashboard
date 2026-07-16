"use client";

import { useActionState, useEffect, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { monthOptions } from "@/lib/dates/month";

import {
  logCardPaymentAction,
  type LogCardPaymentFormState,
} from "@/features/transactions/api/actions";
import type { Account } from "@/services/AccountService";

const initialState: LogCardPaymentFormState = {};

const CYCLE_WINDOW = monthOptions(5, -1); // last month through 3 months ahead

function payOnDateFor(cycleMonth: string): string {
  return `${cycleMonth}-01`;
}

/**
 * Card payment quick-log, with its own cycle selector — previously
 * hardcoded to "next month" with no way to review or log for any other
 * cycle, so a card already logged for August stayed permanently locked
 * even when trying to look at July or September instead. Fetching
 * "logged" status per cycle up front (loggedCardAccountIdsByCycle) means
 * switching cycles here is instant, no server round-trip, same pattern
 * as Home's own cycle dropdown.
 */
export function CardPaymentQuickLog({
  cardAccounts,
  checkingAccounts,
  loggedCardAccountIdsByCycle,
  defaultCurrency,
}: {
  cardAccounts: Account[];
  checkingAccounts: Account[];
  loggedCardAccountIdsByCycle: Record<string, Set<string>>;
  defaultCurrency: string;
}) {
  const [state, formAction, isPending] = useActionState(
    logCardPaymentAction,
    initialState,
  );
  const [open, setOpen] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState(CYCLE_WINDOW[1]!.value); // next month, matches old default
  const loggedForCycle =
    loggedCardAccountIdsByCycle[selectedCycle] ?? new Set<string>();
  const [selectedCard, setSelectedCard] = useState<string>(
    cardAccounts.find((c) => !loggedForCycle.has(c.id))?.id ??
      cardAccounts[0]?.id ??
      "",
  );

  // Re-pick a sensible default card whenever the cycle changes — the
  // previously selected card might now be logged (or now be the only
  // unlogged one) for the newly selected cycle.
  useEffect(() => {
    const stillUnlogged = !loggedForCycle.has(selectedCard);
    if (!stillUnlogged) {
      const nextDefault = cardAccounts.find((c) => !loggedForCycle.has(c.id));
      setSelectedCard(nextDefault?.id ?? cardAccounts[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCycle]);

  const loggedCount = cardAccounts.filter((c) =>
    loggedForCycle.has(c.id),
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
        <div className="px-[18px] pb-[18px]">
          <div className="mb-3.5 flex flex-col gap-1.5">
            <label
              htmlFor="reviewCycle"
              className="text-xs font-semibold text-ink-faint"
            >
              Reviewing cycle
            </label>
            <select
              id="reviewCycle"
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              className="h-11 rounded-2xl border-[1.5px] border-line px-3.5 text-sm"
            >
              {CYCLE_WINDOW.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label} cycle
                </option>
              ))}
            </select>
          </div>

          <form action={formAction}>
            <p className="mb-3.5 text-xs text-ink-faint">
              Statement came in? Pick the card, enter what&apos;s due, confirm
              when it&apos;ll be paid.
            </p>

            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {cardAccounts.map((card) => {
                const logged = loggedForCycle.has(card.id);
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
                  key={selectedCycle}
                  id="payOn"
                  name="payOn"
                  type="date"
                  defaultValue={payOnDateFor(selectedCycle)}
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
                htmlFor="cycleMonth"
                className="text-xs font-semibold text-ink-faint"
              >
                Counts toward
              </label>
              <select
                key={selectedCycle}
                id="cycleMonth"
                name="cycleMonth"
                defaultValue={selectedCycle}
                className="h-11 rounded-2xl border-[1.5px] border-line px-3.5 text-sm"
              >
                {monthOptions(8, -2).map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label} cycle
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-ink-faint">
                Defaults to match &ldquo;Reviewing cycle&rdquo; above — change
                it here if this specific payment counts toward a different one.
              </p>
            </div>

            <div className="mb-4 flex flex-col gap-1.5">
              <label
                htmlFor="memo"
                className="text-xs font-semibold text-ink-faint"
              >
                Note (optional)
              </label>
              <input
                id="memo"
                name="memo"
                placeholder="e.g. paying early from July salary"
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
        </div>
      )}
    </div>
  );
}
