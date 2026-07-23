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
   * A real Amazon Pay statement's merchant refund rows carry no "refund"
   * keyword at all -- just the same merchant description as the original
   * purchase, with a "CR" suffix and (often) a negative reward-points
   * value. See classify-transaction.ts for why any non-payment credit
   * defaults to a refund classification.
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
});
