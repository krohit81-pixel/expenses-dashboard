import { describe, expect, it } from "vitest";

import {
  assertIciciStatementReconciles,
  IciciReconciliationError,
  reconcileIciciStatement,
} from "./reconcile";
import type { IciciStatementHeader, IciciTransaction } from "./types";

function makeHeader(
  overrides: Partial<IciciStatementHeader> = {},
): IciciStatementHeader {
  return {
    issuer: "ICICI",
    cardType: "Amazon Pay",
    cardLast4: "5678",
    primaryCardholder: "TEST USER",
    statementDate: "2026-01-05",
    billingPeriodStart: "2026-01-01",
    billingPeriodEnd: "2026-01-31",
    dueDate: "2026-01-25",
    totalAmountDue: "1234.56" as never,
    minimumDue: "50.00" as never,
    previousStatementDue: "1000.00" as never,
    paymentsReceived: "315.44" as never,
    purchasesDebit: "500.00" as never,
    financeCharges: "50.00" as never,
    availableCreditLimit: "190000.00" as never,
    totalCreditLimit: "200000.00" as never,
    availableCashLimit: "45000.00" as never,
    rewardPointsBalance: 0,
    rewardPointsEarned: 0,
    rewardPointsExpiring30Days: 0,
    rewardPointsExpiring60Days: 0,
    cashbackAmount: "42.00" as never,
    rewardPointsSummary: [],
    cashbackSummary: [],
    statementCurrency: "INR",
    ...overrides,
  };
}

function makeTransaction(
  overrides: Partial<IciciTransaction> = {},
): IciciTransaction {
  return {
    transactionDate: "2026-01-01",
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

describe("reconcileIciciStatement", () => {
  it("reconciles when transactions sum to exactly what the header claims", () => {
    // previous(1000) + purchases(500) + cashAdvances(50) -
    // payments(315.44) = 1234.56 (total) -- same identity verified against
    // a real statement (see parse-header.ts's parseStatementSummaryBlock).
    const header = makeHeader();
    const transactions = [
      makeTransaction({ amount: "500.00" as never, transactionType: "debit" }),
      makeTransaction({
        amount: "50.00" as never,
        transactionType: "debit",
        description: "CASH ADVANCE FEE",
        merchantRaw: null,
        merchantNormalized: null,
      }),
      makeTransaction({
        amount: "315.44" as never,
        transactionType: "credit",
      }),
    ];

    const result = reconcileIciciStatement(header, transactions);
    expect(result.ok).toBe(true);
    expect(result.checks.every((c) => c.withinTolerance)).toBe(true);
  });

  it("splits a cash-advance debit row into its own check instead of purchases/charges", () => {
    const header = makeHeader({
      purchasesDebit: "500.00" as never,
      financeCharges: "50.00" as never,
    });
    const transactions = [
      makeTransaction({
        amount: "500.00" as never,
        transactionType: "debit",
        description: "SOME MERCHANT",
      }),
      makeTransaction({
        amount: "50.00" as never,
        transactionType: "debit",
        description: "Cash Withdrawal",
        merchantRaw: null,
        merchantNormalized: null,
      }),
      makeTransaction({
        amount: "315.44" as never,
        transactionType: "credit",
      }),
    ];

    const result = reconcileIciciStatement(header, transactions);
    expect(
      result.checks.find((c) => c.label === "purchases/charges")?.computedValue,
    ).toBe("500.00");
    expect(
      result.checks.find((c) => c.label === "cash advances")?.computedValue,
    ).toBe("50.00");
  });

  it("fails when the debit sum doesn't match purchasesDebit", () => {
    const header = makeHeader({ financeCharges: "0.00" as never });
    const transactions = [
      makeTransaction({ amount: "1.00" as never, transactionType: "debit" }),
      makeTransaction({
        amount: "315.44" as never,
        transactionType: "credit",
      }),
    ];

    const result = reconcileIciciStatement(header, transactions);
    expect(result.ok).toBe(false);
    expect(
      result.checks.find((c) => c.label === "purchases/charges")
        ?.withinTolerance,
    ).toBe(false);
  });

  it("tolerates a small rounding residual within the relative tolerance", () => {
    const header = makeHeader({
      purchasesDebit: "500.00" as never,
      financeCharges: "0.00" as never,
    });
    const transactions = [
      // Well inside RELATIVE_RATE (0.05%) of 500.00.
      makeTransaction({ amount: "500.10" as never, transactionType: "debit" }),
      makeTransaction({
        amount: "315.44" as never,
        transactionType: "credit",
      }),
    ];

    const result = reconcileIciciStatement(header, transactions);
    expect(
      result.checks.find((c) => c.label === "purchases/charges")
        ?.withinTolerance,
    ).toBe(true);
  });

  it("assertIciciStatementReconciles throws IciciReconciliationError when it doesn't add up", () => {
    const header = makeHeader();
    const transactions = [makeTransaction({ amount: "1.00" as never })];
    expect(() => assertIciciStatementReconciles(header, transactions)).toThrow(
      IciciReconciliationError,
    );
  });
});
