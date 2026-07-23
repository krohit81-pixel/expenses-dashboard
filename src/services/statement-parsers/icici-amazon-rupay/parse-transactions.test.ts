import { describe, expect, it } from "vitest";

import { parseIciciTransactions } from "./parse-transactions";

const HEADER_ROW =
  "Date                 SerNo.           Transaction Details                                  Reward          Intl.#            Amount (in\`)";

describe("parseIciciTransactions", () => {
  it("parses an ordinary debit row", () => {
    const page = `Transaction Details
${HEADER_ROW}
1234XXXXXXXX5678
01/01/2026      10000000001       SOME MERCHANT TEST CITY IN                                  5                                 100.00
# International Spends`;

    const [txn] = parseIciciTransactions([page], "TEST USER");
    expect(txn).toMatchObject({
      transactionDate: "2026-01-01",
      description: "SOME MERCHANT TEST CITY IN",
      merchantRaw: "SOME MERCHANT TEST CITY IN",
      amount: "100.00",
      transactionType: "debit",
      rewardPoints: 5,
      cardholderType: "primary",
      cardholderName: "TEST USER",
    });
  });

  it("parses a foreign-currency row, using the printed INR amount and ignoring the Intl.# column", () => {
    const page = `Transaction Details
${HEADER_ROW}
1234XXXXXXXX5678
02/01/2026      10000000002       SOME FOREIGN MERCHANT US*                         0           20 USD             1,000.00
# International Spends`;

    const [txn] = parseIciciTransactions([page], "TEST USER");
    expect(txn).toMatchObject({
      description: "SOME FOREIGN MERCHANT US*",
      amount: "1000.00",
      transactionType: "debit",
    });
  });

  it("parses a payment-received credit row as non-merchant", () => {
    const page = `Transaction Details
${HEADER_ROW}
1234XXXXXXXX5678
03/01/2026      10000000003       INFINITY PAYMENT RECEIVED, THANK YOU                                         0                                             5,000.00 CR
# International Spends`;

    const [txn] = parseIciciTransactions([page], "TEST USER");
    expect(txn).toMatchObject({
      transactionType: "credit",
      amount: "5000.00",
      isPayment: true,
      creditType: "payment",
      merchantRaw: null,
      merchantNormalized: null,
    });
  });

  /**
   * A real ICICI merchant refund row carries no "refund" keyword at all
   * -- just the same merchant description as the original purchase, with
   * a "CR" suffix and (often) a negative reward-points value. See
   * classify-transaction.ts for why any non-payment credit defaults to a
   * refund classification.
   */
  it("classifies an unlabeled merchant credit row as a refund, non-merchant", () => {
    const page = `Transaction Details
${HEADER_ROW}
1234XXXXXXXX5678
04/01/2026      10000000004       SOME MERCHANT TEST CITY IN                                                       -5                                                  50.00 CR
# International Spends`;

    const [txn] = parseIciciTransactions([page], "TEST USER");
    expect(txn).toMatchObject({
      transactionType: "credit",
      amount: "50.00",
      rewardPoints: -5,
      isRefund: true,
      creditType: "refund",
      merchantRaw: null,
      merchantNormalized: null,
    });
  });

  it("marks a bank fee/tax line as non-merchant", () => {
    const page = `Transaction Details
${HEADER_ROW}
1234XXXXXXXX5678
05/01/2026      10000000005       Late Payment Fee                                                              0                                 500.00
# International Spends`;

    const [txn] = parseIciciTransactions([page], "TEST USER");
    expect(txn?.merchantRaw).toBeNull();
    expect(txn?.merchantNormalized).toBeNull();
  });

  it("detects an EMI conversion row", () => {
    const page = `Transaction Details
${HEADER_ROW}
1234XXXXXXXX5678
06/01/2026      10000000006       SOME MERCHANT EMI CONVERSION                                          0                                     2,000.00
# International Spends`;

    const [txn] = parseIciciTransactions([page], "TEST USER");
    expect(txn?.isEmi).toBe(true);
    expect(txn?.emiAmount).toBe("2000.00");
  });

  it("stops parsing at the International Spends footnote", () => {
    const page = `Transaction Details
${HEADER_ROW}
1234XXXXXXXX5678
01/01/2026      10000000001       SOME MERCHANT TEST CITY IN                                  5                                 100.00
# International Spends
07/01/2026      10000000007       SHOULD NOT BE PARSED                                        0                                 999.00`;

    const transactions = parseIciciTransactions([page], "TEST USER");
    expect(transactions).toHaveLength(1);
  });

  it("returns no transactions when the transaction table marker never appears", () => {
    const page = "Some unrelated page text with no transaction table at all.";
    expect(parseIciciTransactions([page], "TEST USER")).toEqual([]);
  });

  it("still matches a row when only a single space separates each column", () => {
    const page = `Transaction Details
${HEADER_ROW}
1234XXXXXXXX5678
01/01/2026 10000000001 SOME MERCHANT TEST CITY IN 5 100.00
# International Spends`;

    const [txn] = parseIciciTransactions([page], "TEST USER");
    expect(txn).toMatchObject({
      transactionDate: "2026-01-01",
      description: "SOME MERCHANT TEST CITY IN",
      amount: "100.00",
      transactionType: "debit",
    });
  });

  /**
   * v1.9.0 regression guard: a real RuPay-on-UPI statement wraps a long
   * merchant description onto the line immediately below its own row --
   * e.g. "UPI-616622925270-TOBOX VE NTURES" continuing with just "PRIVAT
   * IN" on the next line. Dropped entirely by an earlier version of this
   * parser (only Amazon Pay's never-wrapped rows had been seen at the
   * time); the continuation must now be stitched back onto the
   * description.
   */
  it("stitches an immediately-wrapped description continuation onto the row", () => {
    const page = `Transaction Details
${HEADER_ROW}
1234XXXXXXXX5678
15/01/2026      10000000008       UPI-616622925270-TOBOX VE NTURES                 3                                 168.00
PRIVAT IN
# International Spends`;

    const [txn] = parseIciciTransactions([page], "TEST USER");
    expect(txn).toMatchObject({
      description: "UPI-616622925270-TOBOX VE NTURES PRIVAT IN",
      merchantNormalized: "Tobox Ventures",
      amount: "168.00",
    });
  });

  /**
   * v1.9.0 regression guard: on a real statement, the wrapped
   * continuation fragment isn't always the very next line -- a "SPENDS
   * OVERVIEW" donut-chart label (e.g. "Fuel-1% Others-25%") or a masked
   * card/token number can land in between, both purely visual layout
   * noise. The continuation must still be found past that noise.
   */
  it("stitches a wrapped continuation even when a chart-label or masked-card noise line sits in between", () => {
    const page = `Transaction Details
${HEADER_ROW}
1234XXXXXXXX5678
16/01/2026      10000000009       UPI-616902091680-SALVI PE TRO STATION            0                                 433.42
Fuel-1%                     Others-25%
IN
17/01/2026      10000000010       ANOTHER MERCHANT                                        0                                    50.00
# International Spends`;

    const [firstTxn, secondTxn] = parseIciciTransactions([page], "TEST USER");
    expect(firstTxn).toMatchObject({
      description: "UPI-616902091680-SALVI PE TRO STATION IN",
      amount: "433.42",
    });
    expect(secondTxn).toMatchObject({
      description: "ANOTHER MERCHANT",
      amount: "50.00",
    });
  });

  it("does not stitch a masked card number line onto the preceding description", () => {
    const page = `Transaction Details
${HEADER_ROW}
1234XXXXXXXX5678
18/01/2026      10000000011       INFINITY PAYMENT RECEIVED, THANK YOU           0                          31,108.80 CR
6528XXXXXXXX7000
19/01/2026      10000000012       UPI-616622925270-SOME MERCHANT                 3                                 168.00
# International Spends`;

    const [firstTxn, secondTxn] = parseIciciTransactions([page], "TEST USER");
    expect(firstTxn?.description).toBe("INFINITY PAYMENT RECEIVED, THANK YOU");
    expect(secondTxn?.description).toBe("UPI-616622925270-SOME MERCHANT");
  });
});
