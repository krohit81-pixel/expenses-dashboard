import { Spinner } from "@/components/ui/spinner";

/**
 * Shown automatically by Next while /intel/card-category's own data
 * fetch (getCardCategoryTransactions) is in flight -- picks up right
 * where DonutSliceLink's own button spinner leaves off, so the loading
 * feedback is continuous from the moment of the click through to the
 * page actually rendering, not just an instant before the navigation
 * itself starts.
 *
 * v3.0.0: matches Hero's own redesign (indigo gradient dropped for a
 * flat `bg-bg` + hairline bottom border) — this skeleton stands in for
 * Hero before the real page (and its own Hero) has rendered, so it
 * needs to look like the same header, not the old one.
 */
export default function CardCategoryLoading() {
  return (
    <div className="flex min-h-[190px] items-center justify-center border-b border-line bg-bg">
      <Spinner
        className="size-8 text-accent"
        aria-label="Loading category detail"
      />
    </div>
  );
}
