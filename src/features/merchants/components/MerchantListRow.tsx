"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatMoneyDisplay } from "@/lib/money";
import type { AtlasCategory } from "@/services/MerchantService";
import {
  setMerchantActiveAction,
  updateMerchantAction,
  type MerchantFormState,
} from "@/features/merchants/api/actions";
import type { MerchantSummary } from "@/services/MerchantService";

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

export function MerchantListRow({
  merchant,
  categories,
}: {
  merchant: MerchantSummary;
  categories: AtlasCategory[];
}) {
  const [editing, setEditing] = useState(false);
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
    if (updateState.success) setEditing(false);
  }, [updateState.success]);

  const topLevelCategories = categories.filter((c) => !c.parentCategoryId);
  const subcategories = categories.filter(
    (c) => c.parentCategoryId === selectedCategoryId,
  );
  const category = categories.find((c) => c.id === merchant.atlasCategoryId);
  const subcategory = categories.find(
    (c) => c.id === merchant.atlasSubcategoryId,
  );

  if (!editing) {
    return (
      <li className="flex flex-col gap-2 border-b border-line px-[18px] py-3.5 last:border-b-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link
              href={`/merchants/${merchant.id}`}
              className="truncate text-sm font-semibold text-ink hover:underline"
            >
              {merchant.displayName}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
              {category ? (
                <span>
                  {category.categoryName}
                  {subcategory ? ` › ${subcategory.categoryName}` : ""}
                </span>
              ) : (
                <span className="font-semibold text-negative">
                  Uncategorized
                </span>
              )}
              {merchant.isRecurring && <span>· Recurring</span>}
              {merchant.isSubscription && <span>· Subscription</span>}
              {!merchant.active && <span>· Deactivated</span>}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-display text-sm font-bold text-ink">
              {formatMoneyDisplay(
                merchant.totalSpend,
                merchant.defaultCurrency,
              )}
            </div>
            <div className="text-xs text-ink-faint">
              {merchant.transactionCount}{" "}
              {merchant.transactionCount === 1 ? "transaction" : "transactions"}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-ink-faint">
          <span>
            {merchant.lastTransactionDate
              ? `Last seen ${formatIsoDate(merchant.lastTransactionDate)}`
              : "No transactions yet"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedCategoryId(merchant.atlasCategoryId ?? "");
              setEditing(true);
            }}
          >
            Edit
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="border-b border-line px-[18px] py-3.5 last:border-b-0">
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        </div>
      </form>

      {/* Sibling form, not nested inside the edit form above — HTML
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
    </li>
  );
}
