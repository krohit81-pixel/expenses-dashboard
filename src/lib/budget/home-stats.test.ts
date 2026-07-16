import { describe, expect, it } from "vitest";

import { sumMoney } from "@/lib/money";
import { computeHomeStats, computeProjectedClosing } from "./home-stats";
import type { MonthlyBudgetSnapshot } from "@/services/BudgetSnapshotService";

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

describe("computeProjectedClosing", () => {
  it("is zero for an empty month", () => {
    expect(computeProjectedClosing(snapshot())).toBe("0.00");
  });

  it("subtracts fixed expenses from income", () => {
    const result = computeProjectedClosing(
      snapshot({
        income: [
          {
            id: "1",
            name: "Salary",
            amount: "100000.00" as never,
            currencyCode: "INR",
            status: "posted",
          },
        ],
        fixedExpenses: [
          {
            id: "2",
            name: "Rent",
            amount: "30000.00" as never,
            currencyCode: "INR",
            status: "posted",
          },
        ],
      }),
    );
    expect(result).toBe("70000.00");
  });

  it("also subtracts one-off card payments and expenses", () => {
    const result = computeProjectedClosing(
      snapshot({
        income: [
          {
            id: "1",
            name: "Salary",
            amount: "100000.00" as never,
            currencyCode: "INR",
            status: "posted",
          },
        ],
        oneOff: [
          {
            id: "2",
            payee: "Card statement",
            amount: "20000.00" as never,
            currencyCode: "INR",
            kind: "transfer",
            transferAccountId: "acct-1",
            status: "pending",
          },
        ],
      }),
    );
    expect(result).toBe("80000.00");
  });

  it("excludes one-off income from both sides — it's neither income receivables nor a commitment", () => {
    const result = computeProjectedClosing(
      snapshot({
        income: [
          {
            id: "1",
            name: "Salary",
            amount: "100000.00" as never,
            currencyCode: "INR",
            status: "posted",
          },
        ],
        oneOff: [
          {
            id: "2",
            payee: "Rent received",
            amount: "18000.00" as never,
            currencyCode: "INR",
            kind: "income",
            transferAccountId: null,
            status: "pending",
          },
        ],
      }),
    );
    // Should still be 100000, not 118000 — one-off income isn't counted here.
    expect(result).toBe("100000.00");
  });

  it("can go negative when commitments exceed income", () => {
    const result = computeProjectedClosing(
      snapshot({
        income: [
          {
            id: "1",
            name: "Salary",
            amount: "50000.00" as never,
            currencyCode: "INR",
            status: "posted",
          },
        ],
        fixedExpenses: [
          {
            id: "2",
            name: "Rent",
            amount: "70000.00" as never,
            currencyCode: "INR",
            status: "posted",
          },
        ],
      }),
    );
    expect(result).toBe("-20000.00");
  });
});
