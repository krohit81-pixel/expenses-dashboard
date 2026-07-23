import { describe, expect, it } from "vitest";

import { IciciHeaderParseError, parseIciciAmazonHeader } from "./parse-header";

/**
 * A synthetic single-page statement, entirely fake data, shaped to mirror
 * a real Amazon Pay ICICI statement's layout (verified against a real,
 * redacted sample statement during this parser's own delivery -- see
 * this module's comments for why the date labels and statement-summary
 * block are each anchored the way they are). Never derived from any real
 * cardholder's statement.
 *
 * The statement-summary figures below satisfy the same identity
 * reconcile.ts checks: 1,000.00 (previous) + 500.00 (purchases) + 50.00
 * (cash advances) - 315.44 (payments/credits) = 1,234.56 (total).
 */
const PAGE_1 = `CREDIT CARD STATEMENT
Mr. TEST USER                                                            Some marketing copy here
SOME ADDRESS LINE
TEST CITY
STATEMENT DATESTATEMENT DATE
January 5, 2026                                  Some more marketing copy
PAYMENT DUE DATEPAYMENT DUE DATE
January 25, 2026                                                            Scan to Pay using
STATEMENT SUMMARY
Total Amount due                                    Previous Balance             Purchases / Charges              Cash Advances               Payments / Credits
=                                            +                                    +                           -
\`1,234.56
\`1,000.00                 \`500.00                      \`50.00                    \`315.44
Minimum Amount due                 CREDIT SUMMARY
\`50.00
Credit Limit (Including cash)     Available Credit (Including cash)               Cash Limit                     Available Cash
Interest will be charged if your
total amount due is not paid
\`2,00,000.00               \`1,90,000.00                 \`50,000.00                 \`45,000.00
Date                 SerNo.           Transaction Details                                  Reward          Intl.#            Amount (in\`)
1234XXXXXXXX5678
01/01/2026      10000000001       SOME MERCHANT TEST CITY IN                                  5                                 100.00
EARNINGS
42                          42
Statement period : January 1, 2026 to January 31, 2026`;

describe("parseIciciAmazonHeader", () => {
  it("extracts every header field from a well-formed statement", () => {
    const header = parseIciciAmazonHeader([PAGE_1]);

    expect(header).toEqual({
      issuer: "ICICI",
      cardType: "Amazon Pay",
      cardLast4: "5678",
      primaryCardholder: "TEST USER",
      statementDate: "2026-01-05",
      billingPeriodStart: "2026-01-01",
      billingPeriodEnd: "2026-01-31",
      dueDate: "2026-01-25",
      totalAmountDue: "1234.56",
      minimumDue: "50.00",
      previousStatementDue: "1000.00",
      paymentsReceived: "315.44",
      purchasesDebit: "500.00",
      financeCharges: "50.00",
      availableCreditLimit: "190000.00",
      totalCreditLimit: "200000.00",
      availableCashLimit: "45000.00",
      rewardPointsBalance: 0,
      rewardPointsEarned: 0,
      rewardPointsExpiring30Days: 0,
      rewardPointsExpiring60Days: 0,
      cashbackAmount: "42.00",
      rewardPointsSummary: [],
      cashbackSummary: [],
      statementCurrency: "INR",
    });
  });

  it("throws IciciHeaderParseError when the statement summary block is missing", () => {
    const broken = PAGE_1.replace(
      "\`1,000.00                 \`500.00                      \`50.00                    \`315.44\n",
      "",
    );
    expect(() => parseIciciAmazonHeader([broken])).toThrow(
      IciciHeaderParseError,
    );
  });

  it("throws IciciHeaderParseError when the card number can't be found", () => {
    const broken = PAGE_1.replace("1234XXXXXXXX5678", "not-a-card-number");
    expect(() => parseIciciAmazonHeader([broken])).toThrow(
      IciciHeaderParseError,
    );
  });

  it("throws IciciHeaderParseError when the primary cardholder name is missing", () => {
    const broken = PAGE_1.replace(
      "Mr. TEST USER                                                            Some marketing copy here\n",
      "",
    );
    expect(() => parseIciciAmazonHeader([broken])).toThrow(
      IciciHeaderParseError,
    );
  });

  it("throws IciciHeaderParseError when the statement period line is missing", () => {
    const broken = PAGE_1.replace(
      "Statement period : January 1, 2026 to January 31, 2026",
      "",
    );
    expect(() => parseIciciAmazonHeader([broken])).toThrow(
      IciciHeaderParseError,
    );
  });

  it("defaults cashbackAmount to 0.00 when the EARNINGS figure is absent", () => {
    const withoutEarnings = PAGE_1.replace(
      "42                          42\n",
      "",
    );
    const header = parseIciciAmazonHeader([withoutEarnings]);
    expect(header.cashbackAmount).toBe("0.00");
  });
});
