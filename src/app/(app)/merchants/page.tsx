import type { Metadata } from "next";

import { Hero } from "@/components/ui/hero";
import { MerchantFilters } from "@/features/merchants/components/MerchantFilters";
import { MerchantListRow } from "@/features/merchants/components/MerchantListRow";
import { listAtlasCategories, listMerchants } from "@/services/MerchantService";

export const metadata: Metadata = {
  title: "Merchants",
};

interface MerchantsPageProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    filter?: string;
  }>;
}

/**
 * The Merchant Dictionary's admin screen: every merchant Atlas has ever
 * seen across every imported statement, searchable and filterable, with
 * inline editing for category/subcategory/recurring/subscription and a
 * deactivate toggle. See src/services/MerchantService.ts and
 * src/services/MerchantDictionaryService.ts for how a merchant gets
 * here in the first place — nothing on this page is HDFC-specific;
 * every future card parser feeds the same dictionary.
 */
export default async function MerchantsPage({
  searchParams,
}: MerchantsPageProps) {
  const params = await searchParams;
  const search = params.search ?? "";
  const categoryId = params.category ?? "";
  const uncategorizedOnly = params.filter === "uncategorized";

  const [categories, merchants] = await Promise.all([
    listAtlasCategories(),
    listMerchants({
      search: search || undefined,
      categoryId: categoryId || undefined,
      uncategorizedOnly,
    }),
  ]);

  const uncategorizedCount = merchants.filter(
    (m) => m.atlasCategoryId === null,
  ).length;

  return (
    <div>
      <Hero
        title="Merchants"
        label={merchants.length === 0 ? undefined : "Merchants"}
        amount={merchants.length === 0 ? undefined : String(merchants.length)}
        sub={
          uncategorizedOnly
            ? undefined
            : uncategorizedCount > 0
              ? `${uncategorizedCount} need${uncategorizedCount === 1 ? "s" : ""} a category`
              : undefined
        }
      />
      <div className="space-y-4 p-5 sm:p-8">
        <div className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <MerchantFilters
            categories={categories}
            search={search}
            categoryId={categoryId}
            uncategorizedOnly={uncategorizedOnly}
          />
        </div>

        {merchants.length === 0 ? (
          <p className="px-1 text-sm text-ink-faint">
            No merchants match these filters yet.
          </p>
        ) : (
          <ul className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
            {merchants.map((merchant) => (
              <MerchantListRow
                key={merchant.id}
                merchant={merchant}
                categories={categories}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
