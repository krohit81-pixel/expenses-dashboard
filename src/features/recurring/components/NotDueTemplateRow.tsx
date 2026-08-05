"use client";

import { useActionState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { formatMoneyDisplay, type Money } from "@/lib/money";
import {
  tagRecurringToCycleAction,
  untagRecurringFromCycleAction,
  type TagToCycleFormState,
  type UntagCycleFormState,
} from "@/features/recurring/api/actions";

const initialTagState: TagToCycleFormState = {};
const initialUntagState: UntagCycleFormState = {};

/**
 * A single row in "Not due this cycle" — templates whose own schedule
 * doesn't land in the selected cycle (a yearly premium, say). These stay
 * opt-in on purpose (see the page's isDueInCycle comment) rather than
 * joining the bulk pre-checked list above: pre-checking a yearly item
 * every single month it isn't actually due would ask for the same
 * confirmation eleven times too many. "Tag anyway" reuses the existing
 * single-item tagRecurringToCycleAction (no month picker needed here —
 * the cycle is already fixed to whatever's selected on this page).
 */
export function NotDueTemplateRow({
  templateId,
  name,
  amount,
  currencyCode,
  scheduleLabel,
  direction,
  cycleMonth,
  taggedTransactionId,
}: {
  templateId: string;
  name: string;
  amount: Money;
  currencyCode: string;
  scheduleLabel: string;
  direction: "in" | "out";
  cycleMonth: string;
  taggedTransactionId: string | null;
}) {
  const [tagState, tagAction, isTagPending] = useActionState(
    tagRecurringToCycleAction,
    initialTagState,
  );
  const [untagState, untagAction, isUntagPending] = useActionState(
    untagRecurringFromCycleAction,
    initialUntagState,
  );

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line px-[18px] py-3 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{name}</p>
        <p className="text-xs text-ink-faint">{scheduleLabel}</p>
      </div>
      <p
        className={`whitespace-nowrap font-display text-sm font-bold ${
          direction === "in" ? "text-positive" : "text-negative"
        }`}
      >
        {direction === "in" ? "+" : "−"}
        {formatMoneyDisplay(amount, currencyCode)}
      </p>
      {taggedTransactionId ? (
        <form action={untagAction}>
          <input
            type="hidden"
            name="transactionId"
            value={taggedTransactionId}
          />
          <button
            type="submit"
            disabled={isUntagPending}
            className="flex items-center gap-1 whitespace-nowrap rounded-full bg-positive-soft px-2.5 py-1 font-display text-[10px] font-bold text-positive disabled:opacity-70"
          >
            {isUntagPending && <Spinner className="size-3" />}
            Tagged · Undo
          </button>
        </form>
      ) : (
        <form action={tagAction}>
          <input type="hidden" name="templateId" value={templateId} />
          <input type="hidden" name="cycleMonth" value={cycleMonth} />
          <button
            type="submit"
            disabled={isTagPending}
            className="flex items-center gap-1 whitespace-nowrap rounded-full bg-accent-soft px-2.5 py-1 font-display text-[10px] font-bold text-accent disabled:opacity-70"
          >
            {isTagPending && <Spinner className="size-3" />}+ Tag anyway
          </button>
        </form>
      )}
      {tagState.error && (
        <p className="w-full text-[10px] text-negative">{tagState.error}</p>
      )}
      {untagState.error && (
        <p className="w-full text-[10px] text-negative">{untagState.error}</p>
      )}
    </div>
  );
}
