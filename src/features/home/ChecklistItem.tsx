"use client";

import { useActionState } from "react";

import { formatMoneyDisplay, type Money } from "@/lib/money";
import { Spinner } from "@/components/ui/spinner";
import {
  markTransactionPaidAction,
  markTransactionPendingAction,
  type MarkPaidFormState,
} from "@/features/transactions/api/actions";

const initialState: MarkPaidFormState = {};

/**
 * Checkbox that can go either direction — mark paid, or undo a mark-paid
 * back to pending. Added after a real report: the original version was
 * one-way only (disabled once posted), and there was no way to recover
 * from an accidental tap, which had already moved the amount in or out
 * of the account's computed balance (posting is what makes it count).
 */
function Checkbox({
  id,
  done,
  title,
}: {
  id: string;
  done: boolean;
  title: string;
}) {
  const [paidState, paidAction, isPaidPending] = useActionState(
    markTransactionPaidAction,
    initialState,
  );
  const [pendingState, pendingAction, isPendingPending] = useActionState(
    markTransactionPendingAction,
    initialState,
  );
  const isPending = isPaidPending || isPendingPending;
  const error = paidState.error || pendingState.error;

  return (
    <>
      <form action={done ? pendingAction : paidAction}>
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          disabled={isPending}
          aria-label={
            done ? `Undo — mark ${title} as not paid` : `Mark ${title} as paid`
          }
          className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            done ? "border-positive bg-positive" : "border-line bg-surface"
          }`}
        >
          {isPending ? (
            <Spinner className="size-3 text-ink-faint" />
          ) : (
            <svg
              viewBox="0 0 24 24"
              className={`size-3.5 ${done ? "opacity-100" : "opacity-0"}`}
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      </form>
      {error && <p className="w-full text-[10px] text-negative">{error}</p>}
    </>
  );
}

export function ChecklistItem({
  id,
  title,
  meta,
  amount,
  currencyCode,
  direction,
  status,
  compact = false,
  readOnly = false,
}: {
  id: string;
  title: string;
  meta?: string;
  amount: Money;
  currencyCode: string;
  direction: "in" | "out";
  status: "pending" | "posted";
  compact?: boolean;
  /** No checkbox interaction — just shows done/pending as information.
   * Used anywhere this data is shown as a status glance rather than an
   * action surface: Planning's "so far" summary, Tracking's settled
   * review, and any month other than the real current one. */
  readOnly?: boolean;
}) {
  const done = status === "posted";

  return (
    <li
      className={`flex items-center gap-3 border-b border-line last:border-b-0 ${compact ? "px-4 py-2.5" : "px-[18px] py-3.5"}`}
    >
      {readOnly ? (
        <div
          className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
            done ? "border-positive bg-positive" : "border-line bg-surface"
          }`}
          aria-label={done ? `${title} — paid` : `${title} — not yet paid`}
        >
          <svg
            viewBox="0 0 24 24"
            className={`size-3.5 ${done ? "opacity-100" : "opacity-0"}`}
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
      ) : (
        <Checkbox id={id} done={done} title={title} />
      )}
      <div className="min-w-0 flex-1">
        <div
          className={`font-semibold text-ink ${compact ? "text-[13px]" : "text-sm"} ${done ? "text-ink-faint line-through" : ""}`}
        >
          {title}
        </div>
        {meta && !compact && (
          <div className="mt-0.5 text-[11px] text-ink-faint">{meta}</div>
        )}
      </div>
      <div
        className={`whitespace-nowrap font-display font-bold ${compact ? "text-[13px]" : "text-sm"} ${
          done
            ? "text-ink-faint"
            : direction === "in"
              ? "text-positive"
              : "text-negative"
        }`}
      >
        {direction === "in" ? "+" : "\u2212"}
        {formatMoneyDisplay(amount, currencyCode)}
      </div>
    </li>
  );
}
