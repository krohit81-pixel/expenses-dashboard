"use client";

import { useActionState } from "react";

import { formatMoneyDisplay, type Money } from "@/lib/money";
import { Spinner } from "@/components/ui/spinner";
import {
  markTransactionPaidAction,
  type MarkPaidFormState,
} from "@/features/transactions/api/actions";

const initialState: MarkPaidFormState = {};

export function ChecklistItem({
  id,
  title,
  meta,
  amount,
  currencyCode,
  direction,
  status,
  compact = false,
}: {
  id: string;
  title: string;
  meta?: string;
  amount: Money;
  currencyCode: string;
  direction: "in" | "out";
  status: "pending" | "posted";
  compact?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    markTransactionPaidAction,
    initialState,
  );
  const done = status === "posted";

  return (
    <li
      className={`flex items-center gap-3 border-b border-line last:border-b-0 ${compact ? "px-4 py-2.5" : "px-[18px] py-3.5"}`}
    >
      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          disabled={done || isPending}
          aria-label={done ? `${title} — paid` : `Mark ${title} as paid`}
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
      {state.error && (
        <p className="w-full text-[10px] text-negative">{state.error}</p>
      )}
    </li>
  );
}
