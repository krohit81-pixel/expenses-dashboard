import { Spinner } from "@/components/ui/spinner";

/**
 * v1.1.4: every page under (app) is a Server Component that awaits real
 * Supabase reads before it can render anything — with no loading.tsx,
 * Next.js just keeps showing the *previous* page frozen in place for
 * that entire wait, with zero visual change, which is exactly what read
 * as "did my tap even register?" Placing this one file at the (app)
 * layout's segment root gives every tab switch (Home/Transactions/
 * Calendar/Intel/More, and everything under More) the same instant
 * feedback — Next.js swaps this in immediately on navigation and swaps
 * it back out the moment the destination page's data is ready. The
 * bottom/top nav bars live in (app)/layout.tsx *outside* {children}, so
 * they stay put and interactive the whole time; only the content area
 * shows this.
 */
export default function AppLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner className="size-7 text-[hsl(var(--accent))]" />
    </div>
  );
}
