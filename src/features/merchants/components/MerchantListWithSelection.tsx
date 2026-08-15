"use client";

import { useActionState, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  bulkMergeMerchantsAction,
  type BulkMergeFormState,
} from "@/features/merchants/api/actions";
import { MerchantListRow } from "@/features/merchants/components/MerchantListRow";
import type {
  AtlasCategory,
  MerchantSummary,
} from "@/services/MerchantService";

/**
 * v2.5.7: owns the checkbox selection that spans multiple
 * MerchantListRows — selection state has to live above the list itself
 * (a Server Component can't hold client state), so this thin client
 * wrapper is what /merchants renders instead of mapping rows directly.
 * At the household's request: select several unmapped merchants at
 * once and merge them all into one existing merchant in a single
 * action, rather than one pair at a time.
 */
export function MerchantListWithSelection({
  merchants,
  allMerchants,
  categories,
}: {
  /** The current (possibly filtered) list — what's rendered/selectable. */
  merchants: MerchantSummary[];
  /** Unfiltered — merge-target dropdowns need every merchant regardless
   * of the active filter. Without this, viewing the "uncategorized
   * only" filter (exactly the view this feature is built for) would
   * only ever offer *other* uncategorized merchants as a merge target,
   * hiding the categorized ones you'd actually want to merge into. */
  allMerchants: MerchantSummary[];
  categories: AtlasCategory[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <BulkMergeBar
          key={Array.from(selected).sort().join(",")}
          selectedIds={Array.from(selected)}
          merchants={allMerchants}
          onDone={clear}
        />
      )}

      <ul className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
        {merchants.map((merchant) => (
          <MerchantListRow
            key={merchant.id}
            merchant={merchant}
            categories={categories}
            allMerchants={allMerchants}
            selected={selected.has(merchant.id)}
            onToggleSelect={() => toggle(merchant.id)}
          />
        ))}
      </ul>
    </div>
  );
}

const bulkMergeInitialState: BulkMergeFormState = {};

function BulkMergeBar({
  selectedIds,
  merchants,
  onDone,
}: {
  selectedIds: string[];
  merchants: MerchantSummary[];
  onDone: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    bulkMergeMerchantsAction,
    bulkMergeInitialState,
  );

  // Effect, not a call during render — see MerchantMergeSuggestions'
  // SuggestionRow for the same pattern and why (updating a different
  // component's state mid-render breaks React's render-must-be-pure
  // rule).
  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  const targetOptions = merchants.filter((m) => !selectedIds.includes(m.id));
  const selectedNames = merchants
    .filter((m) => selectedIds.includes(m.id))
    .map((m) => m.displayName)
    .join(", ");

  return (
    <form
      action={formAction}
      className="sticky top-2 z-10 space-y-2 rounded-[16px] border-[1.5px] border-accent bg-surface p-3.5 shadow-[0_4px_14px_rgba(28,20,36,0.12)]"
    >
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="sourceMerchantId" value={id} />
      ))}

      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-xs font-bold text-ink">
          {selectedIds.length} selected
        </p>
        <button
          type="button"
          onClick={onDone}
          className="font-display text-xs font-bold text-ink-faint"
        >
          Clear
        </button>
      </div>
      <p className="truncate text-xs text-ink-faint">{selectedNames}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          name="targetMerchantId"
          defaultValue=""
          required
          className="min-w-[200px] flex-1"
        >
          <option value="" disabled>
            Merge all into…
          </option>
          {targetOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </Select>
        <Button
          type="submit"
          variant="destructive"
          size="sm"
          loading={isPending}
        >
          Merge {selectedIds.length}
        </Button>
      </div>

      {state.error && <p className="text-xs text-negative">{state.error}</p>}
    </form>
  );
}
