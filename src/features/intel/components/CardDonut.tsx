import { buildDonutGradientStops, buildDonutSlices } from "@/lib/intel/donut";
import { formatMoneyDisplay, moneyToDbNumber, type Money } from "@/lib/money";
import { Spinner } from "@/components/ui/spinner";
import { DonutSliceLink } from "@/features/intel/components/DonutSliceLink";
import type { CardCategoryAmount } from "@/services/CreditCardIntelService";

/**
 * v3.8.0 — extracted from intel/page.tsx (where this originated as a
 * page-local `renderCardDonut` function) so the new /cards page can
 * import the exact same implementation instead of forking it. Intel's
 * own rendering is unchanged — it now imports CardDonut/CATEGORY_COLORS/
 * CardBreakdownSkeleton from here instead of defining them locally.
 *
 * Still exported: CATEGORY_COLORS, since intel/page.tsx's OTHER donuts
 * (the ledger-only "By category" section, untouched by this move) use
 * the same palette for visual consistency across the whole page — one
 * shared array, not two copies that could silently drift apart.
 */
export const CATEGORY_COLORS = [
  "#5b21b6",
  "#9061e0",
  "#17a054",
  "#e0355b",
  "#f0a63a",
  "#cabfd6",
];

function cardDonut(
  breakdown: { totalSpend: Money; byCategory: CardCategoryAmount[] },
  atlasCategoryName: Map<string, string>,
) {
  // buildDonutSlices expects a non-nullable categoryId; "" is never a
  // real atlas_categories id, so mapping null -> "" here reuses its
  // existing "no name found -> Uncategorized" fallback as-is, instead
  // of duplicating the top-5-plus-Other bucketing logic for a
  // nullable-id variant.
  const slices = buildDonutSlices(
    breakdown.byCategory.map((c) => ({
      categoryId: c.categoryId ?? "",
      total: c.total,
    })),
    atlasCategoryName,
  );
  const gradientStops = buildDonutGradientStops(
    slices,
    breakdown.totalSpend,
    CATEGORY_COLORS,
  );
  return { slices, gradientStops };
}

/** Builds the query string for one donut slice's drill-down link -- see the /intel/card-category route (unmoved, still the one detail page both /intel and /cards link into). Kept private: grep-confirmed zero callers outside this file's own CardDonut body -- there's no second consumer to share it with, both pages already get one implementation just by importing this module. */
function cardCategoryHref(params: {
  cardMonth: string;
  cardKey: string;
  categoryIds: string[];
  label: string;
}): string {
  const search = new URLSearchParams({
    month: params.cardMonth,
    card: params.cardKey,
    categories: params.categoryIds.join(","),
    label: params.label,
  });
  return `/intel/card-category?${search.toString()}`;
}

/**
 * v1.2: `variant` distinguishes the "All cards" aggregate donut (bolder,
 * slightly larger, an "Overall" badge -- the parent view) from each
 * individual card's own donut (the child breakdown below it) -- see the
 * household's request to "visually show overall card slightly more
 * parent/bolder...and separately its detailed credit cards below as
 * separate child section." `cardMonth`/`cardKeyForLink` build each
 * slice's click-through link to /intel/card-category (the "when you
 * click on groceries...I would like to see the transactions" request);
 * cardKeyForLink is "all" for the aggregate donut, or one card's own
 * cardKey for a per-card donut.
 *
 * v3.8.0: this used to be a plain function returning JSX
 * (`renderCardDonut`), called inline from one file's own `.map()`. Now
 * it has two independent call sites (Intel's own grid, and the new
 * Cards page's per-card toggle) so it's a real exported component --
 * the original function's leading `key` parameter is dropped from
 * props entirely, since a React key is supplied by the caller at the
 * JSX call site (`<CardDonut key={...} .../>`), never read back out of
 * props inside the component itself.
 */
export function CardDonut({
  label,
  breakdown,
  atlasCategoryName,
  currency,
  cardMonth,
  cardKeyForLink,
  variant = "card",
}: {
  label: string;
  breakdown: { totalSpend: Money; byCategory: CardCategoryAmount[] };
  atlasCategoryName: Map<string, string>;
  currency: string;
  cardMonth: string;
  cardKeyForLink: string;
  variant?: "aggregate" | "card";
}) {
  const { slices, gradientStops } = cardDonut(breakdown, atlasCategoryName);
  const isAggregate = variant === "aggregate";
  return (
    <div
      className={`rounded-2xl bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)] ${
        isAggregate ? "border-2 border-accent-soft" : ""
      }`}
    >
      <div className="flex items-center gap-1.5 px-3.5 pb-1 pt-3">
        {isAggregate && (
          <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 font-display text-[9px] font-extrabold uppercase tracking-wide text-white">
            Overall
          </span>
        )}
        <h3
          className={`truncate font-display font-bold text-ink ${
            isAggregate ? "text-[13px]" : "text-[11.5px]"
          }`}
        >
          {label}
        </h3>
      </div>
      {slices.length === 0 ? (
        <p className="px-3.5 pb-3.5 text-[12px] leading-relaxed text-ink-faint">
          No spend recorded.
        </p>
      ) : (
        // v1.6.2: donut + legend side by side (was stacked, donut on
        // top) -- a stacked layout left a lot of unused width in each
        // card; a household-flagged issue ("lot of empty spaces...if
        // required shrink it").
        <div className="flex items-center gap-3 px-3.5 pb-3.5">
          <div
            className={`relative shrink-0 rounded-full ${isAggregate ? "size-[92px]" : "size-[76px]"}`}
            style={{
              background: `conic-gradient(${gradientStops.join(", ")})`,
            }}
          >
            <div className="absolute inset-[10px] flex flex-col items-center justify-center rounded-full bg-surface text-center">
              <span className="font-display text-[9.5px] font-extrabold leading-tight text-ink">
                {formatMoneyDisplay(breakdown.totalSpend, currency).replace(
                  /\.\d+$/,
                  "",
                )}
              </span>
            </div>
          </div>
          <ul className="min-w-0 flex-1">
            {slices.map((slice, i) => {
              const totalNum = moneyToDbNumber(breakdown.totalSpend);
              const pct =
                totalNum > 0
                  ? Math.round((moneyToDbNumber(slice.total) / totalNum) * 100)
                  : 0;
              return (
                <li key={slice.name}>
                  <DonutSliceLink
                    href={cardCategoryHref({
                      cardMonth,
                      cardKey: cardKeyForLink,
                      categoryIds: slice.categoryIds,
                      label: slice.name,
                    })}
                    colorSwatch={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                    name={slice.name}
                    amountText={formatMoneyDisplay(
                      slice.total,
                      currency,
                    ).replace(/\.\d+$/, "")}
                    pctText={`${pct}%`}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export function CardBreakdownSkeleton() {
  return (
    <div className="flex items-center justify-center rounded-[20px] border-[1.5px] border-dashed border-line bg-surface p-10">
      <Spinner className="size-6 text-accent" />
    </div>
  );
}
