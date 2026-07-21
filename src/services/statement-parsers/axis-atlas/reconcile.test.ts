import { describe, expect, it } from "vitest";

import {
  assertAxisStatementReconciles,
  AxisReconciliationError,
  reconcileAxisStatement,
} from "./reconcile";
import type { AxisStatementHeader, AxisTransaction } from "./types";

function makeHeader(
  overrides: Partial<AxisStatementHeader> = {},
): AxisStatementHeader {
  return {
    issuer: "AXIS",
    cardType: "atlas",
    cardLast4: "7890",
    primaryCardholder: "TEST USER",
    statementDate: "2026-06-30",
    billingPeriodStart: "2026-06-01",
    billingPeriodEnd: "2026-06-30",
    dueDate: "2026-07-20",
    totalAmountDue: "10000.00" as never,
    minimumDue: "500.00" as never,
    previousStatementDue: "5000.00" as never,
    paymentsReceived: "5200.00" as never,
    purchasesDebit: "10200.00" as never,
    financeCharges: "0.00" as never,
    availableCreditLimit: "190000.00" as never,
    totalCreditLimit: "200000.00" as never,
    availableCashLimit: "50000.00" as never,
    rewardPointsBalance: 5000,
    rewardPointsEarned: 0,
    rewardPointsExpiring30Days: 0,
    rewardPointsExpiring60Days: 0,
    cashbackAmount: "0.00" as never,
    rewardPointsSummary: [],
    cashbackSummary: [],
    statementCurrency: "INR",
    ...overrides,
  };
}

function makeTransaction(
  overrides: Partial<AxisTransaction> = {},
): AxisTransaction {
  return {
    transactionDate: "2026-06-01",
    transactionTime: null,
    description: "SOME MERCHANT",
    merchantRaw: "SOME MERCHANT",
    merchantNormalized: "Some Merchant",
    amount: "100.00" as never,
    currency: "INR",
    transactionType: "debit",
    isPayment: false,
    isCashback: false,
    isRefund: false,
    isEmi: false,
    creditType: null,
    paymentReference: null,
    emiMerchant: null,
    emiAmount: null,
    rewardPoints: null,
    purchaseIndicatorCode: null,
    purchaseIndicatorName: null,
    cardholderType: "primary",
    cardholderName: "TEST USER",
    pageNumber: 1,
    sequenceNumber: 1,
    rawText: "",
    ...overrides,
  };
}

describe("reconcileAxisStatement", () => {
  it("reconciles when transactions sum to exactly what the header claims", () => {
    // paymentsReceived (5200) already folds in Payments + Credits (see
    // parse-header.ts's parseReconciliationRow) -- the credit-side
    // transaction sum below matches that combined figure directly.
    const header = makeHeader();
    const transactions = [
      makeTransaction({
        amount: "10200.00" as never,
        transactionType: "debit",
      }),
      makeTransaction({
        amount: "5200.00" as never,
        transactionType: "credit",
      }),
    ];

    const result = reconcileAxisStatement(header, transactions);
    expect(result.ok).toBe(true);
    expect(result.checks.every((c) => c.withinTolerance)).toBe(true);
  });

  it("fails when the debit sum doesn't match purchasesDebit", () => {
    const header = makeHeader();
    const transactions = [
      makeTransaction({ amount: "1.00" as never, transactionType: "debit" }),
      makeTransaction({
        amount: "5200.00" as never,
        transactionType: "credit",
      }),
    ];

    const result = reconcileAxisStatement(header, transactions);
    expect(result.ok).toBe(false);
    expect(
      result.checks.find((c) => c.label === "purchases/debits")
        ?.withinTolerance,
    ).toBe(false);
  });

  it("tolerates a small rounding residual within the relative tolerance", () => {
    const header = makeHeader({ purchasesDebit: "10200.00" as never });
    const transactions = [
      // 0.03% off -- inside RELATIVE_RATE (0.05%).
      makeTransaction({
        amount: "10203.00" as never,
        transactionType: "debit",
      }),
      makeTransaction({
        amount: "5200.00" as never,
        transactionType: "credit",
      }),
    ];

    const result = reconcileAxisStatement(header, transactions);
    expect(
      result.checks.find((c) => c.label === "purchases/debits")
        ?.withinTolerance,
    ).toBe(true);
  });

  it("assertAxisStatementReconciles throws AxisReconciliationError when it doesn't add up", () => {
    const header = makeHeader();
    const transactions = [makeTransaction({ amount: "1.00" as never })];
    expect(() => assertAxisStatementReconciles(header, transactions)).toThrow(
      AxisReconciliationError,
    );
  });
});
