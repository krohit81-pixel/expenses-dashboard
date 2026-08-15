"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Spinner } from "@/components/ui/spinner";
import { monthLabel, shiftMonth } from "@/lib/dates/month";

/**
 * Dashboard's cycle prev/next/Today nav, rendered inside Hero's
 * `children`. v3.0.0, replacing a plain `<Link>`-based version after the
 * same problem CardMonthNav (intel's card-level breakdown nav, v1.6.2)
 * already solved: nothing on screen changed while the next cycle's data
 * was being fetched server-side, which read as "did my tap even
 * register?" — no in-progress indicator of any kind.
 *
 * Driving navigation from a client component instead makes
 * useTransition's `isPending` reliably true for the whole round trip
 * (unlike waiting on the (app)/loading.tsx Suspense fallback, which can
 * get skipped when the RSC response is fast/cached — exactly why it
 * wasn't visible before) and keeps scroll position stable via
 * router.push's `scroll: false`.
 */
export function DashboardMonthNav({
  month,
  isCurrentMonth,
}: {
  month: string;
  isCurrentMonth: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function go(href: string) {
    startTransition(() => {
      router.push(href, { scroll: false });
    });
  }

  return (
    <div className="mt-4 flex items-center gap-2">
      <button
        type="button"
        onClick={() => go(`/dashboard?month=${shiftMonth(month, -1)}`)}
        disabled={isPending}
        className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-sm text-accent disabled:opacity-60"
        aria-label="Previous cycle"
      >
        &#8249;
      </button>
      <span className="min-w-[150px] text-center font-display text-sm font-bold text-ink">
        {monthLabel(month)} cycle
      </span>
      <button
        type="button"
        onClick={() => go(`/dashboard?month=${shiftMonth(month, 1)}`)}
        disabled={isPending}
        className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-sm text-accent disabled:opacity-60"
        aria-label="Next cycle"
      >
        &#8250;
      </button>
      {!isCurrentMonth && (
        <button
          type="button"
          onClick={() => go("/dashboard")}
          disabled={isPending}
          className="ml-1 rounded-full bg-accent px-3 py-1.5 font-display text-xs font-bold text-white disabled:opacity-60"
        >
          Today
        </button>
      )}
      {isPending && (
        <Spinner
          className="ml-1 size-4 text-accent"
          aria-label="Loading cycle"
        />
      )}
    </div>
  );
}
