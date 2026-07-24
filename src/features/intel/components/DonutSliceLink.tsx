"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Spinner } from "@/components/ui/spinner";

/**
 * One clickable row in a Card-level breakdown donut's legend -- v1.2's
 * category drill-down link, with a v1.2.1 follow-up fix: the household
 * reported clicking a slice gave no feedback ("not sure if i have
 * clicked already or not") while /intel/card-category's data was still
 * loading. A plain next/link can't show a pending state without
 * intercepting the click, so this mirrors CardMonthNav's existing
 * pattern in this same codebase -- a button driving router.push inside
 * useTransition -- rather than inventing a new approach. While pending,
 * the trailing percentage swaps for a spinner in the exact spot the eye
 * is already on, and the whole row dims slightly, so the click's effect
 * is visible immediately instead of only once the next page paints.
 */
export function DonutSliceLink({
  href,
  colorSwatch,
  name,
  amountText,
  pctText,
}: {
  href: string;
  colorSwatch: string;
  name: string;
  amountText: string;
  pctText: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.push(href))}
      disabled={isPending}
      className={`-mx-1 flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-[11px] hover:bg-bg ${
        isPending ? "opacity-60" : ""
      }`}
    >
      <span
        className="size-2 shrink-0 rounded-[2px]"
        style={{ background: colorSwatch }}
      />
      <span className="min-w-0 flex-1 truncate text-left font-medium text-ink">
        {name}
      </span>
      <span className="shrink-0 font-display text-[10px] font-bold text-ink-faint">
        {amountText}
      </span>
      <span className="flex w-8 shrink-0 items-center justify-end font-display text-[10px] font-bold text-ink-faint">
        {isPending ? (
          <Spinner className="size-3 text-accent" aria-label="Loading" />
        ) : (
          pctText
        )}
      </span>
    </button>
  );
}
