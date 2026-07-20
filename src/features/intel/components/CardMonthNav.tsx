"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Spinner } from "@/components/ui/spinner";
import { shiftMonth, shortMonthLabel } from "@/lib/dates/month";

/**
 * The Card-level breakdown section's prev/next/Today month nav --
 * v1.6.2, replacing a plain `<Link>`-based version after two reported
 * problems: (1) no visible loading indicator while the next month's
 * data was fetching, and (2) navigating scrolled the whole page back
 * to the top, jarring since this section sits well below the fold.
 *
 * Both are fixed by driving navigation from a client component instead
 * of relying purely on the server-streamed <Suspense> boundary around
 * CardLevelBreakdownSection: useTransition's isPending is guaranteed to
 * be true for the whole duration of the navigation regardless of
 * caching/prefetch timing (unlike waiting for a Suspense fallback to
 * visibly flush, which can get skipped), and router.push's
 * `scroll: false` stops Next.js from resetting scroll position on
 * every navigation.
 */
export function CardMonthNav({
  cardMonth,
  isCurrentCardMonth,
}: {
  cardMonth: string;
  isCurrentCardMonth: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function go(href: string) {
    startTransition(() => {
      router.push(href, { scroll: false });
    });
  }

  return (
    <div className="mb-3 flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => go(`/intel?cardMonth=${shiftMonth(cardMonth, -1)}`)}
        disabled={isPending}
        className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent disabled:opacity-60"
        aria-label="Previous month"
      >
        &#8249;
      </button>
      <span className="min-w-[86px] text-center font-display text-xs font-bold text-ink-soft">
        {shortMonthLabel(cardMonth)}
      </span>
      <button
        type="button"
        onClick={() => go(`/intel?cardMonth=${shiftMonth(cardMonth, 1)}`)}
        disabled={isPending}
        className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent disabled:opacity-60"
        aria-label="Next month"
      >
        &#8250;
      </button>
      {!isCurrentCardMonth && (
        <button
          type="button"
          onClick={() => go("/intel")}
          disabled={isPending}
          className="ml-1 rounded-full bg-accent px-2.5 py-1 font-display text-[10px] font-bold text-white disabled:opacity-60"
        >
          Today
        </button>
      )}
      {isPending && (
        <Spinner
          className="ml-1 size-4 text-accent"
          aria-label="Loading card breakdown"
        />
      )}
    </div>
  );
}
