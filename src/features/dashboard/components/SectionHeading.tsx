/**
 * The small numbered/bar section-header pattern used throughout the
 * v3.1.0 Dashboard redesign (Cycle Brief, This Cycle vs Last, Biggest
 * Changes, Full breakdown, Logged this cycle) — a colored bar, an
 * index number, an uppercase title, and optional right-aligned meta
 * text. Purely presentational; the chevron is decorative (nothing
 * collapses today), kept because it's part of what read as "neat" in
 * the reference the household pointed at — a real collapse behavior
 * would be a follow-up, not assumed here.
 */
export function SectionHeading({
  index,
  title,
  meta,
}: {
  index: string;
  title: string;
  meta?: string;
}) {
  return (
    <div className="mb-2.5 flex items-baseline gap-2">
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
    </div>
  );
}
