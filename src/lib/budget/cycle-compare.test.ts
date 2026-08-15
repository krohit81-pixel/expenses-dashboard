import { describe, expect, it } from "vitest";

import { sumMoney, type Money } from "@/lib/money";
import type { MonthlyBudgetSnapshot } from "@/services/BudgetSnapshotService";
import {
  buildCycleSummary,
  computeBiggestChanges,
  computeCycleDelta,
  cycleCloseLabel,
  findLargestExpenseName,
  meterPosition,
  pickCycleState,
  toneForChange,
} from "./cycle-compare";

function snapshot(
  overrides: Partial<MonthlyBudgetSnapshot> = {},
): MonthlyBudgetSnapshot {
  const income = overrides.income ?? [];
  const fixedExpenses = overrides.fixedExpenses ?? [];
  return {
    month: "2026-08",
    income,
    fixedExpenses,
    oneOff: [],
    incomeTotal: sumMoney(income.map((l) => l.amount)),
    fixedExpenseTotal: sumMoney(fixedExpenses.map((l) => l.amount)),
    ...overrides,
  };
}

function line(name: string, amount: string) {
  return {
    id: name,
    name,
    amount: `${amount}.00` as Money,
    currencyCode: "INR",
    status: "posted" as const,
  };
}

describe("computeCycleDelta", () => {
  it("is flat when both sides are zero", () => {
    expect(computeCycleDelta("0.00" as Money, "0.00" as Money)).toEqual({
      direction: "flat",
      label: null,
    });
  });

  it("is New when there was nothing last cycle", () => {
    expect(computeCycleDelta("500.00" as Money, "0.00" as Money)).toEqual({
      direction: "pos",
      label: "New",
    });
  });

  it("computes a positive percent change", () => {
    const result = computeCycleDelta("110.00" as Money, "100.00" as Money);
    expect(result.direction).toBe("pos");
    expect(result.label).toBe("+10.0%");
  });

  it("computes a negative percent change", () => {
    const result = computeCycleDelta("90.00" as Money, "100.00" as Money);
    expect(result.direction).toBe("neg");
    expect(result.label).toBe("−10.0%");
  });

  it("is flat for a sub-0.1% wobble", () => {
    const result = computeCycleDelta(
      "100000.05" as Money,
      "100000.00" as Money,
    );
    expect(result.direction).toBe("flat");
  });
});

describe("toneForChange", () => {
  it("an increase is positive tone when more is good (income)", () => {
    expect(toneForChange("pos", true)).toBe("pos");
  });
  it("an increase is negative tone when more is bad (expense)", () => {
    expect(toneForChange("pos", false)).toBe("neg");
  });
  it("a decrease is negative tone when more is good (income)", () => {
    expect(toneForChange("neg", true)).toBe("neg");
  });
  it("a decrease is positive tone when more is bad (expense)", () => {
    expect(toneForChange("neg", false)).toBe("pos");
  });
  it("flat stays flat regardless", () => {
    expect(toneForChange("flat", true)).toBe("flat");
    expect(toneForChange("flat", false)).toBe("flat");
  });
});

describe("pickCycleState", () => {
  it("is overBudget when net is negative", () => {
    expect(pickCycleState("-100.00" as Money, "50000.00" as Money)).toBe(
      "overBudget",
    );
  });
  it("is onTrack with no income and a zero/positive net", () => {
    expect(pickCycleState("0.00" as Money, "0.00" as Money)).toBe("onTrack");
  });
  it("is tight when net is a thin sliver of income", () => {
    expect(pickCycleState("5000.00" as Money, "100000.00" as Money)).toBe(
      "tight",
    );
  });
  it("is onTrack with a comfortable margin", () => {
    expect(pickCycleState("50000.00" as Money, "100000.00" as Money)).toBe(
      "onTrack",
    );
  });
});

describe("meterPosition", () => {
  it("centers when total flow is zero", () => {
    expect(meterPosition("0.00" as Money, "0.00" as Money)).toBe(50);
  });
  it("leans toward surplus for a strongly positive net", () => {
    expect(meterPosition("100.00" as Money, "100.00" as Money)).toBe(94);
  });
  it("leans toward deficit for a strongly negative net", () => {
    expect(meterPosition("-100.00" as Money, "100.00" as Money)).toBe(6);
  });
});

describe("computeBiggestChanges", () => {
  it("flags a matched line's swing and skips unmatched flat lines", () => {
    const previous = snapshot({
      income: [line("Salary", "160000")],
      fixedExpenses: [line("Rent", "45000")],
    });
    const current = snapshot({
      income: [line("Salary", "160000")], // unchanged — should not appear
      fixedExpenses: [line("Rent", "63400")], // +18400 — should appear
    });
    const changes = computeBiggestChanges(current, previous, "INR");
    expect(changes).toHaveLength(1);
    expect(changes[0].name).toBe("Rent");
    expect(changes[0].tone).toBe("neg"); // expense increase is bad
    expect(changes[0].changeLabel).toBe("+40.9%");
  });

  it("labels a line with no prior match as new", () => {
    const previous = snapshot({});
    const current = snapshot({
      income: [line("Freelance invoice", "24600")],
    });
    const changes = computeBiggestChanges(current, previous, "INR");
    expect(changes).toHaveLength(1);
    expect(changes[0].changeLabel).toBe("New this cycle");
    expect(changes[0].tone).toBe("pos");
  });

  it("sorts by absolute delta and respects the max count", () => {
    const previous = snapshot({
      fixedExpenses: [line("A", "100"), line("B", "100"), line("C", "100")],
    });
    const current = snapshot({
      fixedExpenses: [line("A", "500"), line("B", "150"), line("C", "120")],
    });
    const changes = computeBiggestChanges(current, previous, "INR", 2);
    expect(changes.map((c) => c.name)).toEqual(["A", "B"]);
  });
});

describe("buildCycleSummary", () => {
  it("reports a shortfall when net is negative", () => {
    const text = buildCycleSummary({
      totalIncome: "100000.00" as Money,
      net: "-5000.00" as Money,
      currency: "INR",
      largestExpenseName: "Rent",
    });
    expect(text).toContain("short this cycle");
    expect(text).toContain("Rent is the largest single expense");
  });

  it("reports a surplus when net is positive, without an expense sentence if none given", () => {
    const text = buildCycleSummary({
      totalIncome: "100000.00" as Money,
      net: "5000.00" as Money,
      currency: "INR",
      largestExpenseName: null,
    });
    expect(text).toContain("ahead this cycle");
    expect(text).not.toContain("largest single expense");
  });
});

describe("findLargestExpenseName", () => {
  it("returns null for an empty snapshot", () => {
    expect(findLargestExpenseName(snapshot())).toBeNull();
  });

  it("picks the largest across fixed expenses and one-off expenses", () => {
    const result = findLargestExpenseName(
      snapshot({
        fixedExpenses: [line("Rent", "45000")],
        oneOff: [
          {
            id: "x",
            payee: "Card dues · HDFC",
            amount: "62000.00" as Money,
            currencyCode: "INR",
            kind: "expense",
            transferAccountId: null,
            status: "posted",
            transferReducesCashOnHand: false,
          },
        ],
      }),
    );
    expect(result).toBe("Card dues · HDFC");
  });
});

describe("cycleCloseLabel", () => {
  it("is the 25th of the cycle's own month", () => {
    expect(cycleCloseLabel("2026-08")).toBe("Aug 25");
  });
});
