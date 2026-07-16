"use client";

import { useActionState, useEffect, useState } from "react";

import { formatMoneyDisplay, type Money } from "@/lib/money";
import { monthOptions, shortMonthLabel } from "@/lib/dates/month";
import { Spinner } from "@/components/ui/spinner";
import { transactionDisplayTitle } from "@/features/transactions/format";
import {
  markTransactionPaidAction,
  updateTransactionAction,
  type MarkPaidFormState,
  type UpdateTransactionFormState,
} from "@/features/transactions/api/actions";

const initialUpdateState: UpdateTransactionFormState = {};
const initialMarkPaidState: MarkPaidFormState = {};

export function TransactionRow({
  transaction,
  accountName,
  categoryName,
}: {
  transaction: {
    id: string;
    payee: string | null;
    kind: string;
    transferAccountId: string | null;
    accountId: string;
    amount: Money;
    currencyCode: string;
    occurredOn: string;
    status: string;
    memo: string | null;
    cycleMonth: string | null;
    splits: { categoryId: string }[];
  };
  accountName: Map<string, string>;
  categoryName: Map<string, string>;
}) {
  const [editing, setEditing] = useState(false);
  const [updateState, updateAction, isUpdatePending] = useActionState(
    updateTransactionAction,
    initialUpdateState,
  );
  const [markPaidState, markPaidAction, isMarkPaidPending] = useActionState(
    markTransactionPaidAction,
    initialMarkPaidState,
  );

  useEffect(() => {
    if (updateState.success) {
      setEditing(false);
    }
  }, [updateState.success]);

  if (editing) {
    return (
      <li className="flex flex-wrap items-end gap-3 border-b border-line bg-bg px-[18px] py-3.5 last:border-b-0">
        <form
          action={updateAction}
          className="flex w-full flex-wrap items-end gap-3"
        >
          <input type="hidden" name="id" value={transaction.id} />
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-ink-faint">
              Amount
            </label>
            <input
              name="amount"
              defaultValue={transaction.amount}
              inputMode="decimal"
              required
              className="h-9 w-28 rounded-xl border-[1.5px] border-line px-2.5 font-display text-sm font-bold"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-ink-faint">
              Date
            </label>
            <input
              name="occurredOn"
              type="date"
              defaultValue={transaction.occurredOn}
              required
              className="h-9 rounded-xl border-[1.5px] border-line px-2.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-ink-faint">
              Counts toward
            </label>
            <select
              name="cycleMonth"
              defaultValue={transaction.cycleMonth ?? "untagged"}
              className="h-9 rounded-xl border-[1.5px] border-line px-2.5 text-sm"
            >
              <option value="untagged">
                Untagged &mdash; not counted anywhere
              </option>
              {monthOptions(8, -2).map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label} cycle
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-[140px] flex-1 flex-col gap-1">
            <label className="text-[10px] font-semibold text-ink-faint">
              Note (optional)
            </label>
            <input
              name="memo"
              defaultValue={transaction.memo ?? ""}
              placeholder="e.g. paying early from July salary"
              className="h-9 rounded-xl border-[1.5px] border-line px-2.5 text-sm"
            />
          </div>
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

  return (
    <li className="flex items-center justify-between gap-3 border-b border-line px-[18px] py-3.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {transactionDisplayTitle(transaction, accountName)}
        </p>
        <p className="text-xs text-ink-faint">
          {transaction.occurredOn} &middot;{" "}
          {accountName.get(transaction.accountId)}
          {transaction.status === "pending" && " · Scheduled"}
          {transaction.cycleMonth ? (
            ` \u00b7 ${shortMonthLabel(transaction.cycleMonth)} cycle`
          ) : (
            <span className="text-negative">
              {" "}
              &middot; Untagged &mdash; not counted
            </span>
          )}
          {transaction.memo && ` \u00b7 ${transaction.memo}`}
          {transaction.splits.length > 0 &&
            ` \u00b7 ${transaction.splits
              .map(
                (split) =>
                  categoryName.get(split.categoryId) ?? "Uncategorized",
              )
              .join(", ")}`}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <div className="flex items-center gap-2">
          <p
            className={`whitespace-nowrap font-display text-[15px] font-bold ${
              transaction.kind === "income" ? "text-positive" : "text-negative"
            }`}
          >
            {transaction.kind === "income" ? "+" : "\u2212"}
            {formatMoneyDisplay(transaction.amount, transaction.currencyCode)}
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex size-[26px] items-center justify-center rounded-full bg-bg text-xs text-ink-soft"
            aria-label="Edit"
          >
            &#9998;
          </button>
        </div>
        {transaction.status === "pending" && (
          <form action={markPaidAction}>
            <input type="hidden" name="id" value={transaction.id} />
            <button
              type="submit"
              disabled={isMarkPaidPending}
              className="flex items-center gap-1 rounded-full bg-positive-soft px-2.5 py-1 font-display text-[10px] font-bold text-positive disabled:opacity-70"
            >
              {isMarkPaidPending && <Spinner className="size-3" />}
              Mark paid
            </button>
            {markPaidState.error && (
              <p className="mt-1 text-[10px] text-negative">
                {markPaidState.error}
              </p>
            )}
          </form>
        )}
      </div>
    </li>
  );
}
