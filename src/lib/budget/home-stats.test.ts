import { describe, expect, it } from "vitest";

import { sumMoney } from "@/lib/money";
import { computeProjectedClosing } from "./home-stats";
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

  it("also subtracts one-off expenses", () => {
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
            payee: "Groceries",
            amount: "20000.00" as never,
            currencyCode: "INR",
            kind: "expense",
            transferAccountId: null,
            status: "pending",
          },
        ],
      }),
    );
    expect(result).toBe("80000.00");
  });

  /**
   * v1.1.4 regression test: this used to be exactly the shape of the
   * "also subtracts one-off card payments and expenses" test above —
   * kind: "transfer" was treated the same as an expense and subtracted,
   * which is the actual bug that was reported (a transfer between the
   * person's own accounts made the projected closing balance look worse
   * even though their overall position hadn't changed). A card payment
   * is itself logged as a transfer (checking -> credit card account,
   * see CardPaymentQuickLog / NetWorthService's own comment on why that
   * correctly nets to zero for net worth), so this covers the real
   * "Self -10,000" case from the bug report, not just a hypothetical.
   */
  it("does not subtract transfers — moving money between your own accounts doesn't change your overall position", () => {
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
            status: "posted",
          },
        ],
      }),
    );
    expect(result).toBe("100000.00");
  });

  it("includes one-off income as an addition — any money in should offset money out", () => {
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
    expect(result).toBe("118000.00");
  });

  it("handles the reported real case — one-off income representing starting cash shouldn't sit outside the formula", () => {
    const result = computeProjectedClosing(
      snapshot({
        oneOff: [
          {
            id: "1",
            payee: "Horse Camp",
            amount: "5000.00" as never,
            currencyCode: "INR",
            kind: "expense",
            transferAccountId: null,
            status: "pending",
          },
          {
            id: "2",
            payee: "Balance left in July",
            amount: "6000.00" as never,
            currencyCode: "INR",
            kind: "income",
            transferAccountId: null,
            status: "pending",
          },
        ],
      }),
    );
    // 6000 in - 5000 out = 1000, not -5000
    expect(result).toBe("1000.00");
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
