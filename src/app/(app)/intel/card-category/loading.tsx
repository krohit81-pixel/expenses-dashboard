import { Spinner } from "@/components/ui/spinner";

/**
 * Shown automatically by Next while /intel/card-category's own data
 * fetch (getCardCategoryTransactions) is in flight -- picks up right
 * where DonutSliceLink's own button spinner leaves off, so the loading
 * feedback is continuous from the moment of the click through to the
 * page actually rendering, not just an instant before the navigation
 * itself starts.
 */
export default function CardCategoryLoading() {
  return (
    <div className="flex min-h-[190px] items-center justify-center bg-gradient-to-br from-[hsl(var(--hero-1))] to-[hsl(var(--hero-2))]">
      <Spinner
        className="size-8 text-white"
        aria-label="Loading category detail"
      />
    </div>
  );
}
