import type { CycleState } from "@/lib/budget/cycle-compare";
import { DashboardMonthNav } from "@/features/dashboard/components/DashboardMonthNav";

const STATE_COPY: Record<CycleState, { word: string; toneClass: string }> = {
  onTrack: { word: "On track", toneClass: "text-accent" },
  tight: { word: "Tight", toneClass: "text-amber" },
  overBudget: { word: "Over budget", toneClass: "text-negative" },
};

/**
 * v3.1.0 — Dashboard's headline card, replacing the net figure that
 * used to live inside Hero itself (see Hero's own v3.1.0 comment).
 * Reworks the reference app's "Daily Risk Brief" card for a
 * deficit/surplus cycle instead of a calm/high risk market: the same
 * shape (state word + one-line qualifier, a gradient meter, a plain
 * summary paragraph, a footer with an as-of date) over Atlas's real
 * cycle data — nothing here is simulated or AI-generated, every value
 * is passed in from getMonthlyBudgetSnapshot.
 */
export function CycleBriefCard({
  month,
  isCurrentMonth,
  state,
  qualifier,
  qualifierTone,
  netDisplay,
  meterPct,
  summary,
  closeLabel,
}: {
  month: string;
  isCurrentMonth: boolean;
  state: CycleState;
  /** e.g. "Better than last cycle" / "Tighter than last cycle" */
  qualifier: string;
  qualifierTone: "pos" | "neg" | "flat";
  netDisplay: string;
  meterPct: number;
  summary: string;
  closeLabel: string;
}) {
  const stateCopy = STATE_COPY[state];
  const qualifierClass =
    qualifierTone === "pos"
      ? "text-positive"
      : qualifierTone === "neg"
        ? "text-negative"
        : "text-ink-faint";

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-start justify-between gap-3 px-4 pb-3.5 pt-4">
        <div>
          <div className="font-display text-[10px] font-bold uppercase tracking-wide text-accent">
            Projected net
          </div>
          <div
            className={`mt-1 max-w-[30ch] text-xs font-semibold ${qualifierClass}`}
          >
            {qualifier}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div
            className={`font-display text-xl font-extrabold tracking-tight ${stateCopy.toneClass}`}
          >
            {stateCopy.word}
          </div>
          <div className="mt-0.5 text-[10.5px] text-ink-faint">
            {netDisplay} net
          </div>
        </div>
      </div>

      <div className="px-4">
        <DashboardMonthNav month={month} isCurrentMonth={isCurrentMonth} />
      </div>

      <div className="mx-4 mt-3.5">
        <div className="relative h-1.5 rounded-full bg-gradient-to-r from-negative via-amber to-positive">
          <div
            className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-ink bg-surface"
            style={{ left: `${meterPct}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[9px] font-bold uppercase tracking-wide text-ink-faint">
          <span>Deficit</span>
          <span>Surplus</span>
        </div>
      </div>

      <div className="mt-3.5 border-t border-line px-4 py-3.5 text-xs leading-relaxed text-ink-soft">
        {summary}
      </div>

      <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
        <span className="text-[10.5px] text-ink-faint">
          Cycle closes {closeLabel}
        </span>
        <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-positive">
          <span className="size-1.5 rounded-full bg-positive" />
          cycle data
        </span>
      </div>
    </div>
  );
}
