import { formatMoneyDisplay } from "@/lib/money";
import type { CardRewardsSummary } from "@/services/CreditCardIntelService";

/**
 * v3.9.0 — Infinia's rewards section on /cards: a reconciliation strip
 * (base points from every reward-bearing transaction + bonus points
 * from the statement's own program summary = the statement's own
 * printed "Points Earned" total), a top-5 point-earning transactions
 * list, and the statement's own "Rewards Program Points Summary" table
 * — the exact three pieces from the household-approved HTML mockup,
 * reimplemented against CardDonut.tsx's real container/typography
 * conventions (rounded-2xl bg-surface shadow, font-display headers)
 * instead of the mockup's own standalone CSS. Amber is the points
 * accent — the same `bg-amber-soft`/`text-amber` pairing already used
 * elsewhere in this app for a "notable" callout (e.g.
 * ahaana-progress/page.tsx's study-block badge), not a new color
 * introduced just for this.
 *
 * Independent of whichever month is selected via the page's own
 * month-nav — always the card's own LATEST statement, same "always
 * latest, not filtered by viewed month" convention CombinedReportSection
 * already follows. `rewards === null` means no statement has ever been
 * imported for this card yet, distinct from "a statement exists but
 * nothing earned points" (which comes back with empty lists instead).
 */
export function CardRewardsSection({
  rewards,
  currency,
  cardLabel,
}: {
  rewards: CardRewardsSummary | null;
  currency: string;
  /** v3.9.0 shipped this hardcoded to "Infinia" -- generalized when ICICI
   * RuPay reused this same section, since its per-transaction points +
   * cycle "Total Points earned" total reconcile exactly the same way
   * Infinia's do (no bonus-program table on either real RuPay statement
   * tested, same as Infinia's own rewardPointsSummary can be empty). */
  cardLabel: string;
}) {
  if (!rewards) {
    return (
      <div className="rounded-2xl bg-surface p-5 text-center text-ink-faint shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
        <p className="text-sm">No {cardLabel} statement imported yet.</p>
      </div>
    );
  }

  const bonusPointsTotal = rewards.rewardPointsSummary.reduce(
    (sum, line) => sum + line.bonusPoints,
    0,
  );

  return (
    <div className="space-y-4">
      {/* Reconciliation strip */}
      <div className="rounded-2xl bg-surface p-4 shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-display text-[11.5px] font-bold text-ink">
            Rewards this cycle
          </h3>
          <span className="text-[10px] text-ink-faint">
            {rewards.statementDate}
          </span>
        </div>
        <div className="flex items-center justify-center gap-2 text-center">
          <div>
            <div className="font-display text-lg font-extrabold text-amber">
              {rewards.basePointsTotal.toLocaleString()}
            </div>
            <div className="text-[10px] font-semibold text-ink-faint">
              Base points
            </div>
          </div>
          <span className="pb-4 font-display text-sm font-bold text-ink-faint">
            +
          </span>
          <div>
            <div className="font-display text-lg font-extrabold text-amber">
              {bonusPointsTotal.toLocaleString()}
            </div>
            <div className="text-[10px] font-semibold text-ink-faint">
              Bonus programs
            </div>
          </div>
          <span className="pb-4 font-display text-sm font-bold text-ink-faint">
            =
          </span>
          <div>
            <div className="font-display text-lg font-extrabold text-positive">
              {rewards.rewardPointsEarned.toLocaleString()}
            </div>
            <div className="text-[10px] font-semibold text-ink-faint">
              Points earned
            </div>
          </div>
        </div>
      </div>

      {/* Top 5 + Rewards Program Points Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-surface p-4 shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <h3 className="mb-2 font-display text-[11.5px] font-bold text-ink">
            Top 5 point-earning transactions
          </h3>
          {rewards.topTransactions.length === 0 ? (
            <p className="text-[12px] leading-relaxed text-ink-faint">
              No point-earning transactions this cycle.
            </p>
          ) : (
            <ul>
              {rewards.topTransactions.map((txn, i) => (
                <li
                  key={txn.id}
                  className="flex items-center gap-2.5 border-b border-line py-2 last:border-b-0"
                >
                  <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-amber-soft font-display text-[11px] font-extrabold text-amber">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold text-ink">
                      {txn.description}
                    </div>
                    <div className="text-[10.5px] text-ink-faint">
                      {txn.date} ·{" "}
                      {formatMoneyDisplay(txn.amount, currency).replace(
                        /\.\d+$/,
                        "",
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right font-display text-[13px] font-extrabold text-amber">
                    {txn.rewardPoints.toLocaleString()}
                    <div className="text-[9px] font-semibold uppercase tracking-wide text-ink-faint">
                      pts
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-surface p-4 shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <h3 className="mb-2 font-display text-[11.5px] font-bold text-ink">
            Rewards Program Points Summary
          </h3>
          {rewards.rewardPointsSummary.length === 0 ? (
            <p className="text-[12px] leading-relaxed text-ink-faint">
              No bonus programs this cycle.
            </p>
          ) : (
            <table className="w-full text-[12px]">
              <tbody>
                {rewards.rewardPointsSummary.map((line) => (
                  <tr key={line.srNo} className="border-b border-line">
                    <td className="py-2 pr-2 font-medium text-ink">
                      <span className="mr-1.5 inline-block w-4 text-[10.5px] font-bold text-ink-faint">
                        {line.srNo}
                      </span>
                      {line.program}
                    </td>
                    <td className="py-2 text-right font-bold text-amber">
                      {line.bonusPoints.toLocaleString()}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="pt-2.5 font-display text-[12.5px] font-extrabold text-ink">
                    Total
                  </td>
                  <td className="pt-2.5 text-right font-display text-[12.5px] font-extrabold text-ink">
                    {bonusPointsTotal.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
