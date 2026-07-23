import type { Metadata } from "next";
import { Fragment } from "react";

import { Hero } from "@/components/ui/hero";
import { AddCategoryForm } from "@/features/categories/components/AddCategoryForm";
import { CategoryListRow } from "@/features/categories/components/CategoryListRow";
import { listAllAtlasCategories } from "@/services/MerchantService";

export const metadata: Metadata = {
  title: "Categories",
};

/**
 * The Merchant Dictionary's reference-data screen (v1.2): rename,
 * add, or deactivate/reactivate an atlas_categories row -- e.g. the
 * household's own example, renaming "Groceries" to "Groceries & Food
 * Delivery". The 22 top-level categories are already preloaded via
 * scripts/seed-atlas-categories.mjs; this screen doesn't re-seed
 * anything, it just lets you edit what's already there. Every
 * merchant's category and every Card-level breakdown donut reads
 * straight from this table, so a rename here shows up everywhere
 * immediately -- no separate "apply" step.
 */
export default async function CategoriesPage() {
  const categories = await listAllAtlasCategories();
  const topLevel = categories.filter((c) => !c.parentCategoryId);
  const byParent = new Map<string, typeof categories>();
  for (const c of categories) {
    if (!c.parentCategoryId) continue;
    const siblings = byParent.get(c.parentCategoryId) ?? [];
    siblings.push(c);
    byParent.set(c.parentCategoryId, siblings);
  }

  return (
    <div>
      <Hero title="Categories" sub={`${categories.length} categories`} />
      <div className="space-y-4 p-5 sm:p-8">
        <div className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <h2 className="mb-3 font-display text-[15px] font-bold text-ink">
            Add category
          </h2>
          <AddCategoryForm
            topLevelCategories={topLevel.filter((c) => c.active)}
          />
        </div>

        <ul className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          {topLevel.map((category) => (
            <Fragment key={category.id}>
              <CategoryListRow category={category} isSubcategory={false} />
              {(byParent.get(category.id) ?? []).map((sub) => (
                <CategoryListRow key={sub.id} category={sub} isSubcategory />
              ))}
            </Fragment>
          ))}
        </ul>
      </div>
    </div>
  );
}
