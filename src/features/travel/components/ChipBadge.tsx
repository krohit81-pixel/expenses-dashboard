"use client";

import { cn } from "@/lib/utils";

/**
 * The "bold top bar" chip style (v2.5.0) — a saturated color strip
 * across the top, a pale body with the label in normal ink below it,
 * replacing the old solid-color-pill-with-white-text chip. Validated in
 * the month/week-view prototype: reads far better at the month grid's
 * ~7.5px label size than white-on-solid-color did, and gives the week
 * list's larger "lg" chips room for a second line (a time, or "All
 * day") without needing two different visual languages.
 *
 * Deliberately non-interactive (no onClick) — these chips are compact
 * summaries only. The one place that actually does anything when
 * tapped is the day itself (the grid cell / week row it lives in),
 * which opens DayDetailCard; individual items only become clickable
 * once they're a row inside that card.
 */
export function ChipBadge({
  barColorClass,
  label,
  subLabel,
  size = "sm",
}: {
  barColorClass: string;
  label: string;
  subLabel?: string;
  size?: "sm" | "lg";
}) {
  return (
    <span
      className={cn(
        "block overflow-hidden rounded-[5px] bg-surface ring-1 ring-inset ring-line",
        size === "lg" && "min-w-[84px] flex-1",
      )}
    >
      <span
        className={cn(
          "block",
          size === "sm" ? "h-[3px]" : "h-1",
          barColorClass,
        )}
      />
      <span
        className={cn(
          "block truncate",
          size === "sm" ? "px-1 py-[1px]" : "px-2 py-1.5",
        )}
      >
        <span
          className={cn(
            "block truncate font-display font-extrabold leading-tight text-ink",
            size === "sm" ? "text-[7.5px]" : "text-[11.5px]",
          )}
        >
          {label}
        </span>
        {size === "lg" && subLabel && (
          <span className="mt-0.5 block truncate text-[9.5px] font-bold text-ink-faint">
            {subLabel}
          </span>
        )}
      </span>
    </span>
  );
}
