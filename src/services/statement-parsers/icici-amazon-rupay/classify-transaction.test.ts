import { describe, expect, it } from "vitest";

import {
  classifyTransaction,
  isBankFeeOrTax,
  isCashAdvance,
} from "./classify-transaction";

describe("classifyTransaction", () => {
  it("returns an all-false classification for a debit", () => {
    const result = classifyTransaction("SOME MERCHANT", "debit");
    expect(result).toEqual({
      isPayment: false,
      isCashback: false,
      isRefund: false,
      creditType: null,
      paymentReference: null,
    });
  });

  it("classifies the bank's own payment-received line as a payment", () => {
    const result = classifyTransaction(
      "INFINITY PAYMENT RECEIVED, THANK YOU",
      "credit",
    );
    expect(result.isPayment).toBe(true);
    expect(result.creditType).toBe("payment");
  });

  /**
   * The real behavior this guards: unlike HDFC/Axis, a real ICICI
   * merchant-refund row carries no "refund" keyword at all -- same
   * description as the original purchase, just with a "CR" suffix. Any
   * credit that isn't the payment-received line is assumed to be a
   * refund by default.
   */
  it("defaults an ordinary merchant credit row (no keyword) to a refund", () => {
    const result = classifyTransaction("SOME MERCHANT TEST CITY IN", "credit");
    expect(result.isRefund).toBe(true);
    expect(result.creditType).toBe("refund");
  });

  it("still recognizes an explicit cashback keyword if one ever appears", () => {
    const result = classifyTransaction("Cash Back Adjustment", "credit");
    expect(result.isCashback).toBe(true);
    expect(result.creditType).toBe("cashback");
  });

  it("still recognizes an explicit reversal keyword if one ever appears", () => {
    const result = classifyTransaction("Transaction Reversal", "credit");
    expect(result.isRefund).toBe(true);
    expect(result.creditType).toBe("reversal");
  });
});

describe("isBankFeeOrTax", () => {
  it("matches a late payment fee line", () => {
    expect(isBankFeeOrTax("Late Payment Fee")).toBe(true);
  });

  it("matches a GST-prefixed line", () => {
    expect(isBankFeeOrTax("GST-Late Fee")).toBe(true);
  });

  /**
   * v1.9.0: a real RuPay-variant statement (spent almost entirely via
   * UPI) printed "DCC Fee" and "SGST-CI@9%"/"CGST-CI@9%" rows that the
   * Amazon Pay statement this classifier started with never had.
   */
  it("matches a DCC (Dynamic Currency Conversion) fee line", () => {
    expect(isBankFeeOrTax("DCC Fee")).toBe(true);
  });

  it("matches an SGST/CGST component line", () => {
    expect(isBankFeeOrTax("SGST-CI@9%")).toBe(true);
    expect(isBankFeeOrTax("CGST-CI@9%")).toBe(true);
  });

  it("does not match an ordinary merchant description", () => {
    expect(isBankFeeOrTax("ZOMATO GURGAON IN")).toBe(false);
  });
});

describe("isCashAdvance", () => {
  it("matches a cash advance description", () => {
    expect(isCashAdvance("Cash Advance Fee")).toBe(true);
  });

  it("matches a cash withdrawal description", () => {
    expect(isCashAdvance("ATM Cash Withdrawal")).toBe(true);
  });

  it("does not match an ordinary merchant description", () => {
    expect(isCashAdvance("SWIGGY BANGALORE IN")).toBe(false);
  });
});
