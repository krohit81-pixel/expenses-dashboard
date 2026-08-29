import { describe, expect, it } from "vitest";

import { sumMoney } from "@/lib/money";
import { computeDifference, computeExpensesRemaining } from "./cycle-balance";
import type {
  MonthlyBudgetSnapshot,
  OneOffLine,
} from "@/services/BudgetSnapshotService";

function snapshot(lines: OneOffLine[] = []): MonthlyBudgetSnapshot {
  return {
    month: "2026-08",
    lines,
    incomeTotal: sumMoney(
      lines.filter((l) => l.kind === "income").map((l) => l.amount),
    ),
    expenseTotal: sumMoney(
      lines.filter((l) => l.kind === "expense").map((l) => l.amount),
    ),
  };
}

function line(overrides: Partial<OneOffLine> = {}): OneOffLine {
  return {
    id: "1",
    payee: "Test",
    amount: "1000.00" as never,
    currencyCode: "INR",
    kind: "expense",
    transferAccountId: null,
    status: "pending",
    transferReducesCashOnHand: false,
    ...overrides,
  };
}

describe("computeExpensesRemaining", () => {
  it("is zero for an empty cycle", () => {
    expect(computeExpensesRemaining(snapshot())).toBe("0.00");
  });

  it("sums only pending expenses, ignoring posted ones and income", () => {
    const result = computeExpensesRemaining(
      snapshot([
        line({
          id: "1",
          kind: "expense",
          amount: "5000.00" as never,
          status: "pending",
        }),
        line({
          id: "2",
          kind: "expense",
          amount: "3000.00" as never,
          status: "posted",
        }),
        line({
          id: "3",
          kind: "income",
          amount: "9000.00" as never,
          status: "pending",
        }),
      ]),
    );
    expect(result).toBe("5000.00");
  });

  it("includes a pending card-paydown transfer but not a spendable-to-spendable one", () => {
    const result = computeExpensesRemaining(
      snapshot([
        line({
          id: "1",
          kind: "transfer",
          amount: "20000.00" as never,
          status: "pending",
          transferReducesCashOnHand: true,
        }),
        line({
          id: "2",
          kind: "transfer",
          amount: "10000.00" as never,
          status: "pending",
          transferReducesCashOnHand: false,
        }),
      ]),
    );
    expect(result).toBe("20000.00");
  });

  it("ignores income entirely, posted or pending", () => {
    const result = computeExpensesRemaining(
      snapshot([
        line({
          id: "1",
          kind: "income",
          amount: "500000.00" as never,
          status: "pending",
        }),
        line({
          id: "2",
          kind: "income",
          amount: "500000.00" as never,
          status: "posted",
        }),
      ]),
    );
    expect(result).toBe("0.00");
  });
});

describe("computeDifference", () => {
  it("returns null when no account balance has been set", () => {
    expect(computeDifference(null, "5000.00" as never)).toBeNull();
  });

  it("subtracts expenses remaining from the account balance", () => {
    expect(computeDifference("100000.00" as never, "35000.00" as never)).toBe(
      "65000.00",
    );
  });

  it("can go negative when remaining expenses exceed the balance", () => {
    expect(computeDifference("20000.00" as never, "35000.00" as never)).toBe(
      "-15000.00",
    );
  });

  it("is exactly the balance when nothing is left to pay", () => {
    expect(computeDifference("42000.00" as never, "0.00" as never)).toBe(
      "42000.00",
    );
  });
});
