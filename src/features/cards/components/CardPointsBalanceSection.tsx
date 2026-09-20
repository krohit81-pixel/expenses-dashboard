import type { CardPointsBalanceSummary } from "@/services/CreditCardIntelService";

/**
 * A minimal counterpart to CardRewardsSection for a card whose statement
 * only ever prints a running points balance -- Axis Horizon's eDGE Miles
 * is the first real case. Deliberately just the one figure: Horizon's
 * statement has no per-cycle "points earned" total, no per-transaction
 * points column, and no bonus-program table to reconcile against (see
 * axis-horizon-airtel/parse-header.ts's own comments), so the
 * reconciliation-strip/top-5/summary-table layout CardRewardsSection
 * builds for Infinia would just be three empty blocks here -- not built.
 */
export function CardPointsBalanceSection({
  balance,
  label,
}: {
  balance: CardPointsBalanceSummary | null;
  label: string;
}) {
  if (!balance) {
    return (
      <div className="rounded-2xl bg-surface p-5 text-center text-ink-faint shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
        <p className="text-sm">No {label} statement imported yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface p-4 shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-display text-[11.5px] font-bold text-ink">
          Points balance
        </h3>
        <span className="text-[10px] text-ink-faint">
          {balance.statementDate}
        </span>
      </div>
      <div className="text-center">
        <div className="font-display text-2xl font-extrabold text-amber">
          {balance.rewardPointsBalance.toLocaleString()}
        </div>
        <div className="text-[10px] font-semibold text-ink-faint">
          {label} points balance
        </div>
      </div>
    </div>
  );
}
