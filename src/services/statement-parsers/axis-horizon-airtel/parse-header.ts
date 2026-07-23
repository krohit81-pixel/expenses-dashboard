import { addMoney, ZERO, type Money } from "@/lib/money";

import { findAmount, findInteger } from "./amounts";
import type {
  AxisStatementHeader,
  CashbackSummaryLine,
  RewardProgramLine,
} from "./types";

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/**
 * Axis's own PAYMENT SUMMARY / transaction-table dates are always
 * "DD/MM/YYYY" (never the "17 Jul, 2026" shape HDFC uses) -- the
 * month-name branch below is kept only as a defensive fallback in case
 * a differently-generated Axis statement ever prints one that way, same
 * spirit as HDFC's parseHdfcDate.
 */
function parseAxisDate(text: string): string | null {
  const trimmed = text.trim();
  const slashMatch = trimmed.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[2].padStart(2, "0")}-${slashMatch[1].padStart(2, "0")}`;
  }
  const monthMatch = trimmed.match(
    /(\d{1,2})\s+([A-Za-z]{3})[a-z]*,?\s+(\d{4})/,
  );
  if (!monthMatch) return null;
  const month = MONTHS[monthMatch[2].toLowerCase()];
  if (!month) return null;
  const day = monthMatch[1].padStart(2, "0");
  return `${monthMatch[3]}-${String(month).padStart(2, "0")}-${day}`;
}

export class AxisHeaderParseError extends Error {
  constructor(missingField: string) {
    super(`Could not find "${missingField}" in the statement header.`);
    this.name = "AxisHeaderParseError";
  }
}

function requireMatch(
  text: string,
  pattern: RegExp,
  fieldName: string,
): RegExpMatchArray {
  const match = text.match(pattern);
  if (!match) throw new AxisHeaderParseError(fieldName);
  return match;
}

/**
 * The "PAYMENT SUMMARY" block's two header/value row pairs. Real Axis
 * statements print several distinct dollar figures/dates on ONE shared
 * value row per label row (e.g. "Total Payment Due  Minimum Payment Due
 * Statement Period  Payment Due Date  Statement Generation Date" as the
 * label row, then "88,135.69 Dr  1,763.00 Dr  20/06/2026 - 18/07/2026
 * 07/08/2026  18/07/2026" as the value row directly under it) -- a
 * label-then-forward-scan-for-the-next-number approach (which an
 * earlier draft of this parser used) silently grabs the WRONG column's
 * value for every label except the first one, since scanning forward
 * from a label's text offset always hits the value row's first number
 * regardless of which label matched. Anchoring on the whole row's shape
 * in one regex (mirroring HDFC's parseLimitsBlock) avoids that: every
 * field is captured by its actual position, not by proximity to a label
 * that may sit anywhere in the row above. Confirmed identical on both
 * real card products this module covers (Horizon and Airtel).
 */
function parsePaymentSummaryBlock(page1: string): {
  totalAmountDue: Money;
  minimumDue: Money;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  dueDate: string;
  statementDate: string;
} {
  const match = requireMatch(
    page1,
    /Total Payment Due\s+Minimum Payment Due\s+Statement Period\s+Payment Due Date\s+Statement Generation Date\s*\n([\d,]+\.\d{2})\s*Dr\s+([\d,]+\.\d{2})\s*Dr\s+(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/,
    "paymentSummary",
  );
  const totalAmountDue = findAmount(match[1]!);
  const minimumDue = findAmount(match[2]!);
  const billingPeriodStart = parseAxisDate(match[3]!);
  const billingPeriodEnd = parseAxisDate(match[4]!);
  const dueDate = parseAxisDate(match[5]!);
  const statementDate = parseAxisDate(match[6]!);
  if (
    !totalAmountDue ||
    !minimumDue ||
    !billingPeriodStart ||
    !billingPeriodEnd ||
    !dueDate ||
    !statementDate
  ) {
    throw new AxisHeaderParseError("paymentSummary");
  }
  return {
    totalAmountDue,
    minimumDue,
    billingPeriodStart,
    billingPeriodEnd,
    dueDate,
    statementDate,
  };
}

/**
 * The reconciliation-formula row: "Previous Balance - Payments - Credits
 * + Purchase + Cash Advance + Other Debit&Charges = Total Payment Due",
 * 7 amounts on the value row directly under it, always in that order.
 * Axis's formula has more terms than HDFC's ("previousDue - payments +
 * purchases + financeCharges = total"): it separately breaks out
 * "Credits" (refunds/reversals distinct from payments) and splits what
 * HDFC calls "finance charges" into "Cash Advance" + "Other
 * Debit&Charges". To keep reconcile.ts's identity check (and the
 * AxisStatementHeader shape) unchanged from HDFC's, paymentsReceived
 * folds in Credits and financeCharges folds in Cash Advance + Other
 * Debit&Charges -- verified against two real statements (Horizon and
 * Airtel) to reproduce the exact printed Total Payment Due to the
 * paisa.
 */
function parseReconciliationRow(page1: string): {
  previousStatementDue: Money;
  paymentsReceived: Money;
  purchasesDebit: Money;
  financeCharges: Money;
} {
  const match = requireMatch(
    page1,
    /([\d,]+\.\d{2})\s*Dr\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*Dr/,
    "reconciliationRow",
  );
  const previousStatementDue = findAmount(match[1]!);
  const payments = findAmount(match[2]!);
  const credits = findAmount(match[3]!);
  const purchasesDebit = findAmount(match[4]!);
  const cashAdvance = findAmount(match[5]!);
  const otherDebitCharges = findAmount(match[6]!);
  if (
    !previousStatementDue ||
    !payments ||
    !credits ||
    !purchasesDebit ||
    !cashAdvance ||
    !otherDebitCharges
  ) {
    throw new AxisHeaderParseError("reconciliationRow");
  }
  return {
    previousStatementDue,
    paymentsReceived: addMoney(payments, credits),
    purchasesDebit,
    financeCharges: addMoney(cashAdvance, otherDebitCharges),
  };
}

/**
 * "Credit Card Number / Credit Limit / Available Credit Limit /
 * Available Cash Limit" label row, then a value row with the masked
 * card number followed by the three limit amounts, in that order.
 * Confirmed identical mask shape (6 digits, 6 asterisks, 4 digits) on
 * both real card products this module covers.
 */
function parseLimitsBlock(page1: string): {
  cardLast4: string;
  totalCreditLimit: Money;
  availableCreditLimit: Money;
  availableCashLimit: Money;
} {
  const cardMatch = requireMatch(
    page1,
    /(\d{6})\*{6}(\d{4})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/,
    "creditLimits",
  );
  const cardLast4 = cardMatch[2]!;
  const totalCreditLimit = findAmount(cardMatch[3]!);
  const availableCreditLimit = findAmount(cardMatch[4]!);
  const availableCashLimit = findAmount(cardMatch[5]!);
  if (!totalCreditLimit || !availableCreditLimit || !availableCashLimit) {
    throw new AxisHeaderParseError("creditLimits");
  }
  return {
    cardLast4,
    totalCreditLimit,
    availableCreditLimit,
    availableCashLimit,
  };
}

/**
 * "eDGE MILES POINTS   BALANCE AS   CUSTOMER ID" / "ON DATE" label
 * block, then a value row "<balance>  <as-of date>  <customer id>".
 * This is the Horizon card's reward-currency balance -- structurally
 * nothing like HDFC's rewardPointsBalance/rewardPointsEarned pair (no
 * "points earned this cycle" figure is printed anywhere on this
 * statement), so only the balance is populated; rewardPointsEarned and
 * the 30/60-day expiry figures default to 0 rather than being guessed
 * at. Only ever present on a Horizon statement -- see detectCardVariant
 * below, which is what actually decides whether this gets called.
 */
function parseEdgeMilesBalance(page1: string): number {
  const match = page1.match(
    /eDGE MILES POINTS\s+BALANCE AS\s+CUSTOMER ID[\s\S]*?\n([\d,]+)\s+\d{2}-\d{2}-\d{4}\s+\d+/,
  );
  const balance = match ? findInteger(match[1]!) : null;
  return balance ?? 0;
}

/**
 * "CASHBACK DETAILS" / "Cashback Earned   Cashback Credited" label row,
 * then a value row "<earned>  <credited>" -- the Airtel co-branded
 * card's rewards section, printed in place of Horizon's eDGE Miles
 * balance block. Only "earned this cycle" is surfaced on
 * AxisStatementHeader (matching what the RewardProgram/CashbackSummary
 * comments already document: this statement doesn't break cashback down
 * per-transaction anywhere, just these two running totals), the
 * "credited" figure isn't tracked separately since nothing downstream
 * needs it yet.
 */
function parseCashbackDetails(page1: string): Money {
  const match = page1.match(
    /Cashback Earned\s+Cashback Credited\s*\n\s*([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/i,
  );
  if (!match) return ZERO;
  return findAmount(match[1]!) ?? ZERO;
}

/**
 * Reads whichever rewards section a real statement actually prints --
 * "CASHBACK DETAILS" for the Airtel co-branded Mastercard, "eDGE MILES
 * POINTS" for the Horizon card -- to decide cardType. Both real samples
 * this module has been tested against also print their own product name
 * plainly at the top of page 1 ("Axis Bank HORIZON Credit Card" /
 * "Airtel Axis Bank Mastercard Credit Card Statement"), but anchoring on
 * the rewards section instead keeps this parser working even if a
 * future statement's masthead wording changes, since the rewards-section
 * shape is also load-bearing for reconciliation-adjacent fields
 * (rewardPointsBalance / cashbackAmount) either way.
 */
function detectCardVariant(page1: string): {
  cardType: "horizon" | "airtel";
  rewardPointsBalance: number;
  cashbackAmount: Money;
} {
  if (/CASHBACK DETAILS/i.test(page1)) {
    return {
      cardType: "airtel",
      rewardPointsBalance: 0,
      cashbackAmount: parseCashbackDetails(page1),
    };
  }
  return {
    cardType: "horizon",
    rewardPointsBalance: parseEdgeMilesBalance(page1),
    cashbackAmount: ZERO,
  };
}

/**
 * Axis's Horizon/Airtel statement formats don't print the "Rewards
 * Program Points Summary" / "Cash Back Summary" per-transaction tables
 * HDFC's does -- neither section header appears anywhere in either real
 * statement this module has been tested against. Left as always-empty
 * rather than a sliceBetween lookup against anchor text that can never
 * match, which would be misleading dead code. Revisit if a future Axis
 * statement turns out to print one after all.
 */
function parseRewardProgramSummary(): RewardProgramLine[] {
  return [];
}

function parseCashbackSummary(): CashbackSummaryLine[] {
  return [];
}

export function parseAxisHeader(pageTexts: string[]): AxisStatementHeader {
  const page1 = pageTexts[0] ?? "";

  const primaryCardholder = requireMatch(
    page1,
    /Card No:\s*\S+\s+Name\s+([^\n]+)/i,
    "primaryCardholder",
  )[1]!.trim();

  const summary = parsePaymentSummaryBlock(page1);
  const recon = parseReconciliationRow(page1);
  const limits = parseLimitsBlock(page1);
  const variant = detectCardVariant(page1);

  return {
    issuer: "AXIS",
    cardType: variant.cardType,
    cardLast4: limits.cardLast4,
    primaryCardholder,
    statementDate: summary.statementDate,
    billingPeriodStart: summary.billingPeriodStart,
    billingPeriodEnd: summary.billingPeriodEnd,
    dueDate: summary.dueDate,
    totalAmountDue: summary.totalAmountDue,
    minimumDue: summary.minimumDue,
    previousStatementDue: recon.previousStatementDue,
    paymentsReceived: recon.paymentsReceived,
    purchasesDebit: recon.purchasesDebit,
    financeCharges: recon.financeCharges,
    availableCreditLimit: limits.availableCreditLimit,
    totalCreditLimit: limits.totalCreditLimit,
    availableCashLimit: limits.availableCashLimit,
    rewardPointsBalance: variant.rewardPointsBalance,
    rewardPointsEarned: 0,
    rewardPointsExpiring30Days: 0,
    rewardPointsExpiring60Days: 0,
    cashbackAmount: variant.cashbackAmount,
    rewardPointsSummary: parseRewardProgramSummary(),
    cashbackSummary: parseCashbackSummary(),
    statementCurrency: "INR",
  };
}
