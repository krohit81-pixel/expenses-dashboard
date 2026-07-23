import { addMoney, ZERO, type Money } from "@/lib/money";

import {
  findAllAmounts,
  findAmount,
  findDecimalAmount,
  findInteger,
} from "./amounts";
import type {
  CashbackSummaryLine,
  HdfcStatementHeader,
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

/** "17 Jul, 2026" -> "2026-07-17". Returns null if it doesn't parse. */
function parseHdfcDate(text: string): string | null {
  const match = text.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*,?\s+(\d{4})/);
  if (!match) return null;
  const month = MONTHS[match[2].toLowerCase()];
  if (!month) return null;
  const day = match[1].padStart(2, "0");
  return `${match[3]}-${String(month).padStart(2, "0")}-${day}`;
}

export class HdfcHeaderParseError extends Error {
  constructor(missingField: string) {
    super(`Could not find "${missingField}" in the statement header.`);
    this.name = "HdfcHeaderParseError";
  }
}

function requireMatch(
  text: string,
  pattern: RegExp,
  fieldName: string,
): string {
  const match = text.match(pattern);
  if (!match?.[1]) throw new HdfcHeaderParseError(fieldName);
  return match[1];
}

function requireDate(text: string, pattern: RegExp, fieldName: string): string {
  const raw = requireMatch(text, pattern, fieldName);
  const date = parseHdfcDate(raw);
  if (!date) throw new HdfcHeaderParseError(fieldName);
  return date;
}

/**
 * Slices the text between two anchor phrases (inclusive of neither) --
 * used for the totals/limits/rewards dashboard blocks, which are laid
 * out as small multi-column tables rather than clean "label: value"
 * pairs, so the safest way to scope a search to just one block is by
 * anchoring on the surrounding section labels rather than trying to
 * regex the whole page at once.
 */
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
 * The "TOTAL CREDIT LIMIT / AVAILABLE CREDIT LIMIT / AVAILABLE CASH LIMIT
 * / MINIMUM DUE / DUE DATE" block. Its header labels and value row don't
 * reliably land in the same reading order after layout reconstruction
 * (row-grouping by y-position can put a two-column sub-row above or below
 * a three-column one depending on tiny baseline differences), so this
 * anchors on two more reliable structural facts instead of raw order:
 * MINIMUM DUE always shares its line with DUE DATE (the statement's only
 * date value in this whole block), and the other three amounts always
 * appear together on their own line, in TOTAL CREDIT LIMIT / AVAILABLE
 * CREDIT LIMIT / AVAILABLE CASH LIMIT order (matching the header row,
 * which -- unlike the value rows -- has never been observed out of
 * order). Confirmed identical on both real card products this module
 * covers.
 */
function parseLimitsBlock(block: string): {
  totalCreditLimit: Money;
  availableCreditLimit: Money;
  availableCashLimit: Money;
  minimumDue: Money;
  dueDate: string;
} {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const dueDateLine = lines.find((l) =>
    /\d{1,2}\s+[A-Za-z]{3}[a-z]*,?\s+\d{4}/.test(l),
  );
  if (!dueDateLine) throw new HdfcHeaderParseError("dueDate");
  const dueDate = parseHdfcDate(dueDateLine);
  const minimumDue = findAmount(dueDateLine);
  if (!dueDate || !minimumDue)
    throw new HdfcHeaderParseError("dueDate/minimumDue");

  const limitsLine = lines.find(
    (l) => l !== dueDateLine && findAllAmounts(l).length >= 3,
  );
  if (!limitsLine) throw new HdfcHeaderParseError("creditLimits");
  const [totalCreditLimit, availableCreditLimit, availableCashLimit] =
    findAllAmounts(limitsLine);
  if (!totalCreditLimit || !availableCreditLimit || !availableCashLimit) {
    throw new HdfcHeaderParseError("creditLimits");
  }

  return {
    totalCreditLimit,
    availableCreditLimit,
    availableCashLimit,
    minimumDue,
    dueDate,
  };
}

/**
 * The rewards dashboard block: "Opening Balance / Points Earned /
 * Disbursed / Adjusted-Lapsed" (4 numbers, one line) followed by the
 * closing "Reward Points" balance (1 number, its own line) -- see this
 * module's header comment for why anchoring on line *shape* (how many
 * numbers a line has) is more reliable here than label proximity. The
 * Tata Neu Plus variant prints the exact same shape for its "Opening
 * NeuCoins with Bank / NeuCoins Earned / NeuCoins Transferred to Tata Neu
 * / Adjusted/Lapsed" block -- only the surrounding label text differs
 * (see detectCardVariant below for which anchors select which block),
 * the 4-number-line-then-balance-line structure itself needed no changes.
 */
function parseRewardsBlock(block: string): {
  rewardPointsBalance: number;
  rewardPointsEarned: number;
} {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const fourNumberLine = lines.find((l) => /^([\d,]+\s+){3}[\d,]+$/.test(l));
  if (!fourNumberLine) throw new HdfcHeaderParseError("rewardPointsEarned");
  const numbers = fourNumberLine.split(/\s+/).map((n) => findInteger(n));
  const rewardPointsEarned = numbers[1];
  if (rewardPointsEarned == null)
    throw new HdfcHeaderParseError("rewardPointsEarned");

  const fourNumberLineIndex = lines.indexOf(fourNumberLine);
  const balanceLine = lines
    .slice(fourNumberLineIndex + 1)
    .find((l) => /^[\d,]+$/.test(l));
  const rewardPointsBalance = balanceLine ? findInteger(balanceLine) : null;
  if (rewardPointsBalance == null)
    throw new HdfcHeaderParseError("rewardPointsBalance");

  return { rewardPointsBalance, rewardPointsEarned };
}

/**
 * Reads whichever reward-currency section a real statement actually
 * prints -- "Opening Balance" for Infinia's HDFC Reward Points block,
 * "NeuCoins" (anywhere on page 1) for Tata Neu Plus's block -- to decide
 * cardType and which section-label anchors to use for the rewards/
 * reward-program-summary blocks below. Both real samples this module has
 * been tested against also print their own product name plainly at the
 * very top of page 1 ("Tata Neu Plus HDFC Bank Credit Card Statement"),
 * but anchoring on the rewards section instead keeps this parser working
 * even if a future statement's masthead wording changes, and mirrors the
 * same choice made in axis-horizon-airtel's detectCardVariant.
 */
function detectCardVariant(page1: string): "Infinia" | "Tata Neu Plus" {
  return /NeuCoins/i.test(page1) ? "Tata Neu Plus" : "Infinia";
}

function parseRewardProgramSummary(
  fullText: string,
  cardType: "Infinia" | "Tata Neu Plus",
): RewardProgramLine[] {
  const [startAnchor, endAnchor] =
    cardType === "Tata Neu Plus"
      ? (["Bonus NeuCoins Summary", "GST Summary"] as const)
      : (["Rewards Program Points Summary", "Cash Back Summary"] as const);
  const block = sliceBetween(fullText, startAnchor, endAnchor);
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const result: RewardProgramLine[] = [];
  for (const line of lines) {
    // The trailing "pts"/"pt" suffix is Infinia-only (e.g. "500 pts") --
    // Tata Neu Plus's Bonus NeuCoins Summary rows have no such suffix
    // (e.g. "1  NeuCoins_on_UPI_Acc  8"), so it's optional here rather
    // than required, covering both variants with one regex.
    const match = line.match(/^(\d+)\s+(.+?)\s+([\d,]+)\s*(?:pts?)?$/i);
    if (!match) continue;
    const bonusPoints = findInteger(match[3]);
    if (bonusPoints == null) continue;
    result.push({
      srNo: Number(match[1]),
      program: match[2].trim(),
      bonusPoints,
    });
  }
  return result;
}

function parseCashbackSummary(fullText: string): CashbackSummaryLine[] {
  // Tata Neu Plus's one real sample has no "Cash Back Summary" section at
  // all (NeuCoins has no separate cashback sub-table) -- sliceBetween
  // simply returns "" when the anchor isn't found, so this naturally
  // defaults to an empty array for that card without needing a cardType
  // branch here.
  const block = sliceBetween(
    fullText,
    "Cash Back Summary",
    "Important Information",
  );
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const result: CashbackSummaryLine[] = [];
  for (const line of lines) {
    const match = line.match(/^(\d+)\s+(.+)$/);
    if (!match) continue;
    const rest = match[2];
    // findDecimalAmount, not findAmount -- the transaction label often
    // starts with a bare, decimal-less number that isn't the currency
    // figure at all (e.g. "5% CashBack on SmartPay"), which findAmount's
    // looser pattern would match first and misread as the amount.
    const amount = findDecimalAmount(rest);
    if (!amount) continue;
    // Everything before wherever the amount's own digits start, with any
    // trailing currency-symbol noise (e.g. this statement's "C" — see
    // amounts.ts) trimmed off.
    const amountDigitsIndex = rest.search(/\d{1,3}(,\d{2,3})*\.\d{2}/);
    const transaction = rest
      .slice(0, amountDigitsIndex === -1 ? undefined : amountDigitsIndex)
      .trim()
      // Trailing currency-symbol noise before the digits (e.g. this
      // statement's "C" glyph, a lone letter with nothing after it — see
      // amounts.ts).
      .replace(/\s+[A-Z]$/, "")
      .trim();
    result.push({ srNo: Number(match[1]), transaction, amount });
  }
  return result;
}

/**
 * Parses the statement-level header from page 1's extracted text (plus,
 * for the two summary tables, whichever page they actually landed on --
 * always page 3 for Infinia, page 2 for Tata Neu Plus in the real
 * statements this was built against, but scanned across all pages
 * defensively rather than hardcoding either).
 */
export function parseHdfcHeader(pageTexts: string[]): HdfcStatementHeader {
  const page1 = pageTexts[0] ?? "";
  const fullText = pageTexts.join("\n");

  const cardType = detectCardVariant(page1);

  const cardLast4 = requireMatch(
    page1,
    /Credit Card No\.\s+\d{6}X{6}(\d{4})/,
    "cardLast4",
  );
  const primaryCardholder = requireMatch(
    page1,
    /^([A-Z][A-Z\s]+?)\s+Credit Card No\./m,
    "primaryCardholder",
  ).trim();
  const statementDate = requireDate(
    page1,
    /Statement Date\s+([^\n]+)/,
    "statementDate",
  );
  const billingPeriodMatch = page1.match(
    /Billing Period\s+(\d{1,2}\s+[A-Za-z]{3}[a-z]*,?\s+\d{4})\s*-\s*(\d{1,2}\s+[A-Za-z]{3}[a-z]*,?\s+\d{4})/,
  );
  if (!billingPeriodMatch) throw new HdfcHeaderParseError("billingPeriod");
  const billingPeriodStart = parseHdfcDate(billingPeriodMatch[1]);
  const billingPeriodEnd = parseHdfcDate(billingPeriodMatch[2]);
  if (!billingPeriodStart || !billingPeriodEnd)
    throw new HdfcHeaderParseError("billingPeriod");

  // The totals line: previous dues stands alone, then
  // "received + (current cycle) + finance charges = total due", in that
  // order -- unlike the limits block below, this one's reading order has
  // held up across reconstruction, so simple positional extraction is
  // enough here. Confirmed identical on both real card products this
  // module covers.
  const totalsBlock = sliceBetween(
    page1,
    "PREVIOUS STATEMENT DUES",
    "TOTAL CREDIT LIMIT",
  );
  const totalsAmounts = findAllAmounts(totalsBlock);
  const [
    previousStatementDue,
    paymentsReceived,
    purchasesDebit,
    financeCharges,
    totalAmountDue,
  ] = totalsAmounts;
  if (
    !previousStatementDue ||
    !paymentsReceived ||
    !purchasesDebit ||
    !financeCharges ||
    !totalAmountDue
  ) {
    throw new HdfcHeaderParseError("statementTotals");
  }

  const limitsBlock = sliceBetween(page1, "TOTAL CREDIT LIMIT", "Past Dues");
  const limits = parseLimitsBlock(limitsBlock);

  // Tata Neu Plus prints "Adjusted/Lapsed" (slash) as the last rewards
  // label, immediately followed by the 4-number value line and the
  // closing balance line, then a "Note:" section -- structurally the
  // same shape as Infinia's "Opening Balance ... POINTS EXPIRING" block,
  // just with different surrounding labels (see detectCardVariant above)
  // and, notably, no points-expiry sub-section at all.
  const rewardsBlock =
    cardType === "Tata Neu Plus"
      ? sliceBetween(page1, "Adjusted/Lapsed", "Note:")
      : sliceBetween(page1, "Opening Balance", "POINTS EXPIRING");
  const rewards = parseRewardsBlock(rewardsBlock);

  let expiring30 = 0;
  let expiring60 = 0;
  if (cardType === "Infinia") {
    const expiring30Match = findInteger(
      requireMatch(
        page1,
        /IN 30 DAYS\s+([\d,]+)/,
        "rewardPointsExpiring30Days",
      ),
    );
    const expiring60Match = findInteger(
      requireMatch(
        page1,
        /IN 60 DAYS\s+([\d,]+)/,
        "rewardPointsExpiring60Days",
      ),
    );
    if (expiring30Match == null || expiring60Match == null) {
      throw new HdfcHeaderParseError("rewardPointsExpiring");
    }
    expiring30 = expiring30Match;
    expiring60 = expiring60Match;
  }
  // Tata Neu Plus's NeuCoins have no expiry concept on the one real
  // statement this was tested against -- expiring30/expiring60 stay 0.

  const cashbackSummary = parseCashbackSummary(fullText);
  const cashbackAmount = cashbackSummary.length
    ? cashbackSummary.reduce(
        (total, line) => addMoney(total, line.amount),
        ZERO,
      )
    : ZERO;

  return {
    issuer: "HDFC",
    cardType,
    cardLast4,
    primaryCardholder,
    statementDate,
    billingPeriodStart,
    billingPeriodEnd,
    dueDate: limits.dueDate,
    totalAmountDue,
    minimumDue: limits.minimumDue,
    previousStatementDue,
    paymentsReceived,
    purchasesDebit,
    financeCharges,
    availableCreditLimit: limits.availableCreditLimit,
    totalCreditLimit: limits.totalCreditLimit,
    availableCashLimit: limits.availableCashLimit,
    rewardPointsBalance: rewards.rewardPointsBalance,
    rewardPointsEarned: rewards.rewardPointsEarned,
    rewardPointsExpiring30Days: expiring30,
    rewardPointsExpiring60Days: expiring60,
    cashbackAmount,
    rewardPointsSummary: parseRewardProgramSummary(fullText, cardType),
    cashbackSummary,
    statementCurrency: "INR",
  };
}
