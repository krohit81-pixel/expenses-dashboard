"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { formatMoneyDisplay } from "@/lib/money";
import {
  untagTransactionAction,
  type MerchantFormState,
} from "@/features/merchants/api/actions";
import type { MerchantTransactionRow as MerchantTransactionRowData } from "@/services/MerchantService";

const initialState: MerchantFormState = {};

const DATE_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatIsoDate(iso: string): string {
  return DATE_FORMATTER.format(new Date(`${iso}T00:00:00Z`));
}

/**
 * One row in a merchant's "Recent transactions" list, with an Untag
 * action -- removes just this transaction's merchant assignment
 * (merchant_id -> null) without touching any other transaction tagged
 * to the same merchant. Split out of the detail page into its own
 * client component only because the untag button needs
 * useActionState; everything else here is the same static row the
 * page used to render inline.
 */
export function MerchantTransactionRow({
  merchantId,
  txn,
}: {
  merchantId: string;
  txn: MerchantTransactionRowData;
}) {
  const [state, action, isPending] = useActionState(
    untagTransactionAction,
    initialState,
  );

  return (
    <li className="py-2.5 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-ink">{txn.description}</div>
          <div className="text-xs text-ink-faint">
            {formatIsoDate(txn.transactionDate)} · {txn.cardLabel}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div
            className={`font-display text-sm font-bold ${txn.transactionType === "credit" ? "text-positive" : "text-ink"}`}
          >
            {formatMoneyDisplay(txn.amount, txn.currency)}
          </div>
          <form action={action}>
            <input type="hidden" name="transactionId" value={txn.id} />
            <input type="hidden" name="merchantId" value={merchantId} />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              loading={isPending}
              title="Remove this merchant tag from this transaction"
            >
              Untag
            </Button>
          </form>
        </div>
      </div>
      {state.error && (
        <p className="mt-1 text-xs text-negative">{state.error}</p>
      )}
    </li>
  );
}
