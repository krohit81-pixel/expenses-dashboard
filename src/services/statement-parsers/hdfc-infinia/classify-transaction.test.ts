import { describe, expect, it } from "vitest";

import { classifyTransaction, isBankFeeOrTax } from "./classify-transaction";

describe("classifyTransaction", () => {
  it("returns all-false/null for a debit, regardless of description", () => {
    const result = classifyTransaction(
      "CREDIT CARD PAYMENT - THANK YOU",
      "debit",
    );
    expect(result).toEqual({
      isPayment: false,
      isCashback: false,
      isRefund: false,
      creditType: null,
      paymentReference: null,
    });
  });

  it("identifies a payment credit and extracts its reference", () => {
    const result = classifyTransaction(
      "CREDIT CARD PAYMENT - THANK YOU (Ref#1234567890)",
      "credit",
    );
    expect(result.isPayment).toBe(true);
    expect(result.creditType).toBe("payment");
    expect(result.paymentReference).toBe("1234567890");
    expect(result.isCashback).toBe(false);
    expect(result.isRefund).toBe(false);
  });

  it("identifies a payment credit with no reference present", () => {
    const result = classifyTransaction(
      "CREDIT CARD PAYMENT RECEIVED",
      "credit",
    );
    expect(result.isPayment).toBe(true);
    expect(result.creditType).toBe("payment");
    expect(result.paymentReference).toBeNull();
  });

  it("identifies a cashback credit, case-insensitively and with spacing variants", () => {
    const result = classifyTransaction("Cash Back Received", "credit");
    expect(result.isCashback).toBe(true);
    expect(result.creditType).toBe("cashback");
    expect(result.isPayment).toBe(false);
  });

  it("identifies a refund credit", () => {
    const result = classifyTransaction("AMAZON REFUND", "credit");
    expect(result.isRefund).toBe(true);
    expect(result.creditType).toBe("refund");
  });

  it("identifies a reversal credit as a refund, with creditType reversal", () => {
    const result = classifyTransaction("TRANSACTION REVERSAL", "credit");
    expect(result.isRefund).toBe(true);
    expect(result.creditType).toBe("reversal");
  });

  it("prefers reversal classification over a generic refund match", () => {
    // Contains "refund"-adjacent wording but is explicitly a reversal --
    // reversal should win and isRefund should still be true via the
    // isRefund || isReversal fallback, not double-matched.
    const result = classifyTransaction(
      "REFUND REVERSAL - DUPLICATE CHARGE",
      "credit",
    );
    expect(result.creditType).toBe("reversal");
    expect(result.isRefund).toBe(true);
  });

  it("falls back to no creditType for an unrecognized credit description", () => {
    const result = classifyTransaction("MISC ADJUSTMENT", "credit");
    expect(result.creditType).toBeNull();
    expect(result.isPayment).toBe(false);
    expect(result.isCashback).toBe(false);
    expect(result.isRefund).toBe(false);
  });

  it("never returns a paymentReference for a non-payment credit", () => {
    const result = classifyTransaction(
      "Cash Back Received (Ref#999)",
      "credit",
    );
    expect(result.paymentReference).toBeNull();
  });
});

describe("isBankFeeOrTax", () => {
  it("recognizes an IGST tax line", () => {
    expect(
      isBankFeeOrTax(
        "IGST-VPS2713836341577-RATE 18.0 -27 (Ref# VT261380075024430000101)",
      ),
    ).toBe(true);
  });

  it("recognizes the consolidated FCY markup fee line", () => {
    expect(
      isBankFeeOrTax(
        "CONSOLIDATED FCY MARKUP FEE (Ref# VT261660075037290000045)",
      ),
    ).toBe(true);
  });

  it("recognizes a DCC transaction surcharge line", () => {
    expect(
      isBankFeeOrTax(
        "1.75% on all DCC Transaction (Ref# ST261440080000011618910)",
      ),
    ).toBe(true);
  });

  it("does not flag an ordinary merchant description", () => {
    expect(isBankFeeOrTax("EURO DISNEY ASSOCIESCHESSY")).toBe(false);
    expect(isBankFeeOrTax("SOME MERCHANTCITY")).toBe(false);
  });
});
