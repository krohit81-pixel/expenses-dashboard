import {
  compareMoney,
  formatMoneyDisplay,
  isNegativeMoney,
  parseMoney,
  subtractMoney,
  ZERO,
  type Money,
} from "@/lib/money";
import type { MonthlyBudgetSnapshot } from "@/services/BudgetSnapshotService";
import { computeCardDuesTotal } from "@/lib/budget/home-stats";

/**
 * v3.1.0 — cycle-over-cycle comparison for Dashboard's "This Cycle vs
 * Last" and "Biggest Changes" sections. Everything here is a pure
 * function over two already-fetched MonthlyBudgetSnapshots (this
 * cycle's and the previous cycle's) — no new queries, no new schema.
 * `getMonthlyBudgetSnapshot` already takes any month string, so the
 * caller (dashboard/page.tsx) just fetches one extra snapshot for
 * `shiftMonth(month, -1)` and passes both in here.
 */

export type Direction = "pos" | "neg" | "flat";

export interface CycleDelta {
  direction: Direction;
  /** e.g. "+3.0%", "−12.0%", "New", or null when there's nothing worth labeling (both zero). */
  label: string | null;
}

/**
 * A signed percent change from `previous` to `current`, direction-only
 * (the caller decides whether "more" is good or bad — an expense going
 * up is `pos` numerically but should render with the negative/red tone,
 * which is why direction here is named by arithmetic sign, not by
 * "good/bad" — see `toneForChange` below for that mapping).
 */
export function computeCycleDelta(current: Money, previous: Money): CycleDelta {
  const diff = subtractMoney(current, previous);
  if (parseMoney(previous).isZero()) {
    if (parseMoney(diff).abs().lessThan(0.01)) {
      return { direction: "flat", label: null };
    }
    return { direction: isNegativeMoney(diff) ? "neg" : "pos", label: "New" };
  }
  const pct = parseMoney(diff).dividedBy(parseMoney(previous).abs()).times(100);
  if (pct.abs().lessThan(0.1)) {
    return { direction: "flat", label: "No change" };
  }
  const sign = pct.greaterThan(0) ? "+" : "−";
  return {
    direction: pct.greaterThan(0) ? "pos" : "neg",
    label: `${sign}${pct.abs().toFixed(1)}%`,
  };
}

/**
 * Maps a delta's arithmetic direction to a display tone, given whether
 * "more" is a good thing for this particular figure. Income/net going
 * up is good (green); expenses/card dues going up is bad (red). Flat
 * stays flat either way.
 */
export function toneForChange(
  direction: Direction,
  moreIsGood: boolean,
): Direction {
  if (direction === "flat") return "flat";
  const isIncrease = direction === "pos";
  return isIncrease === moreIsGood ? "pos" : "neg";
}

export type CycleState = "onTrack" | "tight" | "overBudget";

/**
 * "Over budget" if the cycle is projected to close negative. Otherwise
 * "tight" if what's left over is a thin sliver of income (under 15% —
 * picked as "close enough to zero to be worth flagging before it
 * actually goes negative," not a precise budgeting rule) rather than a
 * comfortable margin. "On track" covers everything else.
 */
export function pickCycleState(net: Money, totalIncome: Money): CycleState {
  if (isNegativeMoney(net)) return "overBudget";
  if (parseMoney(totalIncome).isZero()) return "onTrack";
  const ratio = parseMoney(net).dividedBy(parseMoney(totalIncome));
  return ratio.lessThan(0.15) ? "tight" : "onTrack";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 0-100 position for the deficit↔surplus meter dot. Clamped well
 * inside the bar (6-94) so the dot never rides the very edge of the
 * rounded track regardless of how lopsided a cycle is.
 */
export function meterPosition(net: Money, totalFlow: Money): number {
  if (parseMoney(totalFlow).isZero()) return 50;
  const ratio = parseMoney(net).dividedBy(parseMoney(totalFlow)).toNumber();
  return Math.round(50 + clamp(ratio, -1, 1) * 44);
}

export interface ChangeTile {
  name: string;
  amount: Money;
  currencyCode: string;
  changeLabel: string;
  tone: Direction;
}

interface ChangeCandidate extends ChangeTile {
  absDelta: Money;
}

/**
 * The largest cycle-over-cycle swings, for the "Biggest Changes" tiles.
 * Matches income/fixed-expense lines between cycles **by name** —
 * `SnapshotLine` doesn't carry a stable cross-cycle template id (its
 * `id` is the specific transaction row tagged to that one cycle), so
 * name is the best signal available without changing
 * BudgetSnapshotService's shared shape (also used by /budgets). Good
 * enough for the common case (a recurring template's payee name is
 * stable); a renamed template will just show up as "New" once.
 *
 * Card dues (the transfer-that-reduces-cash-on-hand total) is folded
 * in as one synthetic aggregate line rather than matched per-payee —
 * those come from one-off card-payment logging, not recurring
 * templates, so there's no name to match on at all.
 */
export function computeBiggestChanges(
  current: MonthlyBudgetSnapshot,
  previous: MonthlyBudgetSnapshot,
  baseCurrency: string,
  max = 4,
): ChangeTile[] {
  const prevIncome = new Map(previous.income.map((l) => [l.name, l.amount]));
  const prevExpense = new Map(
    previous.fixedExpenses.map((l) => [l.name, l.amount]),
  );

  const candidates: ChangeCandidate[] = [];

  for (const line of current.income) {
    const prevAmount = prevIncome.get(line.name);
    const delta = computeCycleDelta(line.amount, prevAmount ?? ZERO);
    if (delta.direction === "flat" && prevAmount !== undefined) continue;
    candidates.push({
      name: line.name,
      amount: line.amount,
      currencyCode: line.currencyCode,
      changeLabel:
        prevAmount === undefined
          ? "New this cycle"
          : (delta.label ?? "No change"),
      tone: toneForChange(delta.direction, true),
      absDelta: parseMoney(subtractMoney(line.amount, prevAmount ?? ZERO))
        .abs()
        .toFixed(2) as Money,
    });
  }

  for (const line of current.fixedExpenses) {
    const prevAmount = prevExpense.get(line.name);
    const delta = computeCycleDelta(line.amount, prevAmount ?? ZERO);
    if (delta.direction === "flat" && prevAmount !== undefined) continue;
    candidates.push({
      name: line.name,
      amount: line.amount,
      currencyCode: line.currencyCode,
      changeLabel:
        prevAmount === undefined
          ? "New this cycle"
          : (delta.label ?? "No change"),
      tone: toneForChange(delta.direction, false),
      absDelta: parseMoney(subtractMoney(line.amount, prevAmount ?? ZERO))
        .abs()
        .toFixed(2) as Money,
    });
  }

  const currentDues = computeCardDuesTotal(current);
  const prevDues = computeCardDuesTotal(previous);
  const duesDelta = computeCycleDelta(currentDues, prevDues);
  if (duesDelta.direction !== "flat") {
    candidates.push({
      name: "Card dues",
      amount: currentDues,
      currencyCode: baseCurrency,
      changeLabel: duesDelta.label ?? "No change",
      tone: toneForChange(duesDelta.direction, false),
      absDelta: parseMoney(subtractMoney(currentDues, prevDues))
        .abs()
        .toFixed(2) as Money,
    });
  }

  return candidates
    .sort((a, b) => compareMoney(b.absDelta, a.absDelta))
    .slice(0, max)
    .map(({ name, amount, currencyCode, changeLabel, tone }) => ({
      name,
      amount,
      currencyCode,
      changeLabel,
      tone,
    }));
}

/**
 * A short, factual rundown for the Cycle Brief card's body paragraph —
 * every sentence is derived from real snapshot data, nothing invented
 * (no claims about tagging status or anything not actually computed
 * here).
 */
export function buildCycleSummary(params: {
  totalIncome: Money;
  net: Money;
  currency: string;
  largestExpenseName: string | null;
}): string {
  const { totalIncome, net, currency, largestExpenseName } = params;
  const sentences: string[] = [
    `Income this cycle is ${formatMoneyDisplay(totalIncome, currency)}.`,
  ];
  if (largestExpenseName) {
    sentences.push(`${largestExpenseName} is the largest single expense.`);
  }
  sentences.push(
    isNegativeMoney(net)
      ? `Projected to close ${formatMoneyDisplay(subtractMoney(ZERO, net), currency)} short this cycle.`
      : `Projected to close ${formatMoneyDisplay(net, currency)} ahead this cycle.`,
  );
  return sentences.join(" ");
}

/** The largest single expense line (fixed or one-off expense) in a snapshot, by name — used for the Cycle Brief summary sentence. */
export function findLargestExpenseName(
  snapshot: MonthlyBudgetSnapshot,
): string | null {
  const candidates: { name: string; amount: Money }[] = [
    ...snapshot.fixedExpenses.map((l) => ({ name: l.name, amount: l.amount })),
    ...snapshot.oneOff
      .filter((l) => l.kind === "expense")
      .map((l) => ({ name: l.payee ?? "Untitled", amount: l.amount })),
  ];
  if (candidates.length === 0) return null;
  return candidates.reduce((max, c) =>
    compareMoney(c.amount, max.amount) > 0 ? c : max,
  ).name;
}

/**
 * "Aug 25" — the day this cycle rolls into the next one. Atlas's cycle
 * always closes on the 25th of the cycle's own month (see
 * currentCycleMonth's comment in lib/dates/month.ts): cycle "2026-08"
 * runs Jul 25 – Aug 24 and rolls to "2026-09" starting Aug 25.
 */
export function cycleCloseLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1, 25));
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}
