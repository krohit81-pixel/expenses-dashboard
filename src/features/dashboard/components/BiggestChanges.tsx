import { formatMoneyDisplay } from "@/lib/money";
import type { ChangeTile } from "@/lib/budget/cycle-compare";

const TILE_CLASS: Record<ChangeTile["tone"], string> = {
  pos: "bg-positive text-white",
  neg: "bg-negative text-white",
  flat: "border border-line bg-surface text-ink",
};

/**
 * v3.1.0 — solid-fill tiles reserved for the cycle's biggest movers
 * (matching the reference's escalation pattern: plain white cards for
 * everything, solid color only for what's actually notable), flat
 * cards for a small/no change. See cycle-compare.ts's
 * computeBiggestChanges for how "biggest" is decided — name-matched
 * recurring lines plus one aggregate card-dues comparison.
 */
export function BiggestChanges({ tiles }: { tiles: ChangeTile[] }) {
  if (tiles.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-surface p-4 text-xs text-ink-faint">
        Nothing changed enough to call out yet — tag more of this cycle on{" "}
        Recurring to build up a comparison.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {tiles.map((tile) => (
        <div
          key={tile.name}
          className={`rounded-2xl p-3 ${TILE_CLASS[tile.tone]}`}
        >
          <div
            className={`truncate text-[9.5px] font-bold uppercase tracking-wide ${
              tile.tone === "flat" ? "text-ink-faint" : "opacity-85"
            }`}
          >
            {tile.name}
          </div>
          <div className="mt-1.5 font-display text-base font-extrabold tracking-tight">
            {formatMoneyDisplay(tile.amount, tile.currencyCode)}
          </div>
          <div
            className={`mt-1 text-[10px] font-semibold ${
              tile.tone === "flat" ? "text-ink-faint" : "opacity-90"
            }`}
          >
            {tile.changeLabel}
          </div>
        </div>
      ))}
    </div>
  );
}
