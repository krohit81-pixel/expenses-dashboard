import Link from "next/link";
import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/require-user";
import { getUserSettings } from "@/services/UserSettingsService";
import { getCardCategoryTransactions } from "@/services/CreditCardIntelService";
import { formatMoneyDisplay } from "@/lib/money";
import { isValidMonth, monthLabel } from "@/lib/dates/month";
import { Hero } from "@/components/ui/hero";

export const metadata: Metadata = {
  title: "Category detail",
};

interface CardCategoryPageProps {
  searchParams: Promise<{
    month?: string;
    card?: string;
    categories?: string;
    label?: string;
  }>;
}

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
 * The Card-level breakdown's drill-down: "when you click on groceries
 * on the donut chart...I would like to see the transactions, along
 * with merchants which have contributed to that number" (v1.2). Reached
 * only from a donut slice link built by cardCategoryHref in
 * ../page.tsx -- categories is a comma-joined list of atlas_categories
 * ids (see DonutSlice.categoryIds), since the clicked slice might be
 * the "Other" bucket folding several categories together; "" inside
 * that list means uncategorized, same convention used throughout the
 * Card-level breakdown. card is either "all" (the aggregate donut) or
 * one card's own cardKey (issuer|cardType|cardLast4).
 */
export default async function CardCategoryPage({
  searchParams,
}: CardCategoryPageProps) {
  const params = await searchParams;
  const month = isValidMonth(params.month) ? params.month : undefined;
  const cardKey =
    params.card && params.card !== "all" ? params.card : undefined;
  const label = params.label?.trim() || "Category";
  // A raw "" query param and a missing one both parse to [""] via
  // split(",") -- both mean "one uncategorized bucket", which is a
  // valid, real request (a slice made entirely of uncategorized spend),
  // not an error case. Only a genuinely missing `categories` param
  // (undefined) is treated as nothing-to-show below.
  const categoryIds =
    params.categories !== undefined ? params.categories.split(",") : null;

  const user = await requireUser();
  const settings = await getUserSettings(user.id);
  const currency = settings?.baseCurrency ?? "USD";

  const backHref = month ? `/intel?cardMonth=${month}` : "/intel";

  if (!month || categoryIds === null) {
    return (
      <div>
        <Hero title={label} />
        <div className="space-y-4 p-5 sm:p-8">
          <Link
            href={backHref}
            className="text-xs text-ink-faint hover:underline"
          >
            ← Back to Intel
          </Link>
          <p className="text-sm text-ink-faint">
            Missing month or category — go back to Intel and click a donut slice
            to get here.
          </p>
        </div>
      </div>
    );
  }

  const drilldown = await getCardCategoryTransactions({
    month,
    categoryIds,
    cardKey,
  });

  return (
    <div>
      <Hero
        title={label}
        label="Total spend"
        amount={formatMoneyDisplay(drilldown.totalSpend, currency)}
        sub={`${monthLabel(month)}${cardKey ? "" : " · All cards"}`}
      />
      <div className="space-y-4 p-5 sm:p-8">
        <Link
          href={backHref}
          className="text-xs text-ink-faint hover:underline"
        >
          ← Back to Intel
        </Link>

        <section className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <h2 className="mb-3 font-display text-[15px] font-bold text-ink">
            By merchant ({drilldown.byMerchant.length})
          </h2>
          {drilldown.byMerchant.length === 0 ? (
            <p className="text-sm text-ink-faint">No spend in this category.</p>
          ) : (
            <ul className="divide-y divide-line">
              {drilldown.byMerchant.map((m) => (
                <li
                  key={m.merchantId ?? m.displayName}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    {m.merchantId ? (
                      <Link
                        href={`/merchants/${m.merchantId}`}
                        className="block truncate font-semibold text-ink hover:underline"
                      >
                        {m.displayName}
                      </Link>
                    ) : (
                      <span className="block truncate font-semibold text-ink-faint">
                        {m.displayName}
                      </span>
                    )}
                    <div className="text-xs text-ink-faint">
                      {m.transactionCount}{" "}
                      {m.transactionCount === 1
                        ? "transaction"
                        : "transactions"}
                    </div>
                  </div>
                  <div className="shrink-0 font-display text-sm font-bold text-ink">
                    {formatMoneyDisplay(m.total, currency)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <h2 className="mb-3 font-display text-[15px] font-bold text-ink">
            Transactions ({drilldown.transactions.length})
          </h2>
          {drilldown.transactions.length === 0 ? (
            <p className="text-sm text-ink-faint">
              No transactions in this category for {monthLabel(month)}.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {drilldown.transactions.map((txn) => (
                <li
                  key={txn.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate text-ink">{txn.description}</div>
                    <div className="text-xs text-ink-faint">
                      {formatIsoDate(txn.transactionDate)} · {txn.cardLabel}
                      {txn.merchantDisplayName
                        ? ` · ${txn.merchantDisplayName}`
                        : ""}
                    </div>
                  </div>
                  <div className="shrink-0 font-display text-sm font-bold text-ink">
                    {formatMoneyDisplay(txn.amount, txn.currency)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
