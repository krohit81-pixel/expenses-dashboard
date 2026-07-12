"use client";

import { useActionState, useEffect, useState } from "react";

import { formatMoneyDisplay, type Money } from "@/lib/money";
import {
  updateRecurringTransactionAction,
  type UpdateRecurringFormState,
} from "@/features/recurring/api/actions";

const initialState: UpdateRecurringFormState = {};

function dayOfMonth(isoDate: string): number {
  return Number(isoDate.slice(8, 10));
}

function ordinal(day: number): string {
  if (day % 10 === 1 && day !== 11) return `${day}st`;
  if (day % 10 === 2 && day !== 12) return `${day}nd`;
  if (day % 10 === 3 && day !== 13) return `${day}rd`;
  return `${day}th`;
}

export function RecurringLineItem({
  id,
  name,
  amount,
  currencyCode,
  nextOccurrenceOn,
  direction,
}: {
  id: string;
  name: string;
  amount: Money;
  currencyCode: string;
  nextOccurrenceOn: string;
  direction: "in" | "out";
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(
    updateRecurringTransactionAction,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      setEditing(false);
    }
  }, [state.success]);

  if (!editing) {
    return (
      <li className="flex items-center gap-3 border-b border-line px-[18px] py-3.5 last:border-b-0">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink">{name}</div>
          <div className="text-xs text-ink-faint">
            Every month &middot; {ordinal(dayOfMonth(nextOccurrenceOn))}
          </div>
        </div>
        <div
          className={`whitespace-nowrap font-display text-sm font-bold ${direction === "in" ? "text-positive" : "text-negative"}`}
        >
          {direction === "in" ? "+" : "\u2212"}
          {formatMoneyDisplay(amount, currencyCode)}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-bg text-xs text-ink-soft"
          aria-label={`Edit ${name}`}
        >
          &#9998;
        </button>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-end gap-3 border-b border-line bg-bg px-[18px] py-3.5 last:border-b-0">
      <form
        action={formAction}
        className="flex w-full flex-wrap items-end gap-3"
      >
        <input type="hidden" name="id" value={id} />
        <div className="flex min-w-[140px] flex-1 flex-col gap-1">
          <label className="text-[10px] font-semibold text-ink-faint">
            Name
          </label>
          <input
            name="payee"
            defaultValue={name}
            required
            className="h-9 rounded-xl border-[1.5px] border-line px-2.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-ink-faint">
            Amount
          </label>
          <input
            name="amount"
            defaultValue={amount}
            inputMode="decimal"
            required
            className="h-9 w-28 rounded-xl border-[1.5px] border-line px-2.5 font-display text-sm font-bold"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-ink-faint">
            Day
          </label>
          <input
            name="dayOfMonth"
            type="number"
            min={1}
            max={31}
            defaultValue={dayOfMonth(nextOccurrenceOn)}
            required
            className="h-9 w-16 rounded-xl border-[1.5px] border-line px-2.5 text-sm"
          />
        </div>
        <div className="flex gap-1.5">
          <button
            type="submit"
            disabled={isPending}
            className="h-9 rounded-full bg-accent px-3.5 font-display text-xs font-bold text-white"
          >
            {isPending ? "…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="h-9 rounded-full bg-line px-3.5 font-display text-xs font-bold text-ink-soft"
          >
            Cancel
          </button>
        </div>
        {state.error && (
          <p className="w-full text-xs text-negative">{state.error}</p>
        )}
      </form>
    </li>
  );
}
