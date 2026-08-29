"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { Repeat } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  repeatLastCycleAction,
  type RepeatLastCycleFormState,
} from "@/features/transactions/api/actions";

const initialState: RepeatLastCycleFormState = {};

/**
 * v3.4.14 — replaces the old `/recurring` link-card. Recurring
 * (templates + bulk cycle-tag) is gone entirely; this is the household's
 * chosen replacement — a one-tap duplicate of last cycle's whole
 * transaction list into the cycle currently being viewed, still plain,
 * fully editable/deletable transactions afterward (no template concept
 * survives). Mirrors TransactionRow's own confirm-before-destructive
 * two-step pattern (a plain useState toggle swapping the button for an
 * inline Confirm/No row) rather than a full modal, since this is one
 * button, not a form.
 *
 * Deliberately has no guard against clicking this more than once (each
 * click duplicates last cycle's list again, on top of whatever's already
 * here) — same "no restrictions, it's a deliberate manual action"
 * reasoning this session already applied to the calendar's own "Send
 * reminder now" button. The two-step confirm exists to stop an
 * accidental tap, not to rate-limit a genuine repeat click.
 *
 * v3.5.2 — `count`/`totalDisplay` (passed down from Dashboard) exclude
 * card-due transfers; `repeatLastCycleAction` itself excludes them
 * from what actually gets copied, same "card dues come from the PDF
 * statement import instead" reasoning Recurring's own templates used
 * to apply. Said explicitly in the caption below, not just left
 * implicit in the count — household-reported: last cycle's card
 * payment amount is a stale, wrong number to duplicate forward.
 *
 * v3.5.3 — household-reported bug: after a successful copy, the
 * Confirm/No row stayed open right alongside the "Copied N
 * transactions" success message, instead of collapsing back to the
 * plain "Repeat" button. Missing the same
 * `useEffect(() => confirming -> false on state.success)`
 * `CycleBalanceCard`'s own edit form already has — `confirming` is
 * plain component state, `useActionState`'s `state.success` flipping
 * true was never wired to reset it.
 */
export function RepeatLastCycleButton({
  targetMonth,
  lastCycleLabel,
  count,
  totalDisplay,
}: {
  /** The cycle currently being viewed — where the copies land. */
  targetMonth: string;
  lastCycleLabel: string;
  count: number;
  totalDisplay: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState(
    repeatLastCycleAction,
    initialState,
  );

  // Depends on `state` itself, not `state.success` — repeatLastCycleAction
  // returns a fresh object literal on every dispatch, but two
  // consecutive successful copies both have `success: true`, the exact
  // same primitive value; an effect keyed on that boolean alone
  // wouldn't re-fire the second time (React's dependency check is
  // Object.is on each array element, and true === true), leaving
  // `confirming` stuck open again after a second real click. Keying
  // on the whole state object sidesteps that — it's a new reference
  // every dispatch, successful or not.
  useEffect(() => {
    if (state.success) setConfirming(false);
  }, [state]);

  if (count === 0) {
    return (
      <div className="flex items-center gap-3 rounded-[20px] bg-surface p-5 opacity-60 shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-accent-soft text-accent">
          <Repeat className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[14.5px] font-extrabold text-ink">
            Repeat last cycle
          </div>
          <div className="mt-0.5 text-[11.5px] text-ink-faint">
            Nothing logged in {lastCycleLabel} to repeat
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[20px] bg-surface p-5 shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-accent-soft text-accent">
          <Repeat className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[14.5px] font-extrabold text-ink">
            Repeat last cycle
          </div>
          <div className="mt-0.5 text-[11.5px] text-ink-faint">
            Copy {count} transaction{count === 1 ? "" : "s"} ({totalDisplay})
            from {lastCycleLabel} — card payments not included
          </div>
        </div>
        {!confirming && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfirming(true)}
          >
            Repeat
          </Button>
        )}
      </div>

      {confirming && (
        <form action={formAction} className="mt-4 flex items-center gap-2">
          <input type="hidden" name="targetMonth" value={targetMonth} />
          <p className="flex-1 text-xs text-ink-faint">
            Copy {count} transaction{count === 1 ? "" : "s"} from{" "}
            {lastCycleLabel} into this cycle?
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfirming(false)}
            disabled={isPending}
          >
            No
          </Button>
          <Button type="submit" size="sm" loading={isPending}>
            Confirm
          </Button>
        </form>
      )}

      {state.error && (
        <p className="mt-3 text-xs text-negative">{state.error}</p>
      )}
      {state.success && (
        <p className="mt-3 text-xs font-semibold text-positive">
          Copied {state.copiedCount} transaction
          {state.copiedCount === 1 ? "" : "s"} — review and mark them paid on
          Transactions.
        </p>
      )}
    </div>
  );
}
