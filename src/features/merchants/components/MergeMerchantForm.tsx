"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  mergeMerchantsAction,
  type MerchantFormState,
} from "@/features/merchants/api/actions";
import type { MerchantSummary } from "@/services/MerchantService";

const initialState: MerchantFormState = {};

export function MergeMerchantForm({
  sourceMerchantId,
  otherMerchants,
}: {
  sourceMerchantId: string;
  otherMerchants: MerchantSummary[];
}) {
  const [state, action, isPending] = useActionState(
    mergeMerchantsAction,
    initialState,
  );

  if (state.success) {
    return (
      <p className="text-sm text-ink-soft">
        Merged — this merchant no longer exists on its own.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="sourceMerchantId" value={sourceMerchantId} />
      <div className="min-w-[220px] flex-1 space-y-1.5">
        <label className="text-xs font-semibold text-ink-faint">
          Merge into
        </label>
        <Select name="targetMerchantId" defaultValue="">
          <option value="" disabled>
            Choose a merchant…
          </option>
          {otherMerchants.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" variant="destructive" loading={isPending}>
        Merge
      </Button>
      {state.error && (
        <p className="w-full text-xs text-negative">{state.error}</p>
      )}
    </form>
  );
}
