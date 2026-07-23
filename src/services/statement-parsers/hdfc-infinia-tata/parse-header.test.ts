import { describe, expect, it } from "vitest";

import { HdfcHeaderParseError, parseHdfcHeader } from "./parse-header";

/**
 * A synthetic two-page statement text, entirely fake data, shaped to
 * mirror the real HDFC Infinia layout this parser was built against
 * (see this module's own comments for why each block is anchored the
 * way it is): a "PREVIOUS STATEMENT DUES ... TOTAL CREDIT LIMIT" totals
 * run, a limits/due-date block, a rewards-points dashboard, and (on the
 * "second page") the reward-program and cashback summary tables. Never
 * derived from any real cardholder's statement.
 */
const PAGE_1 = `TEST USER Credit Card No. 412345XXXXXX6789
Statement Date 15 Jul, 2026
Billing Period 16 Jun, 2026 - 15 Jul, 2026
PREVIOUS STATEMENT DUES
1,000.00
PAYMENTS RECEIVED
500.00
PURCHASE/DEBITS
2,000.00
FINANCE CHARGES
50.00
TOTAL AMOUNT DUE
2,550.00
TOTAL CREDIT LIMIT AVAILABLE CREDIT LIMIT AVAILABLE CASH LIMIT
5,00,000.00 4,50,000.00 1,00,000.00
MINIMUM DUE DUE DATE
500.00 05 Aug, 2026
Past Dues
Opening Balance Points Earned Disbursed Adjusted-Lapsed
100 200 50 10
Reward Points
1,250
POINTS EXPIRING
IN 30 DAYS 500
IN 60 DAYS 750`;

const PAGE_2 = `Rewards Program Points Summary
1 Some Reward Program 500 pts
Cash Back Summary
1 Test Cashback Reward C 110.00
2 Plain Refund Entry 25.00
Important Information`;

/**
 * A synthetic single-page statement mirroring a real Tata Neu Plus HDFC
 * Bank Credit Card statement's layout -- same "PREVIOUS STATEMENT DUES /
 * TOTAL CREDIT LIMIT" totals block and limits/due-date shape as Infinia
 * above, but a "NeuCoins" rewards block instead of "Opening Balance /
 * POINTS EXPIRING" (and no points-expiry sub-section at all). Never
 * derived from any real cardholder's statement.
 */
const TATA_PAGE_1 = `TEST USER Credit Card No. 652925XXXXXX9936
Statement Date 14 Jul, 2026
Billing Period 15 Jun, 2026 - 14 Jul, 2026
PREVIOUS STATEMENT DUES
1,000.00
PAYMENTS RECEIVED
500.00
PURCHASE/DEBITS
2,000.00
FINANCE CHARGES
50.00
TOTAL AMOUNT DUE
2,550.00
TOTAL CREDIT LIMIT AVAILABLE CREDIT LIMIT AVAILABLE CASH LIMIT
5,00,000.00 4,50,000.00 1,00,000.00
MINIMUM DUE DUE DATE
500.00 05 Aug, 2026
Past Dues
Opening NeuCoins with Bank NeuCoins Earned (Base+Bonus) NeuCoins Transferred to Tata Neu Adjusted/Lapsed
835 9 835 0
9
Note:
1. Some footnote about NeuCoins.`;

describe("parseHdfcHeader", () => {
  it("extracts every header field from a well-formed Infinia statement", () => {
    const header = parseHdfcHeader([PAGE_1, PAGE_2]);

    expect(header).toEqual({
      issuer: "HDFC",
      cardType: "Infinia",
      cardLast4: "6789",
      primaryCardholder: "TEST USER",
      statementDate: "2026-07-15",
      billingPeriodStart: "2026-06-16",
      billingPeriodEnd: "2026-07-15",
      dueDate: "2026-08-05",
      totalAmountDue: "2550.00",
      minimumDue: "500.00",
      previousStatementDue: "1000.00",
      paymentsReceived: "500.00",
      purchasesDebit: "2000.00",
      financeCharges: "50.00",
      availableCreditLimit: "450000.00",
      totalCreditLimit: "500000.00",
      availableCashLimit: "100000.00",
      rewardPointsBalance: 1250,
      rewardPointsEarned: 200,
      rewardPointsExpiring30Days: 500,
      rewardPointsExpiring60Days: 750,
      cashbackAmount: "135.00",
      rewardPointsSummary: [
        { srNo: 1, program: "Some Reward Program", bonusPoints: 500 },
      ],
      cashbackSummary: [
        { srNo: 1, transaction: "Test Cashback Reward", amount: "110.00" },
        { srNo: 2, transaction: "Plain Refund Entry", amount: "25.00" },
      ],
      statementCurrency: "INR",
    });
  });

  /**
   * Tata Neu Plus-variant guard: same totals/limits shape as Infinia
   * everywhere except the rewards section, which prints "NeuCoins"
   * anywhere on page 1 instead of "Opening Balance", and has no
   * points-expiry sub-section at all. detectCardVariant must flip
   * cardType to "Tata Neu Plus", still populate rewardPointsBalance/
   * rewardPointsEarned from the same 4-number-line-then-balance shape
   * (just under different surrounding labels), and default both expiry
   * fields to 0 rather than throwing when "IN 30/60 DAYS" is absent.
   */
  it("detects the Tata Neu Plus variant and reads its NeuCoins block instead of Opening Balance/POINTS EXPIRING", () => {
    const header = parseHdfcHeader([TATA_PAGE_1]);

    expect(header.cardType).toBe("Tata Neu Plus");
    expect(header.rewardPointsEarned).toBe(9);
    expect(header.rewardPointsBalance).toBe(9);
    expect(header.rewardPointsExpiring30Days).toBe(0);
    expect(header.rewardPointsExpiring60Days).toBe(0);
    // Everything else about the statement shape is identical to Infinia.
    expect(header.totalAmountDue).toBe("2550.00");
    expect(header.cardLast4).toBe("9936");
  });

  it("strips trailing currency-symbol noise from a cashback line's description", () => {
    // The real statement's font maps its ₹ glyph to a literal "C" -- this
    // asserts the digit-index slice + trailing-letter-strip in
    // parseCashbackSummary handles that without leaving "C" attached.
    const header = parseHdfcHeader([PAGE_1, PAGE_2]);
    expect(header.cashbackSummary[0]?.transaction).not.toMatch(/[A-Z]$/);
  });

  it("doesn't mistake a leading percentage for the cashback amount", () => {
    // Real statements have rows like "5% CashBack on SmartPay ... C 150.00"
    // -- the "5" in "5%" is a bare, decimal-less number that a looser
    // amount-matcher would grab first instead of the real 150.00 figure.
    const pageWithPercentCashback = PAGE_2.replace(
      "1 Test Cashback Reward C 110.00",
      "1 5% CashBack on SmartPay C 150.00",
    );
    const header = parseHdfcHeader([PAGE_1, pageWithPercentCashback]);
    expect(header.cashbackSummary[0]).toEqual({
      srNo: 1,
      transaction: "5% CashBack on SmartPay",
      amount: "150.00",
    });
  });

  it("defaults to an empty cashback summary and zero cashback amount when the section is absent", () => {
    const pageWithoutCashback = PAGE_1;
    const header = parseHdfcHeader([pageWithoutCashback]);
    expect(header.cashbackSummary).toEqual([]);
    expect(header.cashbackAmount).toBe("0.00");
    expect(header.rewardPointsSummary).toEqual([]);
  });

  it("throws HdfcHeaderParseError when a required field is missing", () => {
    const broken = PAGE_1.replace("Statement Date 15 Jul, 2026\n", "");
    expect(() => parseHdfcHeader([broken, PAGE_2])).toThrow(
      HdfcHeaderParseError,
    );
  });

  it("throws when the card number doesn't match the expected masked shape", () => {
    const broken = PAGE_1.replace(
      "Credit Card No. 412345XXXXXX6789",
      "Credit Card No. 4123456789",
    );
    expect(() => parseHdfcHeader([broken, PAGE_2])).toThrow(
      HdfcHeaderParseError,
    );
  });
});
