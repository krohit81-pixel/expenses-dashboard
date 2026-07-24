"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatMoneyDisplay } from "@/lib/money";
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

export function MerchantListRow({
  merchant,
  categories,
}: {
  merchant: MerchantSummary;
  categories: AtlasCategory[];
}) {
  const [editing, setEditing] = useState(false);

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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="border-b border-line px-[18px] py-3.5 last:border-b-0">
      <MerchantEditForm
        merchant={merchant}
        categories={categories}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
      />
    </li>
  );
}
