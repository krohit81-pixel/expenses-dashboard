import { describe, expect, it } from "vitest";

import { sumMoney } from "@/lib/money";
import {
  computeCardDuesTotal,
  computeCommittedExpenseTotal,
} from "./home-stats";
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

describe("computeCommittedExpenseTotal", () => {
  it("is zero for an empty month", () => {
    expect(computeCommittedExpenseTotal(snapshot())).toBe("0.00");
  });

  it("sums expenses, ignoring income", () => {
    const result = computeCommittedExpenseTotal(
      snapshot([
        {
          id: "1",
          payee: "Salary",
          amount: "100000.00" as never,
          currencyCode: "INR",
          kind: "income",
          transferAccountId: null,
          status: "posted",
          transferReducesCashOnHand: false,
        },
        {
          id: "2",
          payee: "Rent",
          amount: "30000.00" as never,
          currencyCode: "INR",
          kind: "expense",
          transferAccountId: null,
          status: "posted",
          transferReducesCashOnHand: false,
        },
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
      ]),
    );
    // 30000 rent + 5000 groceries — the 100000 salary doesn't factor in.
    expect(result).toBe("35000.00");
  });

  /**
   * v1.1.4 regression test, narrowed in v1.1.5. A transfer between two
   * of the person's own *spendable* accounts (checking/savings/cash) —
   * e.g. the reported "Self -10,000" case — genuinely doesn't change
   * how much spendable cash they have. transferReducesCashOnHand: false
   * is what BudgetSnapshotService computes for exactly this shape (the
   * destination account is itself spendable).
   */
  it("includes a card-paydown transfer but not a spendable-to-spendable one", () => {
    const result = computeCommittedExpenseTotal(
      snapshot([
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
      ]),
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
      snapshot([
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
      ]),
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
      snapshot([
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
      ]),
    );
    expect(result).toBe("0.00");
  });

  it("sums multiple card-paydown transfers together", () => {
    const result = computeCardDuesTotal(
      snapshot([
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
      ]),
    );
    expect(result).toBe("170714.00");
  });
});
