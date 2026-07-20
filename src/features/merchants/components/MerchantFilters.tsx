import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { AtlasCategory } from "@/services/MerchantService";

/**
 * A plain GET form, not client-side state — search/category/uncategorized
 * all live in the URL (see the page's searchParams), so the filtered view
 * is linkable (the Imports page's "review now" link after a save points
 * straight at ?filter=uncategorized) and survives a refresh.
 */
export function MerchantFilters({
  categories,
  search,
  categoryId,
  uncategorizedOnly,
}: {
  categories: AtlasCategory[];
  search: string;
  categoryId: string;
  uncategorizedOnly: boolean;
}) {
  return (
    <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]" method="get">
      <div className="space-y-1.5">
        <Label htmlFor="merchant-search">Search</Label>
        <Input
          id="merchant-search"
          name="search"
          defaultValue={search}
          placeholder="Merchant name…"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="merchant-category">Category</Label>
        <Select
          id="merchant-category"
          name="category"
          defaultValue={categoryId}
          disabled={uncategorizedOnly}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.parentCategoryId
                ? ` ${category.categoryName}`
                : category.categoryName}
            </option>
          ))}
        </Select>
      </div>
      <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-ink-soft">
        <input
          type="checkbox"
          name="filter"
          value="uncategorized"
          defaultChecked={uncategorizedOnly}
          className="size-4 rounded border-line accent-accent"
        />
        Uncategorized only
      </label>
      <Button type="submit" className="self-end">
        Apply
      </Button>
    </form>
  );
}
