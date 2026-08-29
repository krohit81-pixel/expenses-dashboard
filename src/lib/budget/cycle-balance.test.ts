import { describe, expect, it } from "vitest";

import { sumMoney } from "@/lib/money";
import {
  computeExpensesRemaining,
  computeRunningBalance,
} from "./cycle-balance";
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
});

describe("computeRunningBalance", () => {
  it("returns null when no starting balance has been set", () => {
    expect(computeRunningBalance(snapshot(), null)).toBeNull();
  });

  it("is just the starting balance when nothing is posted yet", () => {
    const result = computeRunningBalance(
      snapshot([line({ status: "pending" })]),
      "100000.00" as never,
    );
    expect(result).toBe("100000.00");
  });

  it("adds posted income and subtracts posted expenses, ignoring pending ones", () => {
    const result = computeRunningBalance(
      snapshot([
        line({
          id: "1",
          kind: "income",
          amount: "50000.00" as never,
          status: "posted",
        }),
        line({
          id: "2",
          kind: "expense",
          amount: "20000.00" as never,
          status: "posted",
        }),
        line({
          id: "3",
          kind: "expense",
          amount: "99999.00" as never,
          status: "pending",
        }),
        line({
          id: "4",
          kind: "income",
          amount: "88888.00" as never,
          status: "pending",
        }),
      ]),
      "100000.00" as never,
    );
    expect(result).toBe("130000.00");
  });

  it("includes a posted card-paydown transfer as an outflow", () => {
    const result = computeRunningBalance(
      snapshot([
        line({
          id: "1",
          kind: "transfer",
          amount: "15000.00" as never,
          status: "posted",
          transferReducesCashOnHand: true,
        }),
      ]),
      "100000.00" as never,
    );
    expect(result).toBe("85000.00");
  });

  it("can go negative", () => {
    const result = computeRunningBalance(
      snapshot([
        line({
          id: "1",
          kind: "expense",
          amount: "150000.00" as never,
          status: "posted",
        }),
      ]),
      "100000.00" as never,
    );
    expect(result).toBe("-50000.00");
  });
});
