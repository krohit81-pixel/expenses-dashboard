import { describe, expect, it } from "vitest";

import { parseAxisTransactions } from "./parse-transactions";

const HEADER_ROWS =
  "DATE                                      TRANSACTION DETAILS                                         MERCHANT CATEGORY                 AMOUNT (Rs.)";

describe("parseAxisTransactions", () => {
  it("parses an ordinary debit row with a merchant category", () => {
    const page = `TRANSACTION DETAILS
${HEADER_ROWS}
Card No:    123456******7890                        Name    TEST USER
01/06/2026      SOME MERCHANT,TEST CITY                                                        DEPT STORES                                              1,000.00 Dr
**** End of Statement ****`;

    const [txn] = parseAxisTransactions([page]);
    expect(txn).toMatchObject({
      transactionDate: "2026-06-01",
      description: "SOME MERCHANT,TEST CITY",
      merchantRaw: "SOME MERCHANT,TEST CITY",
      amount: "1000.00",
      transactionType: "debit",
      purchaseIndicatorName: "DEPT STORES",
      cardholderType: "primary",
      cardholderName: "TEST USER",
    });
  });

  it("parses a credit row with no merchant category (e.g. a payment received)", () => {
    const page = `TRANSACTION DETAILS
${HEADER_ROWS}
Card No:    123456******7890                        Name    TEST USER
02/06/2026      BBPS PAYMENT RECEIVED - REF12345                                                             5,000.00 Cr
**** End of Statement ****`;

    const [txn] = parseAxisTransactions([page]);
    expect(txn?.purchaseIndicatorName).toBeNull();
    expect(txn?.transactionType).toBe("credit");
    expect(txn?.amount).toBe("5000.00");
  });

  it("does not glue the merchant category onto merchantRaw", () => {
    // The bug this guards against: an earlier draft's single lazy
    // capture group between the date and the amount absorbed the whole
    // "MERCHANT CATEGORY" column (plus its proportional gap) into the
    // description, so merchantRaw would vary with description length
    // and never reliably match an existing Merchant Dictionary alias.
    const page = `TRANSACTION DETAILS
${HEADER_ROWS}
Card No:    123456******7890                        Name    TEST USER
01/06/2026      SOME MERCHANT,TEST CITY                                                        DEPT STORES                                              1,000.00 Dr
**** End of Statement ****`;

    const [txn] = parseAxisTransactions([page]);
    expect(txn?.merchantRaw).toBe("SOME MERCHANT,TEST CITY");
    expect(txn?.merchantRaw).not.toMatch(/DEPT STORES/);
  });

  it("marks a bank fee/tax line as non-merchant", () => {
    const page = `TRANSACTION DETAILS
${HEADER_ROWS}
Card No:    123456******7890                        Name    TEST USER
03/06/2026      IGST-Foreign Currency Markup                                                   750.00 Dr
**** End of Statement ****`;

    const [txn] = parseAxisTransactions([page]);
    expect(txn?.merchantRaw).toBeNull();
    expect(txn?.merchantNormalized).toBeNull();
  });

  it("detects an EMI conversion row", () => {
    const page = `TRANSACTION DETAILS
${HEADER_ROWS}
Card No:    123456******7890                        Name    TEST USER
04/06/2026      SOME MERCHANT EMI CONVERSION                                          CLOTH STORES                                     2,000.00 Dr
**** End of Statement ****`;

    const [txn] = parseAxisTransactions([page]);
    expect(txn?.isEmi).toBe(true);
    expect(txn?.emiAmount).toBe("2000.00");
  });

  it("distinguishes an add-on cardholder's transactions from the primary's", () => {
    const page = `TRANSACTION DETAILS
${HEADER_ROWS}
Card No:    123456******7890                        Name    PRIMARY PERSON
01/06/2026      PRIMARY MERCHANT,TEST CITY                                                     DEPT STORES                                     500.00 Dr
Card No:    123456******1111                        Name    ADDON PERSON
02/06/2026      ADDON MERCHANT,TEST CITY                                                       SERVICES                                        300.00 Dr
**** End of Statement ****`;

    const [primaryTxn, addonTxn] = parseAxisTransactions([page]);
    expect(primaryTxn?.cardholderType).toBe("primary");
    expect(addonTxn?.cardholderType).toBe("addon");
    expect(addonTxn?.cardholderName).toBe("ADDON PERSON");
  });

  it("stops parsing at the End of Statement marker", () => {
    const page = `TRANSACTION DETAILS
${HEADER_ROWS}
Card No:    123456******7890                        Name    TEST USER
01/06/2026      SOME MERCHANT,TEST CITY                                                        DEPT STORES                                              1,000.00 Dr
**** End of Statement ****
Schedule of charges
01/07/2026      SHOULD NOT BE PARSED                                                             999.00 Dr`;

    const transactions = parseAxisTransactions([page]);
    expect(transactions).toHaveLength(1);
  });

  it("returns no transactions when the transaction table marker never appears", () => {
    const page = "Some unrelated page text with no transaction table at all.";
    expect(parseAxisTransactions([page])).toEqual([]);
  });

  /**
   * v1.7.2 regression guard: a real production upload reconciled the
   * header perfectly but found ZERO transactions, never reproduced
   * locally -- traced to ROW_REGEX previously *requiring* a literal
   * 2-or-more-space run between the description/category and the
   * amount as part of matching the row at all. PDF text-layout
   * reconstruction's exact space count depends on pdf.js font metrics,
   * which can differ across environments (see extract-text.ts's
   * useSystemFonts), so a boundary that's reliably 2+ spaces in one
   * environment isn't guaranteed to be 2+ everywhere. This fixture has
   * only a SINGLE space before the amount -- the row must still match.
   */
  it("still matches a row when only a single space separates the description from the amount", () => {
    const page = `TRANSACTION DETAILS
${HEADER_ROWS}
Card No:    123456******7890                        Name    TEST USER
01/06/2026 SOME MERCHANT,TEST CITY 1,000.00 Dr
**** End of Statement ****`;

    const [txn] = parseAxisTransactions([page]);
    expect(txn).toMatchObject({
      transactionDate: "2026-06-01",
      description: "SOME MERCHANT,TEST CITY",
      amount: "1000.00",
      transactionType: "debit",
      purchaseIndicatorName: null,
    });
  });
});
