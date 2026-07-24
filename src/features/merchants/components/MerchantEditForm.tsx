"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type {
  AtlasCategory,
  MerchantSummary,
} from "@/services/MerchantService";
import {
  setMerchantActiveAction,
  updateMerchantAction,
  type MerchantFormState,
} from "@/features/merchants/api/actions";

const initialState: MerchantFormState = {};

/**
 * The merchant edit form (display name, category/subcategory, type,
 * recurring/subscription flags) plus the activate/deactivate toggle --
 * extracted out of MerchantListRow so the merchant detail page (v1.2's
 * "I need one option to edit the merchant as well, as we have it on
 * the main merchant tab") can show the exact same form without
 * duplicating it. onSaved/onCancel let each caller decide what
 * "done editing" means for its own layout (MerchantListRow collapses
 * back to its static row; the detail page's MerchantOverviewCard does
 * the same for its own view).
 */
export function MerchantEditForm({
  merchant,
  categories,
  onCancel,
  onSaved,
}: {
  merchant: MerchantSummary;
  categories: AtlasCategory[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    merchant.atlasCategoryId ?? "",
  );
  const [updateState, updateAction, isUpdatePending] = useActionState(
    updateMerchantAction,
    initialState,
  );
  const [activeState, activeAction, isActivePending] = useActionState(
    setMerchantActiveAction,
    initialState,
  );

  useEffect(() => {
    if (updateState.success) onSaved();
    // onSaved is a fresh closure every render in both callers; only
    // updateState.success actually determines when this should fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateState.success]);

  const topLevelCategories = categories.filter((c) => !c.parentCategoryId);
  const subcategories = categories.filter(
    (c) => c.parentCategoryId === selectedCategoryId,
  );

  return (
    <div>
      <form action={updateAction} className="space-y-3">
        <input type="hidden" name="merchantId" value={merchant.id} />
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-ink-faint">
            Display name
          </label>
          <input
            name="displayName"
            defaultValue={merchant.displayName}
            className="h-10 w-full rounded-xl border-[1.5px] border-line bg-surface px-3 text-sm text-ink"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-faint">
              Category
            </label>
            <Select
              name="atlasCategoryId"
              value={selectedCategoryId}
              onChange={(event) => setSelectedCategoryId(event.target.value)}
            >
              <option value="">No category</option>
              {topLevelCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.categoryName}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-faint">
              Subcategory
            </label>
            <Select
              name="atlasSubcategoryId"
              defaultValue={merchant.atlasSubcategoryId ?? ""}
              disabled={subcategories.length === 0}
            >
              <option value="">No subcategory</option>
              {subcategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.categoryName}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-ink-faint">
            Merchant type
          </label>
          <input
            name="merchantType"
            defaultValue={merchant.merchantType ?? ""}
            placeholder="e.g. SaaS, restaurant, utility…"
            className="h-10 w-full rounded-xl border-[1.5px] border-line bg-surface px-3 text-sm text-ink"
          />
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-ink-soft">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isRecurring"
              defaultChecked={merchant.isRecurring}
              className="size-4 rounded border-line accent-accent"
            />
            Recurring
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isSubscription"
              defaultChecked={merchant.isSubscription}
              className="size-4 rounded border-line accent-accent"
            />
            Subscription
          </label>
        </div>

        {updateState.error && (
          <p className="text-xs text-negative">{updateState.error}</p>
        )}

        <div className="flex gap-2 pt-1">
          <Button type="submit" size="sm" loading={isUpdatePending}>
            Save
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>

      {/* Sibling form, not nested inside the edit form above -- HTML
          forms can't nest, and a deactivate action here is deliberately
          independent of whatever's unsaved in the edit fields. */}
      <form action={activeAction} className="mt-2 flex items-center gap-2">
        <input type="hidden" name="merchantId" value={merchant.id} />
        <input
          type="hidden"
          name="active"
          value={merchant.active ? "false" : "true"}
        />
        <Button
          type="submit"
          variant="destructive"
          size="sm"
          loading={isActivePending}
        >
          {merchant.active ? "Deactivate" : "Reactivate"}
        </Button>
        {activeState.error && (
          <p className="text-xs text-negative">{activeState.error}</p>
        )}
      </form>
    </div>
  );
}
