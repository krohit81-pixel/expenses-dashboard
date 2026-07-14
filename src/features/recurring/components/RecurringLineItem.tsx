"use client";

import { useActionState, useEffect, useState } from "react";

import { formatMoneyDisplay, type Money } from "@/lib/money";
import { Spinner } from "@/components/ui/spinner";
import { TagToCycleButton } from "@/features/recurring/components/TagToCycleButton";
import { formatFrequency } from "@/features/recurring/format";
import {
  deleteRecurringTransactionAction,
  updateRecurringTransactionAction,
  type DeleteRecurringFormState,
  type UpdateRecurringFormState,
} from "@/features/recurring/api/actions";

const initialUpdateState: UpdateRecurringFormState = {};
const initialDeleteState: DeleteRecurringFormState = {};

const FREQUENCIES = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
] as const;

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
  frequency,
  intervalCount,
  direction,
}: {
  id: string;
  name: string;
  amount: Money;
  currencyCode: string;
  nextOccurrenceOn: string;
  frequency: string;
  intervalCount: number;
  direction: "in" | "out";
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [updateState, updateAction, isUpdatePending] = useActionState(
    updateRecurringTransactionAction,
    initialUpdateState,
  );
  const [deleteState, deleteAction, isDeletePending] = useActionState(
    deleteRecurringTransactionAction,
    initialDeleteState,
  );

  useEffect(() => {
    if (updateState.success) {
      setEditing(false);
    }
  }, [updateState.success]);

  if (!editing) {
    return (
      <li className="flex flex-col gap-2 border-b border-line px-[18px] py-3.5 last:border-b-0">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink">
              {name}
            </div>
            <div className="text-xs text-ink-faint">
              {formatFrequency(frequency, intervalCount)}
              {frequency === "monthly" &&
                ` \u00b7 ${ordinal(dayOfMonth(nextOccurrenceOn))}`}
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
          {confirmingDelete ? (
            <div className="flex shrink-0 items-center gap-1">
              <form action={deleteAction}>
                <input type="hidden" name="id" value={id} />
                <button
                  type="submit"
                  disabled={isDeletePending}
                  className="flex h-[30px] items-center justify-center gap-1 rounded-full bg-negative px-2.5 font-display text-[10px] font-bold text-white disabled:opacity-70"
                >
                  {isDeletePending && <Spinner className="size-3" />}
                  Confirm
                </button>
              </form>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="flex h-[30px] items-center justify-center rounded-full bg-bg px-2.5 font-display text-[10px] font-bold text-ink-soft"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-bg text-xs text-negative"
              aria-label={`Delete ${name}`}
            >
              &#128465;
            </button>
          )}
        </div>
        <TagToCycleButton templateId={id} />
        {deleteState.error && (
          <p className="text-xs text-negative">{deleteState.error}</p>
        )}
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-end gap-3 border-b border-line bg-bg px-[18px] py-3.5 last:border-b-0">
      <form
        action={updateAction}
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
            Repeats
          </label>
          <select
            name="frequency"
            defaultValue={frequency}
            required
            className="h-9 rounded-xl border-[1.5px] border-line px-2.5 text-sm"
          >
            {FREQUENCIES.map((freq) => (
              <option key={freq} value={freq}>
                {freq[0].toUpperCase() + freq.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label
            className="text-[10px] font-semibold text-ink-faint"
            title="A multiplier on Repeats — e.g. Repeats: Monthly + Every: 3 means every 3 months. Not a day of the month."
          >
            Every &middot; count of periods
          </label>
          <input
            name="intervalCount"
            type="number"
            min={1}
            max={365}
            defaultValue={intervalCount}
            required
            className="h-9 w-20 rounded-xl border-[1.5px] border-line px-2.5 text-sm"
          />
        </div>
        {frequency === "monthly" && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-ink-faint">
              Day of month
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
        )}
        <div className="flex gap-1.5">
          <button
            type="submit"
            disabled={isUpdatePending}
            className="flex h-9 items-center justify-center gap-1.5 rounded-full bg-accent px-3.5 font-display text-xs font-bold text-white disabled:opacity-70"
          >
            {isUpdatePending && <Spinner className="size-3.5" />}
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="h-9 rounded-full bg-line px-3.5 font-display text-xs font-bold text-ink-soft"
          >
            Cancel
          </button>
        </div>
        {updateState.error && (
          <p className="w-full text-xs text-negative">{updateState.error}</p>
        )}
      </form>
    </li>
  );
}
