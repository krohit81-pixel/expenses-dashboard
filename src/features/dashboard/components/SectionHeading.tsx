import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The small numbered/bar section-header pattern used throughout the
 * v3.1.0 Dashboard redesign (Cycle Brief, This Cycle vs Last, Biggest
 * Changes, Full breakdown, Logged this cycle) — a colored bar, an
 * index number, an uppercase title, and optional right-aligned meta
 * text. Purely presentational on Dashboard; the chevron is decorative
 * there (nothing collapses today).
 *
 * v3.3.0 — reused on `/calendar` (the household's own "make it look as
 * classy as Dashboard" request) to replace that page's plain `<h2>`
 * section titles. Calendar's sections aren't all as simple as
 * Dashboard's, though — several are collapsible (a chevron that
 * actually does something this time) and a couple have their own
 * extra controls (a "this week" jump button, month-nav arrows)
 * sharing the header row. Two additions cover that without forcing
 * every call site through a rigid shape:
 * - `right`: arbitrary content rendered after `meta`, before any
 *   chevron — e.g. WeekScheduleGrid's "This week" button.
 * - `onClick`/`expanded`: when `onClick` is given, the whole heading
 *   becomes a real toggle button (`aria-expanded={expanded}`) with a
 *   chevron that actually rotates/means something, instead of the
 *   always-static presentational one Dashboard uses.
 */
export function SectionHeading({
  index,
  title,
  meta,
  right,
  onClick,
  expanded,
}: {
  index: string;
  title: string;
  meta?: string;
  right?: React.ReactNode;
  /** Makes the whole heading a collapse/expand toggle when provided. */
  onClick?: () => void;
  expanded?: boolean;
}) {
  const content = (
    <>
      <span
        className="h-[13px] w-[3px] shrink-0 translate-y-[1px] rounded-sm bg-accent"
        aria-hidden="true"
      />
      <span className="font-display text-[10.5px] font-bold text-ink-faint">
        {index}
      </span>
      <span className="font-display text-[12px] font-extrabold uppercase tracking-wide text-ink">
        {title}
      </span>
      {meta && (
        <span className="ml-auto text-[10.5px] text-ink-faint">{meta}</span>
      )}
      {right}
      {onClick && (
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-ink-faint transition-transform",
            expanded && "rotate-180",
          )}
        />
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-expanded={expanded}
        className="mb-2.5 flex w-full items-center gap-2 text-left"
      >
        {content}
      </button>
    );
  }

  return <div className="mb-2.5 flex items-center gap-2">{content}</div>;
}
