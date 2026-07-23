import { type Money } from "@/lib/money";

import { findAllAmounts, findAmount } from "./amounts";
import type { IciciStatementHeader } from "./types";

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
 * ICICI prints every header date as "July 12, 2026" -- month name first,
 * unlike HDFC's "17 Jul, 2026" (day first). Reuses the same
 * first-3-letters-of-the-month-name lookup HDFC/Axis already use (so a
 * full month name like "July" still resolves via its "Jul" prefix), just
 * with the day/month swapped in the surrounding pattern.
 */
function parseIciciDate(text: string): string | null {
  const match = text.trim().match(/([A-Za-z]{3})[a-z]*\s+(\d{1,2}),\s*(\d{4})/);
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  if (!month) return null;
  const day = match[2].padStart(2, "0");
  return `${match[3]}-${String(month).padStart(2, "0")}-${day}`;
}

export class IciciHeaderParseError extends Error {
  constructor(missingField: string) {
    super(`Could not find "${missingField}" in the statement header.`);
    this.name = "IciciHeaderParseError";
  }
}

function requireMatch(
  text: string,
  pattern: RegExp,
  fieldName: string,
): RegExpMatchArray {
  const match = text.match(pattern);
  if (!match) throw new IciciHeaderParseError(fieldName);
  return match;
}

function sliceBetween(
  text: string,
  startAnchor: string,
  endAnchor: string,
): string {
  const startIndex = text.indexOf(startAnchor);
  if (startIndex === -1) return "";
  const from = startIndex + startAnchor.length;
  const endIndex = text.indexOf(endAnchor, from);
  return endIndex === -1 ? text.slice(from) : text.slice(from, endIndex);
}

/**
 * "STATEMENT DATE"/"PAYMENT DUE DATE" print as section labels (each
 * doubled with no separator in the extracted text -- a background-image
 * rendering artifact, not a real repeat -- e.g. "STATEMENT
 * DATESTATEMENT DATE") with their actual value on its own line further
 * down, mixed in with unrelated marketing copy. Scoped by finding the
 * label, then taking the first "Month DD, YYYY"-shaped line after it,
 * rather than trying to anchor directly on the (unreliable, doubled)
 * label text itself.
 */
function findDateAfterLabel(fullText: string, label: string): string | null {
  const index = fullText.indexOf(label);
  if (index === -1) return null;
  const after = fullText.slice(index + label.length);
  const match = after.match(/[A-Za-z]{3,}\s+\d{1,2},\s*\d{4}/);
  return match ? parseIciciDate(match[0]) : null;
}

/**
 * The "STATEMENT SUMMARY" block: a label row ("Total Amount due /
 * Previous Balance / Purchases / Charges / Cash Advances / Payments /
 * Credits"), an operator row ("= / + / + / -"), then the values
 * themselves split across two rows purely because Total Amount due
 * renders in a visually larger font that lands on its own line -- the
 * remaining four values follow immediately after on the next line, in
 * the same left-to-right order as the label row. Verified against a real
 * statement: previousBalance + purchasesCharges + cashAdvances -
 * paymentsCredits reproduces the printed Total Amount due exactly.
 */
function parseStatementSummaryBlock(page1: string): {
  totalAmountDue: Money;
  previousBalance: Money;
  purchasesCharges: Money;
  cashAdvances: Money;
  paymentsCredits: Money;
} {
  const block = sliceBetween(page1, "Total Amount due", "Minimum Amount due");
  const amounts = findAllAmounts(block);
  const [
    totalAmountDue,
    previousBalance,
    purchasesCharges,
    cashAdvances,
    paymentsCredits,
  ] = amounts;
  if (
    !totalAmountDue ||
    !previousBalance ||
    !purchasesCharges ||
    !cashAdvances ||
    !paymentsCredits
  ) {
    throw new IciciHeaderParseError("statementSummary");
  }
  return {
    totalAmountDue,
    previousBalance,
    purchasesCharges,
    cashAdvances,
    paymentsCredits,
  };
}

function parseMinimumDue(page1: string): Money {
  const match = requireMatch(
    page1,
    /Minimum Amount due[\s\S]*?\n\s*`?([\d,]+\.\d{2})/i,
    "minimumDue",
  );
  const minimumDue = findAmount(match[1]!);
  if (!minimumDue) throw new IciciHeaderParseError("minimumDue");
  return minimumDue;
}

/**
 * "Credit Limit (Including cash) / Available Credit (Including cash) /
 * Cash Limit / Available Cash" -- four amounts, in that order. Atlas's
 * shared header shape (matching HDFC/Axis) has no slot for the standalone
 * "Cash Limit" figure, so it's read (to keep the four values correctly
 * positioned) and then discarded rather than stored.
 */
function parseCreditSummaryBlock(page1: string): {
  totalCreditLimit: Money;
  availableCreditLimit: Money;
  availableCashLimit: Money;
} {
  const block = sliceBetween(page1, "Credit Limit (Including cash)", "Date");
  const amounts = findAllAmounts(block);
  const [totalCreditLimit, availableCreditLimit, , availableCashLimit] =
    amounts;
  if (!totalCreditLimit || !availableCreditLimit || !availableCashLimit) {
    throw new IciciHeaderParseError("creditSummary");
  }
  return { totalCreditLimit, availableCreditLimit, availableCashLimit };
}

/**
 * The EARNINGS section's cycle cashback total: a line with exactly two
 * bare integers and nothing else (both the same value in the one real
 * statement this was built against -- "earned" and "transferred to
 * Amazon Pay balance" reporting the same cycle figure twice), found by
 * line *shape* rather than label proximity, same reasoning as HDFC's own
 * parseRewardsBlock. Amazon Pay ICICI Bank Credit Card has no
 * traditional points program (see types.ts), so this becomes
 * cashbackAmount, not rewardPointsEarned/Balance. Best-effort: returns
 * null (not a throw) if the shape isn't found, since this is a decorative
 * figure that never participates in reconcile.ts's checks -- a statement
 * that otherwise reconciles shouldn't be blocked from saving over this.
 */
function parseEarningsCashback(page1: string): Money | null {
  const lines = page1.split("\n").map((l) => l.trim());
  const match = lines
    .map((l) => l.match(/^(\d{1,7})\s+(\d{1,7})$/))
    .find((m): m is RegExpMatchArray => m !== null);
  return match ? findAmount(match[1]!) : null;
}

export function parseIciciAmazonHeader(
  pageTexts: string[],
): IciciStatementHeader {
  const page1 = pageTexts[0] ?? "";
  const fullText = pageTexts.join("\n");

  const cardLast4 = requireMatch(
    // The real statement masks as "4315XXXXXXXX0005" (4 digits, 8 X's, 4
    // digits) -- X+ rather than a fixed count in case a differently
    // formatted ICICI card number ever masks a different number of
    // digits.
    page1,
    /\d{4}X+(\d{4})/,
    "cardLast4",
  )[1]!;

  const primaryCardholder = requireMatch(
    page1,
    /^(?:Mr\.|Ms\.|Mrs\.)\s+([A-Z][A-Z .]+?)\s{2,}/m,
    "primaryCardholder",
  )[1]!.trim();

  const statementDate = findDateAfterLabel(fullText, "STATEMENT DATE");
  const dueDate = findDateAfterLabel(fullText, "PAYMENT DUE DATE");
  if (!statementDate) throw new IciciHeaderParseError("statementDate");
  if (!dueDate) throw new IciciHeaderParseError("dueDate");

  const billingPeriodMatch = requireMatch(
    fullText,
    /Statement period\s*:\s*([A-Za-z]+\s+\d{1,2},\s*\d{4})\s+to\s+([A-Za-z]+\s+\d{1,2},\s*\d{4})/i,
    "billingPeriod",
  );
  const billingPeriodStart = parseIciciDate(billingPeriodMatch[1]!);
  const billingPeriodEnd = parseIciciDate(billingPeriodMatch[2]!);
  if (!billingPeriodStart || !billingPeriodEnd) {
    throw new IciciHeaderParseError("billingPeriod");
  }

  const summary = parseStatementSummaryBlock(page1);
  const minimumDue = parseMinimumDue(page1);
  const creditSummary = parseCreditSummaryBlock(page1);
  const cashbackAmount = parseEarningsCashback(page1);

  return {
    issuer: "ICICI",
    cardType: "Amazon Pay",
    cardLast4,
    primaryCardholder,
    statementDate,
    billingPeriodStart,
    billingPeriodEnd,
    dueDate,
    totalAmountDue: summary.totalAmountDue,
    minimumDue,
    previousStatementDue: summary.previousBalance,
    paymentsReceived: summary.paymentsCredits,
    purchasesDebit: summary.purchasesCharges,
    // See types.ts's comment on financeCharges: holds "Cash Advances"
    // for this issuer, not a fee total.
    financeCharges: summary.cashAdvances,
    availableCreditLimit: creditSummary.availableCreditLimit,
    totalCreditLimit: creditSummary.totalCreditLimit,
    availableCashLimit: creditSummary.availableCashLimit,
    rewardPointsBalance: 0,
    rewardPointsEarned: 0,
    rewardPointsExpiring30Days: 0,
    rewardPointsExpiring60Days: 0,
    cashbackAmount: cashbackAmount ?? ("0.00" as Money),
    rewardPointsSummary: [],
    cashbackSummary: [],
    statementCurrency: "INR",
  };
}
