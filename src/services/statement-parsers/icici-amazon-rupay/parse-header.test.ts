import { describe, expect, it } from "vitest";

import { IciciHeaderParseError, parseIciciHeader } from "./parse-header";

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
const PAGE_1_AMAZON_PAY = `CREDIT CARD STATEMENT
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

/**
 * A synthetic single-page statement shaped to mirror a real RuPay-variant
 * (points-earning, no cashback) ICICI statement -- same layout as
 * PAGE_1_AMAZON_PAY above except its rewards section is "ICICI Bank
 * Rewards / Total Points earned* <N>" instead of "EARNINGS". Also never
 * derived from any real cardholder's statement.
 */
const PAGE_1_RUPAY = `CREDIT CARD STATEMENT
Mr. TEST USER                                                            Some marketing copy here
SOME ADDRESS LINE
TEST CITY
STATEMENT DATE
January 5, 2026                                  Some more marketing copy
PAYMENT DUE DATE
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
ICICl Bank Rewards
Total Points earned*                454
Points earned on iShop             0
Statement period : January 1, 2026 to January 31, 2026`;

describe("parseIciciHeader", () => {
  it("extracts every header field from a well-formed Amazon Pay statement", () => {
    const header = parseIciciHeader([PAGE_1_AMAZON_PAY]);

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

  it("extracts a RuPay-variant statement with cardType RuPay and reward points instead of cashback", () => {
    const header = parseIciciHeader([PAGE_1_RUPAY]);

    expect(header.cardType).toBe("RuPay");
    expect(header.rewardPointsEarned).toBe(454);
    expect(header.cashbackAmount).toBe("0.00");
  });

  it("throws IciciHeaderParseError when the statement summary block is missing", () => {
    const broken = PAGE_1_AMAZON_PAY.replace(
      "\`1,000.00                 \`500.00                      \`50.00                    \`315.44\n",
      "",
    );
    expect(() => parseIciciHeader([broken])).toThrow(IciciHeaderParseError);
  });

  it("throws IciciHeaderParseError when the card number can't be found", () => {
    const broken = PAGE_1_AMAZON_PAY.replace(
      "1234XXXXXXXX5678",
      "not-a-card-number",
    );
    expect(() => parseIciciHeader([broken])).toThrow(IciciHeaderParseError);
  });

  it("throws IciciHeaderParseError when the primary cardholder name is missing", () => {
    const broken = PAGE_1_AMAZON_PAY.replace(
      "Mr. TEST USER                                                            Some marketing copy here\n",
      "",
    );
    expect(() => parseIciciHeader([broken])).toThrow(IciciHeaderParseError);
  });

  it("throws IciciHeaderParseError when the statement period line is missing", () => {
    const broken = PAGE_1_AMAZON_PAY.replace(
      "Statement period : January 1, 2026 to January 31, 2026",
      "",
    );
    expect(() => parseIciciHeader([broken])).toThrow(IciciHeaderParseError);
  });

  it("defaults cashbackAmount to 0.00 and rewardPointsEarned to 0 when neither section is present", () => {
    const withoutEarnings = PAGE_1_AMAZON_PAY.replace(
      "42                          42\n",
      "",
    );
    const header = parseIciciHeader([withoutEarnings]);
    expect(header.cashbackAmount).toBe("0.00");
    expect(header.rewardPointsEarned).toBe(0);
    expect(header.cardType).toBe("RuPay");
  });
});
