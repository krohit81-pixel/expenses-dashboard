"use client";

import { useActionState, useMemo, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { monthLabel } from "@/lib/dates/month";
import {
  guessCardAccountId,
  type CardStatementSource,
} from "@/features/imports/cards";
import {
  logCardPaymentAction,
  type LogCardPaymentFormState,
} from "@/features/transactions/api/actions";
import type { Account } from "@/services/AccountService";
import type { Money } from "@/lib/money";

const initialState: LogCardPaymentFormState = {};

/**
 * The bridge CardPaymentQuickLog used to be (see that component's own
 * history — removed from the UI in v2.0, its job never replaced): a
 * successful statement import only ever wrote to
 * credit_card_statements/credit_card_transactions, which Dashboard's
 * cycle math (BudgetSnapshotService's `oneOff`, see home-stats.ts's
 * computeCardDuesTotal) never reads — only real finance.transactions
 * rows count there. Without this, an imported statement's total simply
 * never showed up as a Sept/whatever-cycle expense, no matter how
 * correctly it parsed and reconciled (the actual v2.5.4 bug report).
 *
 * v2.5.4: rather than restore CardPaymentQuickLog's fully-manual
 * standalone form, this shows right after a successful (or duplicate —
 * re-uploading is exactly when someone might realize they never logged
 * it) import, pre-filled with everything the statement already told the
 * app: amount due, due date, and cycle (derived from the statement's
 * own date via cycleMonthForStatementDate, not re-pickable here — it's
 * not ambiguous the way CardPaymentQuickLog's free-standing cycle
 * dropdown was). The only guess is *which* Account this statement's
 * card corresponds to (guessCardAccountId — accounts have no stored
 * link to a CardStatementSource); shown as an editable picker, not
 * assumed silently, since getting the destination account wrong would
 * actually corrupt data, unlike getting the from-account wrong (which
 * only ever defaults to "reasonable", never inferred from anything).
 */
export function LogCardDuePrompt({
  cardSource,
  cycleMonth,
  dueDate,
  totalAmountDue,
  statementCurrency,
  alreadyLoggedCardAccountIds,
  cardAccounts,
  checkingAccounts,
}: {
  cardSource: CardStatementSource;
  cycleMonth: string;
  dueDate: string;
  totalAmountDue: Money;
  statementCurrency: string;
  alreadyLoggedCardAccountIds: string[];
  cardAccounts: Account[];
  checkingAccounts: Account[];
}) {
  const [state, formAction, isPending] = useActionState(
    logCardPaymentAction,
    initialState,
  );
  const [dismissed, setDismissed] = useState(false);

  const defaultCardAccountId = useMemo(
    () => guessCardAccountId(cardSource, cardAccounts) ?? cardAccounts[0]?.id,
    [cardSource, cardAccounts],
  );
  const [cardAccountId, setCardAccountId] = useState(
    defaultCardAccountId ?? "",
  );

  if (dismissed || state.success) {
    return state.success ? (
      <p className="rounded-xl bg-positive-soft px-4 py-3 text-sm font-semibold text-positive">
        Logged as a {monthLabel(cycleMonth)} expense.
      </p>
    ) : null;
  }

  if (cardAccounts.length === 0 || checkingAccounts.length === 0) {
    // Nothing sensible to pick from — rather than show a broken form,
    // point at where those get created. Genuinely rare: this household
    // already has both kinds of account for every card it imports
    // statements for.
    return (
      <p className="rounded-xl bg-bg px-4 py-3 text-xs text-ink-faint">
        To log this as a {monthLabel(cycleMonth)} expense, you need at least one
        credit card account and one checking/savings/cash account set up under
        Accounts first.
      </p>
    );
  }

  const alreadyLogged = alreadyLoggedCardAccountIds.includes(cardAccountId);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-xl border-[1.5px] border-line bg-bg px-4 py-3.5"
    >
      <div>
        <p className="font-display text-xs font-bold text-ink">
          Log this as a {monthLabel(cycleMonth)} expense
        </p>
        <p className="mt-0.5 text-xs text-ink-faint">
          The import above only saves statement/reporting data — nothing shows
          up on Dashboard until it&apos;s logged as an actual transaction.
        </p>
      </div>

      {alreadyLogged && (
        <p className="rounded-lg bg-amber-soft px-3 py-2 text-xs font-semibold text-amber">
          You&apos;ve already logged a card payment for {monthLabel(cycleMonth)}{" "}
          against this account — logging again adds a second one.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="cardAccountId"
          className="text-xs font-semibold text-ink-faint"
        >
          Card account
        </label>
        <select
          id="cardAccountId"
          name="cardAccountId"
          required
          value={cardAccountId}
          onChange={(e) => setCardAccountId(e.target.value)}
          className="h-11 rounded-2xl border-[1.5px] border-line bg-surface px-3.5 text-sm"
        >
          {cardAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>

      <input type="hidden" name="currencyCode" value={statementCurrency} />
      <input type="hidden" name="cycleMonth" value={cycleMonth} />

      <div className="grid grid-cols-2 gap-3">
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
            required
            defaultValue={totalAmountDue}
            className="h-11 rounded-2xl border-[1.5px] border-line bg-surface px-3.5 font-display text-sm font-bold"
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
            required
            defaultValue={dueDate}
            className="h-11 rounded-2xl border-[1.5px] border-line bg-surface px-3.5 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
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
          className="h-11 rounded-2xl border-[1.5px] border-line bg-surface px-3.5 text-sm"
        >
          {checkingAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>

      {state.error && <p className="text-sm text-negative">{state.error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex-1 rounded-full py-2.5 font-display text-xs font-bold text-ink-faint"
        >
          Skip for now
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-accent py-2.5 font-display text-xs font-bold text-white disabled:opacity-50"
        >
          {isPending && <Spinner className="size-3.5" />}
          Log payment
        </button>
      </div>
    </form>
  );
}
