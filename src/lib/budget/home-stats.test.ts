import { describe, expect, it } from "vitest";

import { sumMoney } from "@/lib/money";
import {
  computeCardDuesTotal,
  computeCommittedExpenseTotal,
  computeProjectedClosing,
} from "./home-stats";
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
            transferReducesCashOnHand: false,
          },
        ],
      }),
    );
    expect(result).toBe("80000.00");
  });

  /**
   * v1.1.4 regression test, narrowed in v1.1.5. A transfer between two
   * of the person's own *spendable* accounts (checking/savings/cash) —
   * e.g. the reported "Self -10,000" case — genuinely doesn't change
   * how much spendable cash they have. transferReducesCashOnHand: false
   * is what BudgetSnapshotService computes for exactly this shape (the
   * destination account is itself spendable).
   */
  it("does not subtract a transfer between spendable accounts", () => {
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
            payee: "Self",
            amount: "10000.00" as never,
            currencyCode: "INR",
            kind: "transfer",
            transferAccountId: "acct-savings",
            status: "posted",
            transferReducesCashOnHand: false,
          },
        ],
      }),
    );
    expect(result).toBe("100000.00");
  });

  /**
   * v1.1.5 regression test: the fix above went too far in v1.1.4 and
   * stopped subtracting real credit-card payments too, which are also
   * logged as transfers (checking -> credit card). That's the exact bug
   * reported next — "Card payments due" showing on Home but not
   * actually reducing the projected closing balance. A transfer whose
   * destination isn't a spendable account (transferReducesCashOnHand:
   * true) is a real cash outflow this cycle and must still be
   * subtracted, even though v1.1.4 correctly stopped subtracting the
   * spendable-to-spendable case above.
   */
  it("subtracts a transfer that pays down a credit card or loan", () => {
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
            transferAccountId: "acct-card",
            status: "posted",
            transferReducesCashOnHand: true,
          },
        ],
      }),
    );
    expect(result).toBe("80000.00");
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
            transferReducesCashOnHand: false,
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
            transferReducesCashOnHand: false,
          },
          {
            id: "2",
            payee: "Balance left in July",
            amount: "6000.00" as never,
            currencyCode: "INR",
            kind: "income",
            transferAccountId: null,
            status: "pending",
            transferReducesCashOnHand: false,
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

describe("computeCommittedExpenseTotal", () => {
  it("is zero for an empty month", () => {
    expect(computeCommittedExpenseTotal(snapshot())).toBe("0.00");
  });

  it("sums fixed expenses and one-off expenses, ignoring income", () => {
    const result = computeCommittedExpenseTotal(
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
        oneOff: [
          {
            id: "3",
            payee: "Groceries",
            amount: "5000.00" as never,
            currencyCode: "INR",
            kind: "expense",
            transferAccountId: null,
            status: "pending",
            transferReducesCashOnHand: false,
          },
        ],
      }),
    );
    // 30000 rent + 5000 groceries — the 100000 salary doesn't factor in.
    expect(result).toBe("35000.00");
  });

  it("includes a card-paydown transfer but not a spendable-to-spendable one", () => {
    const result = computeCommittedExpenseTotal(
      snapshot({
        oneOff: [
          {
            id: "1",
            payee: "Card statement",
            amount: "20000.00" as never,
            currencyCode: "INR",
            kind: "transfer",
            transferAccountId: "acct-card",
            status: "posted",
            transferReducesCashOnHand: true,
          },
          {
            id: "2",
            payee: "Self",
            amount: "10000.00" as never,
            currencyCode: "INR",
            kind: "transfer",
            transferAccountId: "acct-savings",
            status: "posted",
            transferReducesCashOnHand: false,
          },
        ],
      }),
    );
    expect(result).toBe("20000.00");
  });
});

describe("computeCardDuesTotal", () => {
  it("is zero for an empty month", () => {
    expect(computeCardDuesTotal(snapshot())).toBe("0.00");
  });

  it("sums a card-paydown transfer but not a spendable-to-spendable one", () => {
    const result = computeCardDuesTotal(
      snapshot({
        oneOff: [
          {
            id: "1",
            payee: "Card statement",
            amount: "20000.00" as never,
            currencyCode: "INR",
            kind: "transfer",
            transferAccountId: "acct-card",
            status: "posted",
            transferReducesCashOnHand: true,
          },
          {
            id: "2",
            payee: "Self",
            amount: "10000.00" as never,
            currencyCode: "INR",
            kind: "transfer",
            transferAccountId: "acct-savings",
            status: "posted",
            transferReducesCashOnHand: false,
          },
        ],
      }),
    );
    expect(result).toBe("20000.00");
  });

  it("ignores one-off expenses -- only the transfer portion counts", () => {
    // Unlike computeCommittedExpenseTotal, this must NOT include
    // one-off expenses -- those are already counted by
    // ReportingService.getCashFlowSummary for the same calendar month,
    // so including them here too would double-count when Intel adds
    // this total on top of a getCashFlowSummary total.
    const result = computeCardDuesTotal(
      snapshot({
        oneOff: [
          {
            id: "1",
            payee: "Groceries",
            amount: "5000.00" as never,
            currencyCode: "INR",
            kind: "expense",
            transferAccountId: null,
            status: "pending",
            transferReducesCashOnHand: false,
          },
        ],
      }),
    );
    expect(result).toBe("0.00");
  });

  it("sums multiple card-paydown transfers together", () => {
    const result = computeCardDuesTotal(
      snapshot({
        oneOff: [
          {
            id: "1",
            payee: "Infinia statement",
            amount: "150000.00" as never,
            currencyCode: "INR",
            kind: "transfer",
            transferAccountId: "acct-infinia",
            status: "posted",
            transferReducesCashOnHand: true,
          },
          {
            id: "2",
            payee: "Amazon Pay statement",
            amount: "20714.00" as never,
            currencyCode: "INR",
            kind: "transfer",
            transferAccountId: "acct-amazon-pay",
            status: "pending",
            transferReducesCashOnHand: true,
          },
        ],
      }),
    );
    expect(result).toBe("170714.00");
  });
});
