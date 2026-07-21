import { describe, expect, it } from "vitest";

import { classifyTransaction, isBankFeeOrTax } from "./classify-transaction";

describe("classifyTransaction", () => {
  it("returns an unclassified debit for an ordinary purchase", () => {
    expect(classifyTransaction("SOME MERCHANT,CITY", "debit")).toEqual({
      isPayment: false,
      isCashback: false,
      isRefund: false,
      creditType: null,
      paymentReference: null,
    });
  });

  it("classifies a credit-card-payment credit", () => {
    const result = classifyTransaction(
      "BBPS PAYMENT RECEIVED - BD016184BALAAALXJ890",
      "credit",
    );
    expect(result.creditType).toBeNull();
    expect(result.isPayment).toBe(false);
  });

  it("classifies an explicit 'Credit Card Payment' credit as a payment", () => {
    const result = classifyTransaction(
      "Credit Card Payment (Ref#ABC123)",
      "credit",
    );
    expect(result.isPayment).toBe(true);
    expect(result.creditType).toBe("payment");
    expect(result.paymentReference).toBe("ABC123");
  });

  it("classifies a cashback credit", () => {
    const result = classifyTransaction("Cash Back Reward", "credit");
    expect(result.isCashback).toBe(true);
    expect(result.creditType).toBe("cashback");
  });

  it("classifies a refund credit", () => {
    const result = classifyTransaction("Merchant Refund", "credit");
    expect(result.isRefund).toBe(true);
    expect(result.creditType).toBe("refund");
  });

  it("classifies a reversal credit as a refund-type credit", () => {
    const result = classifyTransaction("Transaction Reversal", "credit");
    expect(result.isRefund).toBe(true);
    expect(result.creditType).toBe("reversal");
  });
});

describe("isBankFeeOrTax", () => {
  it.each([
    "IGST-Foreign Currency Markup",
    "CGST-Late Payment Fee",
    "SGST-Late Payment Fee",
    "GST-Annual Fee",
    "CONSOLIDATED FCY MARKUP FEE",
    "DCC Transaction Markup",
    "Overdue Penalty/late payment fee",
    "Late Fee Charged",
    "Annual Fee 2026",
    "Finance Charge for June",
    "Forex markup on international spend",
  ])("recognizes %s as a bank fee/tax line", (description) => {
    expect(isBankFeeOrTax(description)).toBe(true);
  });

  it("does not flag an ordinary merchant purchase", () => {
    expect(isBankFeeOrTax("SOME MERCHANT,CITY")).toBe(false);
  });
});
