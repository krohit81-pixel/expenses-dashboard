"use client";

import Link from "next/link";
import { useState } from "react";

import { formatMoneyDisplay, type Money } from "@/lib/money";
import type { Phase, PhaseInfo } from "@/lib/dates/phase";
import type { MonthlyBudgetSnapshot } from "@/services/BudgetSnapshotService";
import { ChecklistItem } from "@/features/home/ChecklistItem";
import { transactionDisplayTitle } from "@/features/transactions/format";

const PHASES: Phase[] = ["planning", "execution", "tracking"];
const PHASE_LABEL: Record<Phase, string> = {
  planning: "Planning",
  execution: "Execution",
  tracking: "Tracking",
};
const PHASE_STRIP_CLASS: Record<Phase, string> = {
  planning: "bg-accent-soft",
  execution: "bg-positive-soft",
  tracking: "bg-amber-100",
};
const PHASE_NAME_CLASS: Record<Phase, string> = {
  planning: "text-accent",
  execution: "text-positive",
  tracking: "text-amber-700",
};
const PHASE_ICON: Record<Phase, string> = {
  planning: "\u{1F4CB}",
  execution: "\u2705",
  tracking: "\u{1F4CA}",
};

interface ChecklistLine {
  id: string;
  title: string;
  meta?: string;
  amount: Money;
  currencyCode: string;
  direction: "in" | "out";
  status: "pending" | "posted";
}

function snapshotToChecklist(
  snapshot: MonthlyBudgetSnapshot,
  accountName: Map<string, string>,
): ChecklistLine[] {
  const recurring: ChecklistLine[] = [
    ...snapshot.income.map((line) => ({
      id: line.id,
      title: line.name,
      amount: line.amount,
      currencyCode: line.currencyCode,
      direction: "in" as const,
      status: line.status,
    })),
    ...snapshot.fixedExpenses.map((line) => ({
      id: line.id,
      title: line.name,
      amount: line.amount,
      currencyCode: line.currencyCode,
      direction: "out" as const,
      status: line.status,
    })),
  ];
  const oneOff: ChecklistLine[] = snapshot.oneOff.map((line) => ({
    id: line.id,
    title: transactionDisplayTitle(line, accountName),
    amount: line.amount,
    currencyCode: line.currencyCode,
    direction: line.kind === "income" ? ("in" as const) : ("out" as const),
    status: line.status,
  }));
  return [...recurring, ...oneOff];
}

function OutlookCard({
  monthLabel,
  snapshot,
  healthy,
  projectedClosing,
  currency,
  note,
  compact = false,
}: {
  monthLabel: string;
  snapshot: MonthlyBudgetSnapshot;
  healthy: boolean;
  projectedClosing: Money;
  currency: string;
  note?: string;
  compact?: boolean;
}) {
  const cardPaymentsDue = snapshot.oneOff.filter((l) => l.kind !== "income");
  const cardPaymentsTotal = cardPaymentsDue.reduce(
    (sum, l) => sum + Number(l.amount),
    0,
  );

  return (
    <div
      className={`rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)] ${compact ? "p-3.5" : "p-[18px]"}`}
    >
      <div
        className={`flex items-center justify-between ${compact ? "mb-2.5" : "mb-3.5"}`}
      >
        <span className="font-display text-sm font-extrabold text-ink">
          {monthLabel}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 font-display text-[10px] font-extrabold ${
            healthy
              ? "bg-positive-soft text-positive"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {healthy ? "Healthy" : "Tight"}
        </span>
      </div>
      <div className={`grid gap-2 ${compact ? "grid-cols-4" : "grid-cols-2"}`}>
        <div className="rounded-xl bg-bg px-2.5 py-2">
          <div className="text-[10px] text-ink-faint">Expected income</div>
          <div className="mt-0.5 font-display text-sm font-extrabold text-ink">
            {formatMoneyDisplay(snapshot.incomeTotal, currency)}
          </div>
        </div>
        <div className="rounded-xl bg-bg px-2.5 py-2">
          <div className="text-[10px] text-ink-faint">Recurring</div>
          <div className="mt-0.5 font-display text-sm font-extrabold text-ink">
            {formatMoneyDisplay(snapshot.fixedExpenseTotal, currency)}
          </div>
        </div>
        {!compact && (
          <div className="rounded-xl bg-bg px-2.5 py-2">
            <div className="text-[10px] text-ink-faint">Card payments due</div>
            <div className="mt-0.5 font-display text-sm font-extrabold text-ink">
              {formatMoneyDisplay(
                cardPaymentsTotal.toFixed(2) as Money,
                currency,
              )}
            </div>
          </div>
        )}
        <div
          className={`rounded-xl bg-accent-soft px-2.5 py-2 ${compact ? "col-span-2" : "col-span-2 flex items-center justify-between"}`}
        >
          <div className="text-[10px] text-accent">
            Projected closing balance
          </div>
          <div
            className={`font-display font-extrabold text-accent ${compact ? "text-sm" : "text-lg"}`}
          >
            {formatMoneyDisplay(projectedClosing, currency)}
          </div>
        </div>
      </div>
      {note && !compact && (
        <p className="mt-3 text-xs leading-relaxed text-ink-faint">{note}</p>
      )}
    </div>
  );
}

export function HomePhaseView({
  currentPhase,
  phaseInfos,
  currentMonthLabel,
  nextMonthLabel,
  currentSnapshot,
  nextSnapshot,
  nextHealthy,
  nextProjectedClosing,
  accountName,
  currency,
}: {
  currentPhase: Phase;
  phaseInfos: Record<Phase, PhaseInfo>;
  currentMonthLabel: string;
  nextMonthLabel: string;
  currentSnapshot: MonthlyBudgetSnapshot;
  nextSnapshot: MonthlyBudgetSnapshot;
  nextHealthy: boolean;
  nextProjectedClosing: Money;
  accountName: Map<string, string>;
  currency: string;
}) {
  const [selected, setSelected] = useState<Phase>(currentPhase);
  const checklist = snapshotToChecklist(currentSnapshot, accountName);
  const pending = checklist.filter((l) => l.status === "pending");
  const done = checklist.filter((l) => l.status === "posted");

  return (
    <>
      <div className="sticky top-0 z-30 bg-bg px-5 py-2.5 shadow-[0_2px_8px_rgba(28,20,36,0.05)] sm:px-8">
        <div className="mx-auto flex max-w-[1040px] gap-0.5 rounded-full bg-line p-1">
          {PHASES.map((phase) => (
            <button
              key={phase}
              onClick={() => setSelected(phase)}
              className={`flex-1 rounded-full py-2 font-display text-xs font-bold transition-colors ${
                selected === phase ? "bg-ink text-white" : "text-ink-soft"
              }`}
            >
              {PHASE_LABEL[phase]}
              {phase === currentPhase && (
                <span className="ml-1.5 rounded-[5px] bg-positive px-[5px] py-px align-[1px] text-[8.5px] font-extrabold text-white">
                  NOW
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pt-3.5 sm:px-8">
        <div
          className={`flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 ${PHASE_STRIP_CLASS[selected]}`}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-sm">
            {PHASE_ICON[selected]}
          </div>
          <div>
            <div
              className={`font-display text-xs font-extrabold ${PHASE_NAME_CLASS[selected]}`}
            >
              {phaseInfos[selected].label} &middot;{" "}
              {phaseInfos[selected].dateRange}
            </div>
            <div className="mt-0.5 text-[11px] text-ink-soft">
              {phaseInfos[selected].question}
            </div>
          </div>
        </div>
      </div>

      {selected === "planning" && (
        <div className="space-y-6 p-5 sm:p-8">
          <section>
            <h2 className="mb-3 font-display text-base font-bold text-ink">
              {nextMonthLabel} &middot; will it be healthy?
            </h2>
            <OutlookCard
              monthLabel={nextMonthLabel}
              snapshot={nextSnapshot}
              healthy={nextHealthy}
              projectedClosing={nextProjectedClosing}
              currency={currency}
              note="Tag recurring templates and card statements to this cycle on Recurring or Transactions to sharpen this projection — untagged items aren't counted."
            />
          </section>
          <section>
            <h2 className="mb-3 font-display text-[15px] font-bold text-ink">
              {currentMonthLabel}, so far
            </h2>
            <ul className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
              {checklist.length === 0 ? (
                <p className="p-4 text-sm text-ink-faint">
                  Nothing tagged to this month yet.
                </p>
              ) : (
                checklist
                  .slice(0, 4)
                  .map((line) => (
                    <ChecklistItem key={line.id} {...line} compact />
                  ))
              )}
            </ul>
          </section>
        </div>
      )}

      {selected === "execution" && (
        <div className="space-y-6 p-5 sm:p-8">
          <section>
            <h2 className="mb-1 font-display text-base font-bold text-ink">
              What still needs to be completed
            </h2>
            <p className="mb-3 text-xs text-ink-faint">
              Tap the circle to confirm — each one updates your numbers above.
            </p>
            <ul className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
              {checklist.length === 0 ? (
                <p className="p-4 text-sm text-ink-faint">
                  Nothing tagged to {currentMonthLabel} yet — tag recurring
                  items on{" "}
                  <Link href="/recurring" className="underline">
                    Recurring
                  </Link>
                  , or log a card payment on{" "}
                  <Link href="/transactions" className="underline">
                    Transactions
                  </Link>
                  .
                </p>
              ) : (
                [...pending, ...done].map((line) => (
                  <ChecklistItem key={line.id} {...line} />
                ))
              )}
            </ul>
          </section>
          <section>
            <h2 className="mb-3 font-display text-[15px] font-bold text-ink">
              {nextMonthLabel} outlook
            </h2>
            <OutlookCard
              monthLabel={nextMonthLabel}
              snapshot={nextSnapshot}
              healthy={nextHealthy}
              projectedClosing={nextProjectedClosing}
              currency={currency}
              compact
            />
          </section>
        </div>
      )}

      {selected === "tracking" && (
        <div className="space-y-6 p-5 sm:p-8">
          <section>
            <h2 className="mb-1 font-display text-base font-bold text-ink">
              Anything to log?
            </h2>
            <p className="mb-3 text-xs text-ink-faint">
              Just the totals — nothing here needs itemizing.
            </p>
            <div className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
              <p className="mb-3 text-sm text-ink-soft">
                Log miscellaneous spending (food, fuel, shopping) or anything
                unexpected as a single amount — no need to itemize every
                purchase.
              </p>
              <Link
                href="/transactions"
                className="flex w-full items-center justify-center rounded-full bg-accent py-3 font-display text-sm font-bold text-white"
              >
                Log spending on Transactions
              </Link>
            </div>
          </section>
          <section>
            <h2 className="mb-3 font-display text-[15px] font-bold text-ink">
              Has anything changed?
            </h2>
            <OutlookCard
              monthLabel={`${nextMonthLabel} still on track`}
              snapshot={nextSnapshot}
              healthy={nextHealthy}
              projectedClosing={nextProjectedClosing}
              currency={currency}
              compact
            />
          </section>
        </div>
      )}
    </>
  );
}
