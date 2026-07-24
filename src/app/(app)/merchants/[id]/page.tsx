import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Hero } from "@/components/ui/hero";
import { formatMoneyDisplay } from "@/lib/money";
import { MergeMerchantForm } from "@/features/merchants/components/MergeMerchantForm";
import { MerchantOverviewCard } from "@/features/merchants/components/MerchantOverviewCard";
import { MerchantTransactionRow } from "@/features/merchants/components/MerchantTransactionRow";
import {
  getMerchantDetail,
  listAtlasCategories,
  listMerchants,
} from "@/services/MerchantService";

interface MerchantDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: MerchantDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const merchant = await getMerchantDetail(id);
  return { title: merchant ? merchant.displayName : "Merchant" };
}

export default async function MerchantDetailPage({
  params,
}: MerchantDetailPageProps) {
  const { id } = await params;

  const [merchant, categories, allMerchants] = await Promise.all([
    getMerchantDetail(id),
    listAtlasCategories(),
    listMerchants(),
  ]);

  if (!merchant) notFound();

  const otherMerchants = allMerchants.filter((m) => m.id !== merchant.id);

  return (
    <div>
      <Hero
        title={merchant.displayName}
        label="Total spend"
        amount={formatMoneyDisplay(
          merchant.totalSpend,
          merchant.defaultCurrency,
        )}
        sub={`${merchant.transactionCount} transaction${merchant.transactionCount === 1 ? "" : "s"}`}
      />
      <div className="space-y-4 p-5 sm:p-8">
        <Link
          href="/merchants"
          className="text-xs text-ink-faint hover:underline"
        >
          ← All merchants
        </Link>

        <MerchantOverviewCard merchant={merchant} categories={categories} />

        <section className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <h2 className="mb-3 font-display text-[15px] font-bold text-ink">
            Aliases ({merchant.aliases.length})
          </h2>
          {merchant.aliases.length === 0 ? (
            <p className="text-sm text-ink-faint">
              No raw text variants recorded yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {merchant.aliases.map((alias) => (
                <li
                  key={alias.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="font-mono text-xs text-ink-soft">
                    {alias.alias}
                  </span>
                  <span className="shrink-0 text-xs text-ink-faint">
                    {alias.sourceBank ?? "unknown source"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <h2 className="mb-3 font-display text-[15px] font-bold text-ink">
            Recent transactions
          </h2>
          {merchant.recentTransactions.length === 0 ? (
            <p className="text-sm text-ink-faint">No transactions yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {merchant.recentTransactions.map((txn) => (
                <MerchantTransactionRow
                  key={txn.id}
                  merchantId={merchant.id}
                  txn={txn}
                />
              ))}
            </ul>
          )}
        </section>

        {otherMerchants.length > 0 && (
          <section className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
            <h2 className="mb-1 font-display text-[15px] font-bold text-ink">
              Merge duplicate
            </h2>
            <p className="mb-3 text-xs text-ink-faint">
              If this is the same real-world merchant as another entry (e.g. a
              variant that slipped past auto-matching), merge it into the other
              one. Every alias and transaction moves over; this merchant is
              deleted.
            </p>
            <MergeMerchantForm
              sourceMerchantId={merchant.id}
              otherMerchants={otherMerchants}
            />
          </section>
        )}
      </div>
    </div>
  );
}
