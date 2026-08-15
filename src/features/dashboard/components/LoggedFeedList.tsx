import type { OneOffLine } from "@/services/BudgetSnapshotService";
import { formatMoneyDisplay } from "@/lib/money";
import { transactionDisplayTitle } from "@/features/transactions/format";

const KIND_TAG: Record<
  OneOffLine["kind"],
  { label: string; className: string }
> = {
  income: { label: "Income", className: "bg-positive-soft text-positive" },
  expense: { label: "Expense", className: "bg-negative-soft text-negative" },
  transfer: { label: "Transfer", className: "bg-line text-ink-soft" },
};

/**
 * v3.1.0 restyle of Dashboard's "Logged this cycle" list — same data
 * (snapshot.oneOff) as before, now pill-tagged feed cards instead of
 * plain rows, matching the reference's RESEARCH/PASTED card pattern.
 * A "Pending" pill appears for anything not yet posted, same meaning
 * as the plain "Not yet paid" caption it replaces elsewhere on this
 * page's Income/Fixed-expense lists.
 */
export function LoggedFeedList({
  items,
  accountName,
}: {
  items: OneOffLine[];
  accountName: Map<string, string>;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-surface p-4 text-xs text-ink-faint">
        Nothing logged for this cycle yet.
      </p>
    );
  }

  return (
    <div>
      {items.map((line) => {
        const kindTag = KIND_TAG[line.kind];
        const isReducedTransfer =
          line.kind === "transfer" && !line.transferReducesCashOnHand;
        const amountClass = isReducedTransfer
          ? "text-ink-faint"
          : line.kind === "income"
            ? "text-positive"
            : "text-negative";
        const sign = isReducedTransfer
          ? ""
          : line.kind === "income"
            ? "+"
            : "−";
        const title = transactionDisplayTitle(
          {
            payee: line.payee,
            kind: line.kind,
            transferAccountId: line.transferAccountId,
          },
          accountName,
        );

        return (
          <div
            key={line.id}
            className="mb-2 rounded-2xl border border-line bg-surface p-3.5 last:mb-0"
          >
            <div className="flex flex-wrap gap-1.5">
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${kindTag.className}`}
              >
                {kindTag.label}
              </span>
              {line.status === "pending" && (
                <span className="rounded-full bg-amber-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber">
                  Pending
                </span>
              )}
            </div>
            <div className="mt-2.5 truncate text-[13.5px] font-bold leading-tight text-ink">
              {title}
            </div>
            <div
              className={`mt-1 font-display text-xs font-bold ${amountClass}`}
            >
              {isReducedTransfer && "Transfer · "}
              {sign}
              {formatMoneyDisplay(line.amount, line.currencyCode)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
