import { findAmount } from "./amounts";
import { classifyTransaction, isBankFeeOrTax } from "./classify-transaction";
import { normalizeMerchant } from "./normalize-merchant";
import type { IciciTransaction } from "./types";

/**
 * One real transaction row (spacing varies with reconstructLayout's
 * proportional gap-filling -- see extract-text.ts):
 *
 *   12/06/2026   13593107150   ZOMATO GURGAON IN            3            333.95
 *   15/06/2026   13607607955   VERCEL INC. VERCEL.COM US*   0   20 USD   1,955.55
 *   20/06/2026   13642347803   RAZ*Swiggy Bangalore KA IN  -5          555.00 CR
 *
 * Columns: date, a bank-assigned SerNo. (a long numeric transaction
 * reference -- consumed here only to anchor the row; not persisted as
 * its own field since credit_card_transactions has no column for it and
 * rawText already keeps the full original line for audit), the
 * description, Reward Points (can be negative -- see classify-transaction
 * on why a negative value on an otherwise-plain merchant row means a
 * refund), an OPTIONAL foreign-currency amount + code for a
 * non-INR-billed merchant (its own column here, unlike HDFC/Axis where a
 * foreign amount is embedded inside the description text), and finally
 * the printed INR amount with a trailing "CR" for a credit row.
 *
 * Deliberately NOT anchored to the start of the line (no leading "^"):
 * page 1's transaction rows visually overlap the "SPENDS OVERVIEW" donut
 * chart printed in the same page region, and whenever a chart label
 * (e.g. "Travel-21%   Apparel/Grocery-44%") happens to land at the same
 * y-coordinate as a transaction row, reconstructLayout's row-grouping
 * (see extract-text.ts) prepends that label text onto the same line,
 * left of the real date. A real production statement had exactly one
 * such row -- silently dropped by an earlier, start-anchored version of
 * this pattern, which desynced reconciliation by that single
 * transaction's amount even though every OTHER row on the page parsed
 * fine. Matching the date/SerNo/description/amount shape anywhere in the
 * line (still anchored at the END, since nothing legitimately follows
 * the amount/CR marker) recovers that row without caring what, if
 * anything, precedes it.
 */
const ROW_REGEX =
  /(\d{2}\/\d{2}\/\d{4})\s+\d+\s+(.+?)\s+(-?\d+)\s+(?:[\d.]+\s*[A-Z]{3}\s+)?([\d,]+\.\d{2})\s*(CR)?\s*$/;

const TRANSACTION_TABLE_START = /Transaction Details/i;
// The "# International Spends" footnote for the Intl.# column -- printed
// once, right after the last real transaction row (at the end of page 2
// on both real statements this was built against). Page 1's own
// transaction rows run straight into unrelated page content (an
// EARNINGS/rewards section, a spending-by-category chart) with no
// explicit end-of-table marker of their own; inTransactionSection simply
// stays true across that page break since none of that intervening text
// matches ROW_REGEX (nothing there starts with a bare DD/MM/YYYY date).
const TRANSACTION_TABLE_END = /International Spends/i;
const PAGE_FOOTER = /Page\s+\d+\s+of\s+\d+/i;

// A masked/tokenized card number line (e.g. "6528XXXXXXXX7000") --
// printed mid-table on a real RuPay-on-UPI statement, marking which
// virtual card number the UPI charges below it routed through (see
// parse-header.ts's cardLast4 comment). Never a real transaction row
// itself (ROW_REGEX won't match it -- no leading date), but it IS a
// plausible-looking "next line" a wrap-continuation scan could otherwise
// second-guess itself over, so it's treated as known noise there too.
const MASKED_CARD_NUMBER_LINE = /^\d{4}X+\d{4}$/;
// A "SPENDS OVERVIEW" donut-chart label -- e.g. "25%", "Travel-71%
// Apparel/Grocery-1%" -- see the ROW_REGEX comment above for why these
// sometimes land inside the transaction table's visual row order.
const CHART_LABEL_LINE = /\d+%/;

function isKnownNoiseLine(line: string): boolean {
  return MASKED_CARD_NUMBER_LINE.test(line) || CHART_LABEL_LINE.test(line);
}

// A plausible wrapped-description continuation fragment: pure letters
// (plus the odd space/punctuation a merchant name might use), no digits
// at all. Real examples seen: "PRIVAT IN" (continuing "...TOBOX VE
// NTURES"), "SARODE IN" (continuing "...MR GANES H APPA").
const CONTINUATION_FRAGMENT = /^[A-Za-z][A-Za-z .&'/-]*$/;

const MAX_WRAP_LOOKAHEAD = 4;

/**
 * A long merchant description on a real RuPay-on-UPI statement sometimes
 * wraps onto the line(s) immediately below its own row -- e.g. the row
 * "...UPI-616622925270-TOBOX VE NTURES ... 168.00" continues on the very
 * next line with just "PRIVAT IN". Unlike HDFC/Axis's own wrap-handling
 * (which only ever needs to check the single line immediately
 * before/after), a wrapped fragment here can also have a "SPENDS
 * OVERVIEW" donut-chart label or a masked-card-number line interleaved
 * in between it and its row (see the ROW_REGEX comment above for why) --
 * so this scans forward past known noise instead of stopping at the
 * first non-matching line. Stops as soon as it hits a real transaction
 * row, a table-start/end marker, or a page footer; anything it can't
 * classify one way or the other also stops the scan rather than
 * guessing. Purely a peek -- never advances the caller's own line index,
 * since every line it looks at is either noise (harmlessly re-skipped by
 * the main loop on its own next iteration) or a fragment this function
 * consumes into the description text.
 */
function collectWrappedContinuation(
  lines: { pageNumber: number; raw: string }[],
  startIndex: number,
): string {
  const collected: string[] = [];
  for (
    let j = startIndex + 1;
    j < lines.length && j <= startIndex + MAX_WRAP_LOOKAHEAD;
    j++
  ) {
    const candidate = lines[j]!.raw.trim();
    if (!candidate) continue;
    if (ROW_REGEX.test(candidate)) break;
    if (TRANSACTION_TABLE_START.test(candidate)) break;
    if (TRANSACTION_TABLE_END.test(candidate)) break;
    if (PAGE_FOOTER.test(candidate)) continue;
    if (isKnownNoiseLine(candidate)) continue;
    if (CONTINUATION_FRAGMENT.test(candidate)) {
      collected.push(candidate);
      continue;
    }
    break;
  }
  return collected.join(" ");
}

function toIsoDate(dateStr: string): string {
  const [day, month, year] = dateStr.split("/");
  return `${year}-${month}-${day}`;
}

export class IciciTransactionParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IciciTransactionParseError";
  }
}

/**
 * Parses every transaction row across all pages. Unlike HDFC/Axis, this
 * statement never repeats a per-cardholder "Card No: ... Name ..." header
 * row inside the transaction table itself (only one masked card number
 * line appears, once, right before the table starts) -- no add-on-card
 * section has been observed on either real statement either. So the
 * already-parsed primary cardholder name is passed in directly rather
 * than re-derived from the table, and every row is tagged "primary".
 */
export function parseIciciTransactions(
  pageTexts: string[],
  primaryCardholder: string,
): IciciTransaction[] {
  const lines: { pageNumber: number; raw: string }[] = [];
  pageTexts.forEach((pageText, pageIndex) => {
    for (const raw of pageText.split("\n")) {
      lines.push({ pageNumber: pageIndex + 1, raw });
    }
  });

  const transactions: IciciTransaction[] = [];
  let sequenceNumber = 0;
  let inTransactionSection = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.raw.trim();
    if (!trimmed) continue;

    if (TRANSACTION_TABLE_START.test(trimmed)) {
      inTransactionSection = true;
      continue;
    }
    if (TRANSACTION_TABLE_END.test(trimmed)) {
      inTransactionSection = false;
      continue;
    }
    if (!inTransactionSection) continue;
    if (PAGE_FOOTER.test(trimmed)) continue;

    const rowMatch = trimmed.match(ROW_REGEX);
    if (!rowMatch) continue;

    const [, dateStr, descriptionRaw, pointsRaw, amountRaw, creditMarker] =
      rowMatch;
    let description = (descriptionRaw ?? "").trim();
    if (!description) continue;

    const continuation = collectWrappedContinuation(lines, i);
    if (continuation) {
      description = `${description} ${continuation}`.replace(/\s{2,}/g, " ");
    }

    const amount = findAmount(amountRaw!);
    if (!amount) {
      throw new IciciTransactionParseError(
        `Matched a transaction row but couldn't parse its amount: "${trimmed}"`,
      );
    }

    const transactionType = creditMarker ? "credit" : "debit";
    const classification = classifyTransaction(description, transactionType);
    const isEmi = /\bEMI\b/i.test(description);
    const isNonMerchant =
      classification.creditType !== null || isBankFeeOrTax(description);

    sequenceNumber += 1;
    transactions.push({
      transactionDate: toIsoDate(dateStr!),
      transactionTime: null,
      description,
      merchantRaw: isNonMerchant ? null : description,
      merchantNormalized: isNonMerchant ? null : normalizeMerchant(description),
      amount,
      currency: "INR",
      transactionType,
      isPayment: classification.isPayment,
      isCashback: classification.isCashback,
      isRefund: classification.isRefund,
      isEmi,
      creditType: classification.creditType,
      paymentReference: classification.paymentReference,
      emiMerchant: isEmi ? description : null,
      emiAmount: isEmi ? amount : null,
      rewardPoints: pointsRaw ? Number(pointsRaw) : null,
      purchaseIndicatorCode: null,
      purchaseIndicatorName: null,
      cardholderType: "primary",
      cardholderName: primaryCardholder,
      pageNumber: lines[i]!.pageNumber,
      sequenceNumber,
      rawText: lines[i]!.raw,
    });
  }

  return transactions;
}
