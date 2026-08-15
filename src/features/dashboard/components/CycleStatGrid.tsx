import { parseMoney, type Money } from "@/lib/money";
import type { Direction } from "@/lib/budget/cycle-compare";

export interface CycleStat {
  label: string;
  valueDisplay: string;
  prevDisplay: string;
  current: Money;
  previous: Money;
  direction: Direction;
  changeLabel: string;
}

const DIRECTION_CLASS: Record<Direction, string> = {
  pos: "text-positive",
  neg: "text-negative",
  flat: "text-ink-faint",
};

/**
 * v3.1.0 — the big-number-plus-mini-bar-plus-delta card grid, in the
 * language of the reference the household pointed at. Deliberately a
 * two-bar "then vs now" comparison rather than a multi-point sparkline
 * — Dashboard only has this cycle and last cycle's totals to compare
 * (getMonthlyBudgetSnapshot for two months, not a stored trend series),
 * and a smooth curve drawn from two data points would just be
 * decorating a straight line. A real multi-cycle sparkline is a
 * plausible follow-up once there's a cheap way to fetch several
 * cycles' totals at once without N redundant snapshot queries.
 */
export function CycleStatGrid({ stats }: { stats: CycleStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {stats.map((stat) => (
        <StatCard key={stat.label} stat={stat} />
      ))}
    </div>
  );
}

function StatCard({ stat }: { stat: CycleStat }) {
  const currentAbs = parseMoney(stat.current).abs().toNumber();
  const prevAbs = parseMoney(stat.previous).abs().toNumber();
  const max = Math.max(currentAbs, prevAbs, 1);
  const prevPct = Math.max(6, Math.round((prevAbs / max) * 100));
  const currentPct = Math.max(6, Math.round((currentAbs / max) * 100));
  const barColor =
    stat.direction === "flat"
      ? "bg-ink-faint/40"
      : DIRECTION_CLASS[stat.direction];

  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <div className="text-[11px] font-semibold text-ink-soft">
        {stat.label}
      </div>
      <div className="mt-1 truncate font-display text-lg font-extrabold tracking-tight text-ink">
        {stat.valueDisplay}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className="whitespace-nowrap text-[9px] text-ink-faint">
          prev {stat.prevDisplay}
        </span>
        <span
          className="ml-auto flex h-5 items-end gap-[3px]"
          aria-hidden="true"
        >
          <span
            className="w-1.5 rounded-sm bg-ink-faint/30"
            style={{ height: `${prevPct}%` }}
          />
          <span
            className={`w-1.5 rounded-sm ${barColor.startsWith("text-") ? barColor.replace("text-", "bg-") : barColor}`}
            style={{ height: `${currentPct}%` }}
          />
        </span>
      </div>
      <div
        className={`mt-1.5 flex items-center gap-1 text-[10px] font-bold ${DIRECTION_CLASS[stat.direction]}`}
      >
        {stat.direction !== "flat" && (
          <svg viewBox="0 0 8 8" className="size-[7px]" aria-hidden="true">
            {stat.direction === "pos" ? (
              <path d="M4 0L8 8H0Z" fill="currentColor" />
            ) : (
              <path d="M4 8L0 0H8Z" fill="currentColor" />
            )}
          </svg>
        )}
        {stat.changeLabel}
      </div>
    </div>
  );
}
