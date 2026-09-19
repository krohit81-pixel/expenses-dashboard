/**
 * The disclosure triangle for a collapsible section's <summary> --
 * v1.2 (Intel), "make month on month, by category and the card-level
 * breakdown sections collapsible." Plain native <details>/<summary>
 * (no client component, no JS) does the actual collapsing; this is
 * just the chevron, rotated via the group-open: variant on the parent
 * <details className="group">. Every section defaults open (the
 * `open` attribute on <details>) so existing behavior is unchanged
 * until someone actually collapses one.
 *
 * v3.8.0 — moved here from intel/page.tsx (where it originated) so the
 * new Cards page's own collapsible sections (Combined report) can use
 * the exact same icon without a second copy — it's a generic
 * disclosure marker, not Intel-specific.
 */
export function SectionChevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      className="size-3 shrink-0 text-ink-faint transition-transform duration-150 group-open:rotate-90"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
