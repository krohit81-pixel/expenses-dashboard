import { describe, expect, it } from "vitest";

import { computeHomeStats } from "./home-stats";
import type { MonthlyBudgetSnapshot } from "@/services/BudgetSnapshotService";

function snapshot(
  overrides: Partial<MonthlyBudgetSnapshot> = {},
): MonthlyBudgetSnapshot {
  return {
    month: "2026-08",
    income: [],
    fixedExpenses: [],
    oneOff: [],
    incomeTotal: "0.00" as MonthlyBudgetSnapshot["incomeTotal"],
    fixedExpenseTotal: "0.00" as MonthlyBudgetSnapshot["fixedExpenseTotal"],
    ...overrides,
  };
}

describe("computeHomeStats", () => {
  it("returns all zeros for an empty month", () => {
    const stats = computeHomeStats(snapshot());
    expect(stats).toEqual({
      expected: "0.00",
      committed: "0.00",
      paid: "0.00",
      remaining: "0.00",
    });
  });

  it("sums tagged recurring income as expected", () => {
    const stats = computeHomeStats(
      snapshot({
        income: [
          {
            id: "1",
            name: "Salary — Rohit",
            amount: "560000.00" as never,
            currencyCode: "INR",
            status: "posted",
          },
          {
            id: "2",
            name: "Salary — Aradhana",
            amount: "320000.00" as never,
            currencyCode: "INR",
            status: "pending",
          },
        ],
      }),
    );
    expect(stats.expected).toBe("880000.00");
  });

  it("includes one-off income (e.g. rent received) in expected", () => {
    const stats = computeHomeStats(
      snapshot({
        oneOff: [
          {
            id: "1",
            payee: "Rent",
            amount: "18000.00" as never,
            currencyCode: "INR",
            kind: "income",
            transferAccountId: null,
            status: "pending",
          },
        ],
      }),
    );
    expect(stats.expected).toBe("18000.00");
  });

  it("treats both expense and transfer one-offs as committed (a card payment is a commitment)", () => {
    const stats = computeHomeStats(
      snapshot({
        oneOff: [
          {
            id: "1",
            payee: "HDFC Infinia",
            amount: "881091.00" as never,
            currencyCode: "INR",
            kind: "transfer",
            transferAccountId: "acct-1",
            status: "pending",
          },
          {
            id: "2",
            payee: "Car service",
            amount: "5000.00" as never,
            currencyCode: "INR",
            kind: "expense",
            transferAccountId: null,
            status: "posted",
          },
        ],
      }),
    );
    expect(stats.committed).toBe("886091.00");
    expect(stats.paid).toBe("5000.00");
    expect(stats.remaining).toBe("881091.00");
  });

  it("only counts posted lines toward paid, not pending ones", () => {
    const stats = computeHomeStats(
      snapshot({
        fixedExpenses: [
          {
            id: "1",
            name: "Home Loan EMI",
            amount: "172000.00" as never,
            currencyCode: "INR",
            status: "posted",
          },
          {
            id: "2",
            name: "Car EMI",
            amount: "101000.00" as never,
            currencyCode: "INR",
            status: "pending",
          },
        ],
      }),
    );
    expect(stats.committed).toBe("273000.00");
    expect(stats.paid).toBe("172000.00");
    expect(stats.remaining).toBe("101000.00");
  });

  it("remaining is zero, not negative, when everything committed is already paid", () => {
    const stats = computeHomeStats(
      snapshot({
        fixedExpenses: [
          {
            id: "1",
            name: "Home Loan EMI",
            amount: "172000.00" as never,
            currencyCode: "INR",
            status: "posted",
          },
        ],
      }),
    );
    expect(stats.remaining).toBe("0.00");
  });
});
