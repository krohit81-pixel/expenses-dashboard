"use client";

import { useActionState, useEffect, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { formatMoneyDisplay, type Money } from "@/lib/money";
import {
  correctAccountBalanceAction,
  type CorrectAccountBalanceFormState,
} from "@/features/accounts/api/actions";

const initialState: CorrectAccountBalanceFormState = {};

/**
 * The "correct this account's balance" panel — see correctAccountBalance's
 * own comment (AccountService) for why this logs a transaction rather than
 * overwriting a field. Preview delta below is computed client-side from
 * plain numbers purely for display; the server recomputes the real delta
 * from the current balance at submit time, so a stale client-side balance
 * (e.g. another tab changed something) can't produce a wrong transaction —
 * worst case the preview text is briefly off, never what actually gets
 * logged.
 */
export function AccountBalanceRow({
  accountId,
  name,
  typeLabel,
  balance,
  currencyCode,
}: {
  accountId: string;
  name: string;
  typeLabel: string;
  balance: Money;
  currencyCode: string;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState<string>(balance);
  const [state, formAction, isPending] = useActionState(
    correctAccountBalanceAction,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      setOpen(false);
    }
  }, [state.success]);

  const computedNum = Number(balance);
  const typedNum = Number(input.replace(/,/g, ""));
  const hasValidNumber = input.trim() !== "" && !Number.isNaN(typedNum);
  const delta = hasValidNumber ? typedNum - computedNum : 0;
  const showDelta = hasValidNumber && Math.abs(delta) > 0.005;
  const deltaPositive = delta > 0;

  return (
    <li className="border-b border-line px-[18px] py-3.5 last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{name}</p>
          <p className="text-xs capitalize text-ink-faint">{typeLabel}</p>
        </div>
        <p
          className={`whitespace-nowrap font-display text-[15px] font-bold ${
            computedNum < 0 ? "text-negative" : "text-ink"
          }`}
        >
          {formatMoneyDisplay(balance, currencyCode)}
        </p>
        <button
          type="button"
          onClick={() => {
            setInput(balance);
            setOpen((v) => !v);
          }}
          className={`flex size-[30px] shrink-0 items-center justify-center rounded-full text-xs ${
            open ? "bg-accent text-white" : "bg-bg text-ink-soft"
          }`}
          aria-label={
            open ? `Cancel correcting ${name}` : `Correct ${name}'s balance`
          }
        >
          {open ? "✕" : "✎"}
        </button>
      </div>

      {open && (
        <div className="mt-3 rounded-2xl bg-bg p-3.5">
          <p className="mb-2.5 text-xs text-ink-faint">
            Atlas shows{" "}
            <span className="font-semibold text-ink-soft">
              {formatMoneyDisplay(balance, currencyCode)}
            </span>{" "}
            for this account right now.
          </p>
          <form action={formAction}>
            <input type="hidden" name="accountId" value={accountId} />
            <label className="mb-1 block text-[10px] font-semibold text-ink-faint">
              What does it actually hold?
            </label>
            <input
              name="actualBalance"
              inputMode="decimal"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full rounded-xl border-[1.5px] border-line bg-surface px-3 py-2.5 font-display text-base font-bold text-ink"
            />

            {showDelta && (
              <div
                className={`mt-2.5 flex items-start gap-2 rounded-xl px-3 py-2 ${
                  deltaPositive ? "bg-positive-soft" : "bg-negative-soft"
                }`}
              >
                <span
                  className={`shrink-0 text-xs font-bold ${deltaPositive ? "text-positive" : "text-negative"}`}
                >
                  {deltaPositive ? "↑" : "↓"}
                </span>
                <span className="text-[11px] leading-relaxed text-ink-soft">
                  Will log a{" "}
                  <span
                    className={`font-bold ${deltaPositive ? "text-positive" : "text-negative"}`}
                  >
                    {deltaPositive ? "+" : "−"}
                    {formatMoneyDisplay(
                      Math.abs(delta).toFixed(2) as Money,
                      currencyCode,
                    )}
                  </span>{" "}
                  {deltaPositive ? "income" : "expense"} transaction,
                  &quot;Balance adjustment,&quot; dated today.
                </span>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full border-[1.5px] border-line py-2 text-center font-display text-xs font-bold text-ink-soft"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !hasValidNumber}
                className="flex flex-[2] items-center justify-center gap-1.5 rounded-full bg-accent py-2 font-display text-xs font-bold text-white disabled:opacity-50"
              >
                {isPending && <Spinner className="size-3.5" />}
                Save correction
              </button>
            </div>

            {state.error && (
              <p className="mt-2 text-xs text-negative">{state.error}</p>
            )}
          </form>

          <p className="mt-2.5 text-[10px] leading-relaxed text-ink-faint">
            This doesn&apos;t touch history — it logs one transaction today to
            bring Atlas back in line with reality. Undo by voiding it from
            Transactions if you make a mistake.
          </p>
        </div>
      )}
    </li>
  );
}
