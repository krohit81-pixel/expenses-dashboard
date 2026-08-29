"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/ui/field-error";
import {
  formatMoneyDisplay,
  isNegativeMoney,
  negateMoney,
  type Money,
} from "@/lib/money";
import {
  setCycleStartingBalanceAction,
  type SetCycleStartingBalanceFormState,
} from "@/features/dashboard/api/actions";

const initialState: SetCycleStartingBalanceFormState = {};

/**
 * v3.5.0 — Dashboard's "Balance" section: Expenses Remaining (pure
 * display, computed server-side via computeExpensesRemaining) and
 * Account Balance (editable). The big number shown for Account Balance
 * is always the LIVE, derived running balance (startingBalance +
 * posted income − posted expenses this cycle) — the pencil only ever
 * edits the underlying STARTING balance (what was really typed and
 * stored), never the derived total directly. That distinction matters:
 * the running total should always move on its own as transactions get
 * marked paid, exactly like the household's own prototype, without a
 * manual edit ever fighting against that math.
 */
export function CycleBalanceCard({
  cycleMonth,
  currency,
  expensesRemaining,
  startingBalance,
  runningBalance,
}: {
  cycleMonth: string;
  currency: string;
  expensesRemaining: Money;
  /** Null when never set for this cycle yet. */
  startingBalance: Money | null;
  /** Null when startingBalance is null — nothing to derive. */
  runningBalance: Money | null;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(
    setCycleStartingBalanceAction,
    initialState,
  );

  useEffect(() => {
    if (state.success) setEditing(false);
  }, [state.success]);

  const balanceDisplay =
    runningBalance === null
      ? null
      : `${isNegativeMoney(runningBalance) ? "−" : ""}${formatMoneyDisplay(
          isNegativeMoney(runningBalance)
            ? negateMoney(runningBalance)
            : runningBalance,
          currency,
        )}`;

  return (
    <div className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
      <div className="grid grid-cols-1 sm:grid-cols-2">
        <div className="border-b border-line p-5 sm:border-b-0 sm:border-r">
          <div className="text-[11px] font-semibold text-ink-soft">
            Expenses Remaining
          </div>
          <div className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-negative">
            &minus;{formatMoneyDisplay(expensesRemaining, currency)}
          </div>
          <div className="mt-1 text-[11px] text-ink-faint">
            Not yet marked paid this cycle
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-ink-soft">
              Account Balance
            </span>
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Edit starting balance"
                className="ml-auto flex size-[26px] items-center justify-center rounded-full border border-line bg-surface text-ink-soft"
              >
                <Pencil className="size-3" />
              </button>
            )}
          </div>

          {!editing ? (
            <>
              {balanceDisplay === null ? (
                <>
                  <div className="mt-1.5 font-display text-base font-bold text-ink-faint">
                    Not set
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="mt-1 text-[11px] font-semibold text-accent underline"
                  >
                    Set starting balance
                  </button>
                </>
              ) : (
                <>
                  <div className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-ink">
                    {balanceDisplay}
                  </div>
                  <div className="mt-1 text-[11px] text-ink-faint">
                    Moves as you mark items paid — or edit it directly
                  </div>
                </>
              )}
            </>
          ) : (
            <form action={formAction} className="mt-2 space-y-2">
              <input type="hidden" name="cycleMonth" value={cycleMonth} />
              <div className="flex items-center gap-2">
                <Input
                  name="amount"
                  defaultValue={startingBalance ?? ""}
                  placeholder="e.g. 425000"
                  inputMode="decimal"
                  autoFocus
                  className="w-36"
                />
                <Button type="submit" size="sm" loading={isPending}>
                  Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </div>
              <p className="text-[11px] text-ink-faint">
                Cash on hand at the start of this cycle
              </p>
              <FieldError message={state.error} />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
