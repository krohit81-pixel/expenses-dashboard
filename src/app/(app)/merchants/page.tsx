import type { Metadata } from "next";

import { Hero } from "@/components/ui/hero";
import { MerchantFilters } from "@/features/merchants/components/MerchantFilters";
import { MerchantListWithSelection } from "@/features/merchants/components/MerchantListWithSelection";
import { MerchantMergeSuggestions } from "@/features/merchants/components/MerchantMergeSuggestions";
import {
  listAtlasCategories,
  listCreditCardCycleMonths,
  listMerchants,
  listMerchantTypes,
} from "@/services/MerchantService";

export const metadata: Metadata = {
  title: "Merchants",
};

interface MerchantsPageProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    filter?: string;
    merchantType?: string;
    cycleMonth?: string;
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
 *
 * v2.5.5: MerchantMergeSuggestions up top — the deterministic resolver
 * only ever matches exact alias/name text, so any statement-text
 * variation spawns a brand-new "unmapped" merchant instead of being
 * recognized as one already known. That button asks an LLM to propose
 * which unmapped merchants are probably an existing one under different
 * wording; see MerchantMergeSuggestionService for the "advisory only,
 * never merges by itself" boundary.
 *
 * v2.5.7: merging moved onto this list itself — a "Merge" button next
 * to "Edit" on every row (no detour through a merchant's own detail
 * page), plus checkbox multi-select with a "Merge N into…" bar for
 * clearing several unmapped merchants into one existing merchant at
 * once. Fetches the merchant list a second time, unfiltered
 * (allMerchants) — merge-target dropdowns need every merchant
 * regardless of whatever filter is currently narrowing the visible
 * list, see MerchantListWithSelection's own comment.
 */
export default async function MerchantsPage({
  searchParams,
}: MerchantsPageProps) {
  const params = await searchParams;
  const search = params.search ?? "";
  const categoryId = params.category ?? "";
  const uncategorizedOnly = params.filter === "uncategorized";
  const merchantType = params.merchantType ?? "";
  const cycleMonth = params.cycleMonth ?? "";

  const [categories, merchantTypes, cycleMonths, merchants, allMerchants] =
    await Promise.all([
      listAtlasCategories(),
      listMerchantTypes(),
      listCreditCardCycleMonths(),
      listMerchants({
        search: search || undefined,
        categoryId: categoryId || undefined,
        uncategorizedOnly,
        merchantType: merchantType || undefined,
        cycleMonth: cycleMonth || undefined,
      }),
      listMerchants(),
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
        <MerchantMergeSuggestions />

        <div className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <MerchantFilters
            categories={categories}
            search={search}
            categoryId={categoryId}
            uncategorizedOnly={uncategorizedOnly}
            merchantTypes={merchantTypes}
            merchantType={merchantType}
            cycleMonths={cycleMonths}
            cycleMonth={cycleMonth}
          />
        </div>

        {merchants.length === 0 ? (
          <p className="px-1 text-sm text-ink-faint">
            No merchants match these filters yet.
          </p>
        ) : (
          <MerchantListWithSelection
            merchants={merchants}
            allMerchants={allMerchants}
            categories={categories}
          />
        )}
      </div>
    </div>
  );
}
