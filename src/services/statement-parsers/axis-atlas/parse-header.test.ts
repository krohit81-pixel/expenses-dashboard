import { describe, expect, it } from "vitest";

import { AxisHeaderParseError, parseAxisHeader } from "./parse-header";

/**
 * A synthetic single-page statement, entirely fake data, shaped to
 * mirror a real Axis Atlas/HORIZON statement's layout (verified against
 * a real, redacted sample statement during this parser's own delivery
 * -- see this module's comments for why each block is anchored on row
 * *shape* rather than label proximity). Never derived from any real
 * cardholder's statement.
 *
 * The reconciliation-row figures below satisfy the same identity
 * reconcile.ts checks: 5,000.00 (previous) - 5,000.00 (payments) -
 * 200.00 (credits) + 10,200.00 (purchase) + 0.00 (cash advance) +
 * 0.00 (other debit&charges) = 10,000.00 (total).
 */
const PAGE_1 = `Axis Bank HORIZON Credit Card
TEST USER
SOME ADDRESS LINE,
TEST CITY 000000
PAYMENT SUMMARY
Total Payment Due             Minimum Payment Due              Statement Period                 Payment Due Date          Statement Generation Date
10,000.00   Dr                     500.00   Dr                  01/06/2026 - 30/06/2026                 20/07/2026                          30/06/2026
Credit Card Number                   Credit Limit                  Available Credit Limit               Available Cash Limit
123456******7890                  200,000.00                      190,000.00                        50,000.00
Previous Balance - Payments - Credits + Purchase + Cash Advance + Other Debit&Charges =Total Payment Due
5,000.00 Dr         5,000.00       200.00      10,200.00           0.00                   0.00                10,000.00   Dr
Account Summary
DATE                                      TRANSACTION DETAILS                                         MERCHANT CATEGORY                 AMOUNT (Rs.)
Card No:    123456******7890                        Name    TEST USER
01/06/2026      SOME MERCHANT,TEST CITY                                                        DEPT STORES                                              1,000.00 Dr
**** End of Statement ****
eDGE MILES POINTS    BALANCE AS    CUSTOMER ID
ON DATE
5000            30-06-2026       123456`;

describe("parseAxisHeader", () => {
  it("extracts every header field from a well-formed statement", () => {
    const header = parseAxisHeader([PAGE_1]);

    expect(header).toEqual({
      issuer: "AXIS",
      cardType: "atlas",
      cardLast4: "7890",
      primaryCardholder: "TEST USER",
      statementDate: "2026-06-30",
      billingPeriodStart: "2026-06-01",
      billingPeriodEnd: "2026-06-30",
      dueDate: "2026-07-20",
      totalAmountDue: "10000.00",
      minimumDue: "500.00",
      previousStatementDue: "5000.00",
      paymentsReceived: "5200.00",
      purchasesDebit: "10200.00",
      financeCharges: "0.00",
      availableCreditLimit: "190000.00",
      totalCreditLimit: "200000.00",
      availableCashLimit: "50000.00",
      rewardPointsBalance: 5000,
      rewardPointsEarned: 0,
      rewardPointsExpiring30Days: 0,
      rewardPointsExpiring60Days: 0,
      cashbackAmount: "0.00",
      rewardPointsSummary: [],
      cashbackSummary: [],
      statementCurrency: "INR",
    });
  });

  it("throws AxisHeaderParseError when the payment summary block is missing", () => {
    const broken = PAGE_1.replace(
      "10,000.00   Dr                     500.00   Dr                  01/06/2026 - 30/06/2026                 20/07/2026                          30/06/2026\n",
      "",
    );
    expect(() => parseAxisHeader([broken])).toThrow(AxisHeaderParseError);
  });

  it("throws AxisHeaderParseError when the card number can't be found", () => {
    const broken = PAGE_1.replace("123456******7890", "not-a-card-number");
    expect(() => parseAxisHeader([broken])).toThrow(AxisHeaderParseError);
  });

  it("throws AxisHeaderParseError when the primary cardholder name is missing", () => {
    const broken = PAGE_1.replace(
      "Card No:    123456******7890                        Name    TEST USER\n",
      "",
    );
    expect(() => parseAxisHeader([broken])).toThrow(AxisHeaderParseError);
  });

  it("defaults the eDGE Miles balance to 0 when that block is absent", () => {
    const withoutEdge = PAGE_1.replace(/eDGE MILES POINTS[\s\S]*$/, "");
    const header = parseAxisHeader([withoutEdge]);
    expect(header.rewardPointsBalance).toBe(0);
  });
});
