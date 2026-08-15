"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatMoneyDisplay } from "@/lib/money";
import {
  mergeSuggestedMerchantAction,
  type MergeSuggestionActionState,
} from "@/features/merchants/api/actions";
import { MerchantEditForm } from "@/features/merchants/components/MerchantEditForm";
import type {
  AtlasCategory,
  MerchantSummary,
} from "@/services/MerchantService";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatIsoDate(iso: string): string {
  return DATE_FORMATTER.format(new Date(`${iso}T00:00:00Z`));
}

const mergeInitialState: MergeSuggestionActionState = {};

/**
 * v2.5.7: "Merge" sits right next to "Edit" — merging used to only be
 * reachable from a merchant's own detail page (MergeMerchantForm,
 * `/merchants/[id]`), which the household explicitly didn't want:
 * "dont want to hop multiple screens to get that done." This reuses
 * mergeSuggestedMerchantAction (the no-redirect merge action built for
 * MerchantMergeSuggestions) rather than mergeMerchantsAction — that one
 * redirects to the target's detail page on success, correct for a form
 * submitted FROM the source's own page (which 404s post-merge), wrong
 * here: this row's parent list should stay exactly where it is.
 */
export function MerchantListRow({
  merchant,
  categories,
  allMerchants,
  selected,
  onToggleSelect,
}: {
  merchant: MerchantSummary;
  categories: AtlasCategory[];
  allMerchants: MerchantSummary[];
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "merge">("view");
  const [mergeState, mergeAction, mergePending] = useActionState(
    mergeSuggestedMerchantAction,
    mergeInitialState,
  );

  const category = categories.find((c) => c.id === merchant.atlasCategoryId);
  const subcategory = categories.find(
    (c) => c.id === merchant.atlasSubcategoryId,
  );

  if (mode === "edit") {
    return (
      <li className="border-b border-line px-[18px] py-3.5 last:border-b-0">
        <MerchantEditForm
          merchant={merchant}
          categories={categories}
          onCancel={() => setMode("view")}
          onSaved={() => setMode("view")}
        />
      </li>
    );
  }

  if (mode === "merge") {
    const otherMerchants = allMerchants.filter((m) => m.id !== merchant.id);
    return (
      <li className="border-b border-line px-[18px] py-3.5 last:border-b-0">
        <p className="mb-2 truncate text-sm font-semibold text-ink">
          Merge &ldquo;{merchant.displayName}&rdquo; into…
        </p>
        {mergeState.success ? (
          <p className="text-sm text-ink-soft">
            Merged — this merchant no longer exists on its own.
          </p>
        ) : (
          <form action={mergeAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="sourceMerchantId" value={merchant.id} />
            <Select
              name="targetMerchantId"
              defaultValue=""
              required
              className="min-w-[200px] flex-1"
            >
              <option value="" disabled>
                Choose a merchant…
              </option>
              {otherMerchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </Select>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              loading={mergePending}
            >
              Merge
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMode("view")}
            >
              Cancel
            </Button>
            {mergeState.error && (
              <p className="w-full text-xs text-negative">{mergeState.error}</p>
            )}
          </form>
        )}
      </li>
    );
  }

  return (
    <li className="flex gap-3 border-b border-line px-[18px] py-3.5 last:border-b-0">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        aria-label={`Select ${merchant.displayName}`}
        className="mt-1 size-4 shrink-0 accent-accent"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link
              href={`/merchants/${merchant.id}`}
              className="block truncate text-sm font-semibold text-ink hover:underline"
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
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMode("merge")}
            >
              Merge
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMode("edit")}
            >
              Edit
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}
