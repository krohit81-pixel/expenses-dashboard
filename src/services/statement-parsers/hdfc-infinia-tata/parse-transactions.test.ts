import { describe, expect, it } from "vitest";

import {
  HdfcTransactionParseError,
  parseHdfcTransactions,
} from "./parse-transactions";

/**
 * Synthetic fixtures shaped like the real HDFC reconstructed layout (see
 * this module's header comment for the tail-pattern shapes), entirely
 * fake data -- never derived from any real cardholder's statement.
 */
const TABLE_HEADER =
  "DATE & TIME                  TRANSACTION DESCRIPTION                                                     REWARDS                AMOUNT     PI";

const EMI_BOX = "TRANSACTIONS                             TOTAL AMOUNT";

function page(...body: string[]): string {
  return body.join("\n");
}

describe("parseHdfcTransactions", () => {
  it("ignores everything before the transaction table, even all-caps section labels", () => {
    const pageText = page(
      "IMPORTANT INFORMATION",
      "REDEEM REWARDS",
      "Domestic Transactions",
      TABLE_HEADER,
      "TEST USER    [CKYC ID : 1234567890 ]",
      "01/06/2026| 10:00            SOME MERCHANTCITY                                                             C  100.00     l",
    );
    const txns = parseHdfcTransactions([pageText]);
    expect(txns).toHaveLength(1);
    expect(txns[0]?.cardholderName).toBe("TEST USER");
  });

  it("parses a plain debit with no points and no EMI marker", () => {
    const pageText = page(
      TABLE_HEADER,
      "TEST USER    [CKYC ID : 1234567890 ]",
      "01/06/2026| 10:00            SOME MERCHANTCITY                                                             C  100.00     l",
    );
    const [txn] = parseHdfcTransactions([pageText]);
    expect(txn).toMatchObject({
      transactionDate: "2026-06-01",
      transactionTime: "10:00",
      transactionType: "debit",
      amount: "100.00",
      isEmi: false,
      rewardPoints: null,
      creditType: null,
      merchantRaw: "SOME MERCHANTCITY",
      cardholderType: "primary",
      sequenceNumber: 1,
      pageNumber: 1,
    });
  });

  it("parses a debit with reward points and an EMI marker", () => {
    const pageText = page(
      TABLE_HEADER,
      "TEST USER    [CKYC ID : 1234567890 ]",
      "02/06/2026| 11:30    EMI    SOME BIG PURCHASECITY                                                   + 250                  C  9,999.00     l",
    );
    const [txn] = parseHdfcTransactions([pageText]);
    expect(txn).toMatchObject({
      transactionType: "debit",
      isEmi: true,
      rewardPoints: 250,
      amount: "9999.00",
      emiMerchant: "SOME BIG PURCHASECITY",
      emiAmount: "9999.00",
    });
  });

  it("parses a cashback credit with no points", () => {
    const pageText = page(
      TABLE_HEADER,
      "TEST USER    [CKYC ID : 1234567890 ]",
      "03/06/2026| 00:00            5% CashBack on SmartPay                                                             +  C  50.00     l",
    );
    const [txn] = parseHdfcTransactions([pageText]);
    expect(txn).toMatchObject({
      transactionType: "credit",
      isCashback: true,
      creditType: "cashback",
      rewardPoints: null,
      merchantRaw: null,
      merchantNormalized: null,
    });
  });

  it("parses a hypothetical credit that also shows reward points", () => {
    // Not observed in the one real statement this was built against, but
    // documented as a possible tail shape -- this asserts the regex
    // supports it structurally.
    const pageText = page(
      TABLE_HEADER,
      "TEST USER    [CKYC ID : 1234567890 ]",
      "04/06/2026| 09:00            SOME REFUNDCITY                                                   + 15                  +  C  200.00     l",
    );
    const [txn] = parseHdfcTransactions([pageText]);
    expect(txn).toMatchObject({
      transactionType: "credit",
      rewardPoints: 15,
      amount: "200.00",
    });
  });

  it("stitches a payment description wrapped across the row's neighboring lines", () => {
    const pageText = page(
      TABLE_HEADER,
      "TEST USER    [CKYC ID : 1234567890 ]",
      "CREDIT CARD PAYMENTNet Banking (Ref#",
      "05/06/2026| 12:00                                                             +  C  50,000.00     l",
      "00000000009999999999)",
      "Page 1 of 1",
    );
    const [txn] = parseHdfcTransactions([pageText]);
    expect(txn?.description).toBe(
      "CREDIT CARD PAYMENTNet Banking (Ref# 00000000009999999999)",
    );
    expect(txn?.isPayment).toBe(true);
    expect(txn?.creditType).toBe("payment");
    expect(txn?.paymentReference).toBe("00000000009999999999");
    expect(txn?.rawText).toContain("CREDIT CARD PAYMENTNet Banking (Ref#");
    expect(txn?.rawText).toContain("00000000009999999999)");
  });

  it("does not stitch across a page-footer line", () => {
    // The wrap-detection only looks at the immediate next line; a
    // "Page N of M" footer should never be absorbed as a continuation
    // fragment even if it happens to be adjacent.
    const pageText = page(
      TABLE_HEADER,
      "TEST USER    [CKYC ID : 1234567890 ]",
      "06/06/2026| 08:00                                                             C  10.00     l",
      "Page 1 of 1",
    );
    const [txn] = parseHdfcTransactions([pageText]);
    expect(txn?.description).toBe("");
  });

  it("tracks primary vs. add-on cardholder sections, including across a page break", () => {
    const page1 = page(
      TABLE_HEADER,
      "PRIMARY HOLDER    [CKYC ID : 1111111111 ]",
      "01/06/2026| 10:00            FIRST MERCHANTCITY                                                             C  100.00     l",
      "ADDON HOLDER",
      "02/06/2026| 10:00            SECOND MERCHANTCITY                                                             C  200.00     l",
    );
    const page2 = page(
      TABLE_HEADER,
      // No new header on page 2 -- the add-on section from page 1 continues.
      "03/06/2026| 10:00            THIRD MERCHANTCITY                                                             C  300.00     l",
    );
    const txns = parseHdfcTransactions([page1, page2]);
    expect(txns.map((t) => [t.cardholderType, t.cardholderName])).toEqual([
      ["primary", "PRIMARY HOLDER"],
      ["addon", "ADDON HOLDER"],
      ["addon", "ADDON HOLDER"],
    ]);
    expect(txns.map((t) => t.pageNumber)).toEqual([1, 1, 2]);
    expect(txns.map((t) => t.sequenceNumber)).toEqual([1, 2, 3]);
  });

  it("treats a repeated primary-name header as still primary", () => {
    const pageText = page(
      TABLE_HEADER,
      "PRIMARY HOLDER    [CKYC ID : 1111111111 ]",
      "01/06/2026| 10:00            FIRST MERCHANTCITY                                                             C  100.00     l",
      "PRIMARY HOLDER    [CKYC ID : 1111111111 ]",
      "02/06/2026| 10:00            SECOND MERCHANTCITY                                                             C  200.00     l",
    );
    const txns = parseHdfcTransactions([pageText]);
    expect(txns.every((t) => t.cardholderType === "primary")).toBe(true);
  });

  it("excludes the EMI-eligible summary box from the parsed transactions", () => {
    const pageText = page(
      TABLE_HEADER,
      "TEST USER    [CKYC ID : 1234567890 ]",
      "01/06/2026| 10:00            SOME MERCHANTCITY                                                             C  100.00     l",
      EMI_BOX,
      "Eligible for    EMI                                                             CONVERT TO EMI",
      "1                                         C100.00",
    );
    const txns = parseHdfcTransactions([pageText]);
    expect(txns).toHaveLength(1);
  });

  it("stops scanning at the rewards program summary anchor", () => {
    const pageText = page(
      TABLE_HEADER,
      "TEST USER    [CKYC ID : 1234567890 ]",
      "01/06/2026| 10:00            SOME MERCHANTCITY                                                             C  100.00     l",
      "Rewards Program Points Summary",
      "SOME OTHER ALL CAPS LABEL",
      "02/06/2026| 10:00            SHOULD NOT PARSECITY                                                             C  999.00     l",
    );
    const txns = parseHdfcTransactions([pageText]);
    expect(txns).toHaveLength(1);
  });

  it("returns an empty array when no transaction table is present", () => {
    expect(parseHdfcTransactions(["nothing relevant here"])).toEqual([]);
  });

  it("parses an International Transactions row despite the space before the date/time pipe", () => {
    // Real International Transactions rows use "DD/MM/YYYY | HH:MM" (space
    // before the pipe) vs. Domestic's "DD/MM/YYYY| HH:MM", and embed a
    // foreign-currency amount in the description before the reward
    // points/amount tail.
    const pageText = page(
      "International Transactions",
      TABLE_HEADER,
      "TEST USER    [CKYC ID : 1234567890 ]",
      "15/05/2026 | 01:54              EMI     SOME OVERSEAS MERCHANTCITY                                                      EUR 180.00                    + 675                              C  20,252.20      l",
    );
    const [txn] = parseHdfcTransactions([pageText]);
    expect(txn).toMatchObject({
      transactionDate: "2026-05-15",
      transactionTime: "01:54",
      transactionType: "debit",
      isEmi: true,
      rewardPoints: 675,
      amount: "20252.20",
    });
    expect(txn?.merchantRaw).toContain("SOME OVERSEAS MERCHANTCITY");
    expect(txn?.merchantNormalized).toBe("Some Overseas Merchantcity");
  });

  it("stitches an International Transactions IGST wrap row (space-before-pipe date format)", () => {
    const pageText = page(
      "International Transactions",
      TABLE_HEADER,
      "TEST USER    [CKYC ID : 1234567890 ]",
      "IGST-VPS0000000000000-RATE 18.0 -27 (Ref#",
      "17/05/2026 | 00:00                                                             C  57.40      l",
      "VT261380075024430000101)",
    );
    const [txn] = parseHdfcTransactions([pageText]);
    expect(txn).toMatchObject({
      transactionDate: "2026-05-17",
      transactionTime: "00:00",
      transactionType: "debit",
      amount: "57.40",
    });
    expect(txn?.description).toBe(
      "IGST-VPS0000000000000-RATE 18.0 -27 (Ref# VT261380075024430000101)",
    );
  });

  it("parses a CONSOLIDATED FCY MARKUP FEE row using the international date format", () => {
    const pageText = page(
      "International Transactions",
      TABLE_HEADER,
      "TEST USER    [CKYC ID : 1234567890 ]",
      "13/06/2026 | 10:52                       CONSOLIDATED FCY MARKUP FEE                                                             C  16.90      l",
    );
    const [txn] = parseHdfcTransactions([pageText]);
    expect(txn).toMatchObject({
      transactionDate: "2026-06-13",
      transactionType: "debit",
      amount: "16.90",
    });
  });

  it("nulls out merchant fields for an IGST tax line, still counting it as a debit", () => {
    const pageText = page(
      "International Transactions",
      TABLE_HEADER,
      "TEST USER    [CKYC ID : 1234567890 ]",
      "IGST-VPS0000000000000-RATE 18.0 -27 (Ref#",
      "17/05/2026 | 00:00                                                             C  57.40      l",
      "VT261380075024430000101)",
    );
    const [txn] = parseHdfcTransactions([pageText]);
    expect(txn?.transactionType).toBe("debit");
    expect(txn?.amount).toBe("57.40");
    expect(txn?.merchantRaw).toBeNull();
    expect(txn?.merchantNormalized).toBeNull();
  });

  it("nulls out merchant fields for a CONSOLIDATED FCY MARKUP FEE line", () => {
    const pageText = page(
      "International Transactions",
      TABLE_HEADER,
      "TEST USER    [CKYC ID : 1234567890 ]",
      "13/06/2026 | 10:52                       CONSOLIDATED FCY MARKUP FEE                                                             C  16.90      l",
    );
    const [txn] = parseHdfcTransactions([pageText]);
    expect(txn?.merchantRaw).toBeNull();
    expect(txn?.merchantNormalized).toBeNull();
  });

  it("nulls out merchant fields for a DCC transaction surcharge line", () => {
    const pageText = page(
      TABLE_HEADER,
      "TEST USER    [CKYC ID : 1234567890 ]",
      "23/05/2026| 00:00            1.75% on all DCC Transaction (Ref# ST261440080000011618910)                                                             C  62.59     l",
    );
    const [txn] = parseHdfcTransactions([pageText]);
    expect(txn?.merchantRaw).toBeNull();
    expect(txn?.merchantNormalized).toBeNull();
  });

  it("assigns null merchant fields only for a recognized credit type", () => {
    const pageText = page(
      TABLE_HEADER,
      "TEST USER    [CKYC ID : 1234567890 ]",
      // A credit with no recognized description pattern -- treated as
      // an (unusual but real) merchant credit, not nulled out.
      "01/06/2026| 10:00            UNKNOWN CREDIT SOURCE                                                             +  C  5.00     l",
    );
    const [txn] = parseHdfcTransactions([pageText]);
    expect(txn?.creditType).toBeNull();
    expect(txn?.merchantRaw).toBe("UNKNOWN CREDIT SOURCE");
  });
});

describe("HdfcTransactionParseError", () => {
  it("is a real Error subclass with the right name", () => {
    const err = new HdfcTransactionParseError("boom");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("HdfcTransactionParseError");
  });
});
