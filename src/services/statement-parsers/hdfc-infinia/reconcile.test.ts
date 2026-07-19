import { describe, expect, it } from "vitest";

import type { Money } from "@/lib/money";

import type { HdfcStatementHeader, HdfcTransaction } from "./types";
import {
  HdfcReconciliationError,
  assertHdfcStatementReconciles,
  reconcileHdfcStatement,
} from "./reconcile";

const m = (value: string) => value as Money;

function header(
  overrides: Partial<HdfcStatementHeader> = {},
): HdfcStatementHeader {
  return {
    issuer: "HDFC",
    cardType: "Infinia",
    cardLast4: "1234",
    primaryCardholder: "TEST USER",
    statementDate: "2026-07-15",
    billingPeriodStart: "2026-06-16",
    billingPeriodEnd: "2026-07-15",
    dueDate: "2026-08-05",
    totalAmountDue: m("600.00"),
    minimumDue: m("100.00"),
    previousStatementDue: m("1000.00"),
    paymentsReceived: m("500.00"),
    purchasesDebit: m("100.00"),
    financeCharges: m("0.00"),
    availableCreditLimit: m("50000.00"),
    totalCreditLimit: m("100000.00"),
    availableCashLimit: m("20000.00"),
    rewardPointsBalance: 0,
    rewardPointsEarned: 0,
    rewardPointsExpiring30Days: 0,
    rewardPointsExpiring60Days: 0,
    cashbackAmount: m("0.00"),
    rewardPointsSummary: [],
    cashbackSummary: [],
    statementCurrency: "INR",
    ...overrides,
  };
}

function transaction(
  overrides: Partial<HdfcTransaction> = {},
): HdfcTransaction {
  return {
    transactionDate: "2026-06-20",
    transactionTime: "10:00",
    description: "SOME MERCHANT",
    merchantRaw: "SOME MERCHANT",
    merchantNormalized: "Some Merchant",
    amount: m("100.00"),
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
    rawText: "raw",
    ...overrides,
  };
}

describe("reconcileHdfcStatement", () => {
  it("passes when transactions exactly match the header's totals", () => {
    const h = header();
    const txns = [
      transaction({ amount: m("100.00"), transactionType: "debit" }),
      transaction({
        amount: m("500.00"),
        transactionType: "credit",
        isPayment: true,
        creditType: "payment",
      }),
    ];
    const result = reconcileHdfcStatement(h, txns);
    expect(result.ok).toBe(true);
    expect(result.checks.every((c) => c.delta === "0.00")).toBe(true);
  });

  it("passes when the delta is within the small rounding tolerance", () => {
    // Mirrors the real statement this was built against, which has a
    // genuine 0.09 rupee rounding gap in HDFC's own printed totals.
    const h = header({ totalAmountDue: m("600.09") });
    const txns = [
      transaction({ amount: m("100.00"), transactionType: "debit" }),
      transaction({
        amount: m("500.00"),
        transactionType: "credit",
        isPayment: true,
        creditType: "payment",
      }),
    ];
    const result = reconcileHdfcStatement(h, txns);
    expect(result.ok).toBe(true);
  });

  it("fails when a transaction is missing from the debit sum", () => {
    const h = header();
    const txns = [
      // purchasesDebit says 100.00 but only half of it is represented.
      transaction({ amount: m("50.00"), transactionType: "debit" }),
      transaction({
        amount: m("500.00"),
        transactionType: "credit",
        isPayment: true,
        creditType: "payment",
      }),
    ];
    const result = reconcileHdfcStatement(h, txns);
    expect(result.ok).toBe(false);
    const failed = result.checks.filter((c) => !c.withinTolerance);
    expect(failed.map((c) => c.label)).toContain("purchases/debits");
  });

  it("fails when the credit sum doesn't match payments received", () => {
    const h = header();
    const txns = [
      transaction({ amount: m("100.00"), transactionType: "debit" }),
      transaction({
        amount: m("400.00"),
        transactionType: "credit",
        isPayment: true,
        creditType: "payment",
      }),
    ];
    const result = reconcileHdfcStatement(h, txns);
    expect(result.ok).toBe(false);
    expect(
      result.checks.find((c) => c.label === "payments received")
        ?.withinTolerance,
    ).toBe(false);
  });

  it("checks the statement identity independently of the transaction list", () => {
    // Header math itself is wrong (a header-parsing bug), even though the
    // transactions perfectly match purchasesDebit/paymentsReceived --
    // this check must still fail, since it never looks at the transactions.
    const h = header({ totalAmountDue: m("999999.00") });
    const txns = [
      transaction({ amount: m("100.00"), transactionType: "debit" }),
      transaction({
        amount: m("500.00"),
        transactionType: "credit",
        isPayment: true,
        creditType: "payment",
      }),
    ];
    const result = reconcileHdfcStatement(h, txns);
    expect(result.ok).toBe(false);
    expect(
      result.checks.find((c) => c.label === "total amount due")
        ?.withinTolerance,
    ).toBe(false);
  });

  it("reports an exact delta, not just a pass/fail", () => {
    const h = header();
    const txns = [
      transaction({ amount: m("70.00"), transactionType: "debit" }),
      transaction({
        amount: m("500.00"),
        transactionType: "credit",
        isPayment: true,
        creditType: "payment",
      }),
    ];
    const result = reconcileHdfcStatement(h, txns);
    const debitCheck = result.checks.find(
      (c) => c.label === "purchases/debits",
    );
    expect(debitCheck?.computedValue).toBe("70.00");
    expect(debitCheck?.delta).toBe("30.00");
  });
});

describe("assertHdfcStatementReconciles", () => {
  it("does not throw for a reconciled statement", () => {
    const h = header();
    const txns = [
      transaction({ amount: m("100.00"), transactionType: "debit" }),
      transaction({
        amount: m("500.00"),
        transactionType: "credit",
        isPayment: true,
        creditType: "payment",
      }),
    ];
    expect(() => assertHdfcStatementReconciles(h, txns)).not.toThrow();
  });

  it("throws HdfcReconciliationError, carrying the full result, for a mismatched statement", () => {
    const h = header();
    const txns = [transaction({ amount: m("1.00"), transactionType: "debit" })];
    expect(() => assertHdfcStatementReconciles(h, txns)).toThrow(
      HdfcReconciliationError,
    );
    try {
      assertHdfcStatementReconciles(h, txns);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(HdfcReconciliationError);
      const reconciliationError = err as HdfcReconciliationError;
      expect(reconciliationError.result.ok).toBe(false);
      expect(reconciliationError.message).toContain("purchases/debits");
    }
  });
});
