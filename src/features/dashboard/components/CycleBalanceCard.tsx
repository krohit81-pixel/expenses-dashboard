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

function signedDisplay(value: Money, currency: string): string {
  const negative = isNegativeMoney(value);
  return `${negative ? "−" : ""}${formatMoneyDisplay(negative ? negateMoney(value) : value, currency)}`;
}

/**
 * v3.5.0 — Dashboard's "Balance" section.
 *
 * v3.5.1 rework: Account Balance is now purely "the balance that I
 * keep" — whatever was last typed in, shown back exactly as-is, never
 * auto-adjusted by anything getting marked paid/received (household
 * request: income specifically "has no interference to the account
 * balance," and the whole posted-expense auto-deduction went with it —
 * a manually-kept figure is honest about not tracking real bank
 * activity Atlas doesn't see). The only derived figure now is the new
 * **Difference** footer: accountBalance − expensesRemaining ("if I
 * paid off everything still pending, what would I have left"),
 * computed server-side (computeDifference,
 * lib/budget/cycle-balance.ts) and passed in already-formatted, same
 * as expensesRemaining always was.
 */
export function CycleBalanceCard({
  cycleMonth,
  currency,
  expensesRemainingDisplay,
  accountBalance,
  differenceDisplay,
}: {
  cycleMonth: string;
  currency: string;
  expensesRemainingDisplay: string;
  /** Null when never set for this cycle yet. */
  accountBalance: Money | null;
  /** Null when accountBalance is null — nothing to derive. Pre-formatted with its own sign, same convention as every other signed display in this app. */
  differenceDisplay: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(
    setCycleStartingBalanceAction,
    initialState,
  );

  useEffect(() => {
    if (state.success) setEditing(false);
  }, [state.success]);

  return (
    <div className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
      <div className="grid grid-cols-1 sm:grid-cols-2">
        <div className="border-b border-line p-5 sm:border-b-0 sm:border-r">
          <div className="text-[11px] font-semibold text-ink-soft">
            Expenses Remaining
          </div>
          <div className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-negative">
            &minus;{expensesRemainingDisplay}
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
                aria-label="Edit account balance"
                className="ml-auto flex size-[26px] items-center justify-center rounded-full border border-line bg-surface text-ink-soft"
              >
                <Pencil className="size-3" />
              </button>
            )}
          </div>

          {!editing ? (
            <>
              {accountBalance === null ? (
                <>
                  <div className="mt-1.5 font-display text-base font-bold text-ink-faint">
                    Not set
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="mt-1 text-[11px] font-semibold text-accent underline"
                  >
                    Set your balance
                  </button>
                </>
              ) : (
                <>
                  <div className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-ink">
                    {signedDisplay(accountBalance, currency)}
                  </div>
                  <div className="mt-1 text-[11px] text-ink-faint">
                    The balance you keep — edit it any time
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
                  defaultValue={accountBalance ?? ""}
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
                Whatever your account actually shows right now
              </p>
              <FieldError message={state.error} />
            </form>
          )}
        </div>
      </div>

      {differenceDisplay !== null && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
          <div>
            <div className="font-display text-xs font-bold text-ink">
              Difference
            </div>
            <div className="text-[11px] text-ink-faint">
              Balance after paying what&apos;s still remaining
            </div>
          </div>
          <div
            className={`font-display text-lg font-extrabold tracking-tight ${
              differenceDisplay.startsWith("−") ? "text-negative" : "text-ink"
            }`}
          >
            {differenceDisplay}
          </div>
        </div>
      )}
    </div>
  );
}
