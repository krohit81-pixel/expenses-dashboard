import { Spinner } from "@/components/ui/spinner";

/**
 * v3.4.10 — same role as `(app)/loading.tsx` for the main app: both
 * `/ahaana` and `/ahaana/manage` are Server Components that await a
 * real Supabase read before rendering anything, and without this
 * Next.js just leaves the *previous* page frozen in place for that
 * whole wait — no visible feedback that a tap even registered. Placed
 * at this segment (not the whole `/ahaana` tree) so it only swaps in
 * for `{children}` inside `(gated)/layout.tsx` — the header, tab nav,
 * and footer all stay mounted and interactive the entire time, same
 * as the main app's own version.
 */
export default function AhaanaLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="size-7 text-accent" />
    </div>
  );
}
