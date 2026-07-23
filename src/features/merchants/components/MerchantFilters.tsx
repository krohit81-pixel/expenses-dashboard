import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { monthLabel } from "@/lib/dates/month";
import type { AtlasCategory } from "@/services/MerchantService";

/**
 * A plain GET form, not client-side state — search/category/uncategorized
 * all live in the URL (see the page's searchParams), so the filtered view
 * is linkable (the Imports page's "review now" link after a save points
 * straight at ?filter=uncategorized) and survives a refresh.
 *
 * v1.2: merchant type and cycle month joined category/search/uncategorized
 * as URL-driven filters, same pattern as the rest of this form.
 */
export function MerchantFilters({
  categories,
  search,
  categoryId,
  uncategorizedOnly,
  merchantTypes,
  merchantType,
  cycleMonths,
  cycleMonth,
}: {
  categories: AtlasCategory[];
  search: string;
  categoryId: string;
  uncategorizedOnly: boolean;
  merchantTypes: string[];
  merchantType: string;
  cycleMonths: string[];
  cycleMonth: string;
}) {
  return (
    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" method="get">
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
      <div className="space-y-1.5">
        <Label htmlFor="merchant-type">Merchant type</Label>
        <Select
          id="merchant-type"
          name="merchantType"
          defaultValue={merchantType}
        >
          <option value="">All types</option>
          {merchantTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="merchant-cycle-month">Cycle month</Label>
        <Select
          id="merchant-cycle-month"
          name="cycleMonth"
          defaultValue={cycleMonth}
        >
          <option value="">All months</option>
          {cycleMonths.map((month) => (
            <option key={month} value={month}>
              {monthLabel(month)}
            </option>
          ))}
        </Select>
      </div>
      <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-ink-soft sm:col-span-2 lg:col-span-3">
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
