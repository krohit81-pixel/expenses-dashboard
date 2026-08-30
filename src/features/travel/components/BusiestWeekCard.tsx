import { SectionHeading } from "@/features/dashboard/components/SectionHeading";
import {
  travelerColorClass,
  travelerInitials,
  travelerSoftColorClass,
  travelerTextColorClass,
} from "@/features/travel/travelers";
import {
  describeBusiestWeek,
  type BusiestWeekSummary,
} from "@/features/travel/busiest-week";
import { cn } from "@/lib/utils";

/** "Aug 31 – Sep 6" from two ISO dates in the same or different months — the SectionHeading `meta` label. */
function formatWeekRange(weekStart: string, weekEnd: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(`${weekEnd}T00:00:00Z`);
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const endLabel =
    start.getUTCMonth() === end.getUTCMonth()
      ? String(end.getUTCDate())
      : end.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        });
  return `${startLabel} – ${endLabel}`;
}

/**
 * v3.6.3 — "Who's Busiest," section 01 on the public Calendar tab's
 * Summary view, above Monthly Schedule (now 02) and This Week's
 * Schedule (now 03). One bar per known household member (see
 * travelers.ts), sized relative to whoever has the most this week —
 * built from buildBusiestWeekSummary (busiest-week.ts), which already
 * merges every calendar source the rest of this page uses.
 */
export function BusiestWeekCard({ summary }: { summary: BusiestWeekSummary }) {
  const maxCount = Math.max(1, ...summary.rows.map((r) => r.count));

  return (
    <section>
      <SectionHeading
        index="01"
        title="Who's Busiest"
        meta={formatWeekRange(summary.weekStart, summary.weekEnd)}
      />
      <div className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
        <p className="mb-4 text-[13px] leading-relaxed text-ink-soft">
          {describeBusiestWeek(summary)}
        </p>
        <div className="space-y-3">
          {summary.rows.map((row) => (
            <div key={row.name} className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex size-[19px] shrink-0 items-center justify-center rounded-full font-display text-[8px] font-extrabold text-white",
                  travelerColorClass(row.name),
                )}
              >
                {travelerInitials(row.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="font-display text-[12.5px] font-bold text-ink">
                    {row.name}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-display text-[11px] font-bold",
                      row.count > 0
                        ? travelerTextColorClass(row.name)
                        : "text-ink-faint",
                    )}
                  >
                    {row.count > 0
                      ? `${row.count} item${row.count === 1 ? "" : "s"}`
                      : "Light week"}
                  </span>
                </div>
                <div
                  className={cn(
                    "h-2 rounded-full",
                    travelerSoftColorClass(row.name),
                  )}
                >
                  {row.count > 0 && (
                    <div
                      className={cn(
                        "h-full rounded-full",
                        travelerColorClass(row.name),
                      )}
                      style={{ width: `${(row.count / maxCount) * 100}%` }}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
