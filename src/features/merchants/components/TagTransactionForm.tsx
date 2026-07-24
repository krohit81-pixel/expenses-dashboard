"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  tagTransactionAction,
  type MerchantFormState,
} from "@/features/merchants/api/actions";
import type { MerchantSummary } from "@/services/MerchantService";

const initialState: MerchantFormState = {};

/**
 * Manually assigns a merchant to a transaction that doesn't have one --
 * v1.2.1. Shows up only for transactions with no merchant_id (e.g. an
 * IGST/FX-fee line, deliberately never auto-tagged at import time --
 * see tagTransactionToMerchant's own comment on why). Picks from every
 * merchant, not just ones already used on this card/category, since
 * the household's own example (tagging a new card's FX charges to the
 * same "FX Charges" merchant an older card's charges already use) is
 * exactly a cross-card merge.
 */
export function TagTransactionForm({
  transactionId,
  merchants,
}: {
  transactionId: string;
  merchants: MerchantSummary[];
}) {
  const [state, action, isPending] = useActionState(
    tagTransactionAction,
    initialState,
  );

  return (
    <form action={action} className="mt-1.5 flex items-center gap-1.5">
      <input type="hidden" name="transactionId" value={transactionId} />
      <Select name="merchantId" defaultValue="" className="h-8 text-xs">
        <option value="" disabled>
          Tag to merchant…
        </option>
        {merchants.map((m) => (
          <option key={m.id} value={m.id}>
            {m.displayName}
          </option>
        ))}
      </Select>
      <Button type="submit" size="sm" loading={isPending}>
        Tag
      </Button>
      {state.error && <p className="text-xs text-negative">{state.error}</p>}
    </form>
  );
}
