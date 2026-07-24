"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatMoneyDisplay } from "@/lib/money";
import { MerchantEditForm } from "@/features/merchants/components/MerchantEditForm";
import type { AtlasCategory, MerchantDetail } from "@/services/MerchantService";

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
 * The merchant detail page's Overview section -- v1.2, at the
 * household's request for an edit option directly here, not just on
 * the Merchants list row ("I need one option to edit the merchant as
 * well, as we have it on the main merchant tab"). Same MerchantEditForm
 * MerchantListRow uses, just toggled from this card's own Edit button
 * instead of a list row's.
 */
export function MerchantOverviewCard({
  merchant,
  categories,
}: {
  merchant: MerchantDetail;
  categories: AtlasCategory[];
}) {
  const [editing, setEditing] = useState(false);

  const category = categories.find((c) => c.id === merchant.atlasCategoryId);
  const subcategory = categories.find(
    (c) => c.id === merchant.atlasSubcategoryId,
  );

  return (
    <section className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-[15px] font-bold text-ink">
          Overview
        </h2>
        {!editing && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
        )}
      </div>

      {editing ? (
        <MerchantEditForm
          merchant={merchant}
          categories={categories}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-ink-faint">Category</dt>
            <dd
              className={category ? "text-ink" : "font-semibold text-negative"}
            >
              {category ? category.categoryName : "Uncategorized"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Subcategory</dt>
            <dd className="text-ink">{subcategory?.categoryName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Recurring</dt>
            <dd className="text-ink">{merchant.isRecurring ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Subscription</dt>
            <dd className="text-ink">
              {merchant.isSubscription ? "Yes" : "No"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Average transaction</dt>
            <dd className="text-ink">
              {formatMoneyDisplay(
                merchant.averageTransaction,
                merchant.defaultCurrency,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Status</dt>
            <dd className="text-ink">
              {merchant.active ? "Active" : "Deactivated"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">First seen</dt>
            <dd className="text-ink">
              {merchant.firstTransactionDate
                ? formatIsoDate(merchant.firstTransactionDate)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Last seen</dt>
            <dd className="text-ink">
              {merchant.lastTransactionDate
                ? formatIsoDate(merchant.lastTransactionDate)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Cards used</dt>
            <dd className="text-ink">
              {merchant.cardsUsed.length > 0
                ? merchant.cardsUsed.join(", ")
                : "—"}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
