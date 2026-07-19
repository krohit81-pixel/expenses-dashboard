import { findAmount } from "./amounts";
import { classifyTransaction } from "./classify-transaction";
import { normalizeMerchant } from "./normalize-merchant";
import type { CardholderType, HdfcTransaction } from "./types";

/**
 * One transaction row, e.g. (real shapes, spacing varies with
 * reconstructLayout's proportional gap-filling):
 *
 *   18/06/2026| 00:00            5% CashBack on SmartPay          +  C  110.00     l
 *   21/06/2026| 12:11    EMI    GYFTR VIA SMARTBUYNEW DELHI       + 130    C  4,000.00     l
 *   22/06/2026| 20:16            GOOGLE CLOUDMUMBAI                        C  2.00     l
 *
 * Tail shapes observed/anticipated (see this repo's delivery notes for
 * how the leading "+" convention was discovered): "[+ N] C amount" for a
 * debit (optionally with N reward points earned), "+ C amount" for a
 * credit with no points, and "[+ N] + C amount" for a credit that also
 * shows points -- not seen in the one real statement this was built
 * against, but the regex supports it structurally in case a future
 * statement has one.
 *
 * The trailing "l" is this statement's per-row Purchase Indicator
 * column -- in the real PDF it's a small colored bullet icon with no
 * underlying text, which this font's rendering happens to expose as a
 * literal lowercase "l" in the text layer. It's consumed here only to
 * anchor the end of the row; see purchaseIndicatorCode/Name below for
 * why it's never treated as real data.
 */
const ROW_REGEX =
  /^(\d{2})\/(\d{2})\/(\d{4})\|\s*(\d{2}:\d{2})\s+(?:(EMI)\s+)?(.*?)\s*(?:\+\s*(\d{1,7})\s+)?(\+\s*)?C\s*([\d,]+\.\d{2})\s+l\s*$/;

/**
 * A "cardholder section" header: an add-on/primary cardholder's name,
 * in caps, optionally followed by "[CKYC ID : <digits>]" and nothing
 * else on the line. Restricted to the bounded transaction-table region
 * (see inTransactionSection below) because plenty of the statement's
 * OTHER section labels ("IMPORTANT INFORMATION", "REDEEM REWARDS") are
 * also plain all-caps text and would otherwise false-match this.
 */
const CARDHOLDER_HEADER_REGEX =
  /^([A-Z][A-Z\s]*[A-Z])(?:\s*\[\s*CKYC ID\s*:\s*\d+\s*\])?$/;

const TRANSACTION_TABLE_START = /TRANSACTION\s+DESCRIPTION/;
// The small "N transactions eligible for EMI, total amount X" box that
// immediately follows the last transaction row.
const TRANSACTION_TABLE_END_EMI_BOX = /^TRANSACTIONS\b.*TOTAL AMOUNT/;
const TRANSACTION_TABLE_END_REWARDS = "Rewards Program Points Summary";
const PAGE_FOOTER = /^Page\s+\d+\s+of\s+\d+$/i;

function toIsoDate(day: string, month: string, year: string): string {
  return `${year}-${month}-${day}`;
}

export class HdfcTransactionParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HdfcTransactionParseError";
  }
}

/**
 * Parses every transaction row across all pages of an already
 * text-extracted HDFC Infinia statement (see extract-text.ts). Purely
 * rule-based: table-row regex plus a small amount of state (which
 * cardholder section we're currently in, whether we're inside the
 * transaction table at all) -- no LLM, nothing inferred beyond what a
 * human reading the same table by eye would conclude.
 */
export function parseHdfcTransactions(pageTexts: string[]): HdfcTransaction[] {
  // Flatten every page into one ordered stream of lines. The one
  // multi-line wrap case seen in practice (a long "(Ref#...)" payment
  // description) is stitched using immediate neighbors below, and
  // cardholder-section tracking carries state across a page break, so
  // both need one continuous stream rather than per-page processing.
  const lines: { pageNumber: number; raw: string }[] = [];
  pageTexts.forEach((pageText, pageIndex) => {
    for (const raw of pageText.split("\n")) {
      lines.push({ pageNumber: pageIndex + 1, raw });
    }
  });

  const transactions: HdfcTransaction[] = [];
  let sequenceNumber = 0;
  let inTransactionSection = false;
  let primaryCardholderName: string | null = null;
  let currentCardholderName = "";
  let currentCardholderType: CardholderType = "primary";

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].raw.trim();
    if (!trimmed) continue;

    if (TRANSACTION_TABLE_START.test(trimmed)) {
      inTransactionSection = true;
      continue;
    }
    if (
      TRANSACTION_TABLE_END_EMI_BOX.test(trimmed) ||
      trimmed === TRANSACTION_TABLE_END_REWARDS
    ) {
      inTransactionSection = false;
      continue;
    }
    if (!inTransactionSection) continue;

    const headerMatch = trimmed.match(CARDHOLDER_HEADER_REGEX);
    if (headerMatch) {
      const name = headerMatch[1].trim();
      if (primaryCardholderName === null) {
        primaryCardholderName = name;
        currentCardholderType = "primary";
      } else {
        currentCardholderType =
          name === primaryCardholderName ? "primary" : "addon";
      }
      currentCardholderName = name;
      continue;
    }

    const rowMatch = trimmed.match(ROW_REGEX);
    if (!rowMatch) continue;

    const [
      ,
      day,
      month,
      year,
      time,
      emiMarker,
      descriptionRaw,
      pointsRaw,
      creditMarker,
      amountRaw,
    ] = rowMatch;

    let description = (descriptionRaw ?? "").trim();
    const rawTextLines = [lines[i].raw];

    // The one wrap case seen in the real statement: a long "(Ref#...)"
    // description doesn't fit on the row's own line, so it's split onto
    // the line immediately before (opening fragment) and immediately
    // after (closing fragment) the row's date/time/amount line. Detected
    // here by an empty description on an otherwise-valid row.
    if (!description) {
      const prevLine = lines[i - 1]?.raw.trim();
      const nextLine = lines[i + 1]?.raw.trim();
      const isFragment = (line: string | undefined): line is string =>
        Boolean(line) &&
        !ROW_REGEX.test(line as string) &&
        !CARDHOLDER_HEADER_REGEX.test(line as string) &&
        !PAGE_FOOTER.test(line as string);

      const prevIsFragment = isFragment(prevLine);
      const nextIsFragment = isFragment(nextLine);
      description = [
        prevIsFragment ? prevLine : null,
        nextIsFragment ? nextLine : null,
      ]
        .filter((p): p is string => Boolean(p))
        .join(" ")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (prevIsFragment) rawTextLines.unshift(lines[i - 1]!.raw);
      if (nextIsFragment) rawTextLines.push(lines[i + 1]!.raw);
    }

    const amount = findAmount(amountRaw);
    if (!amount) {
      throw new HdfcTransactionParseError(
        `Matched a transaction row but couldn't parse its amount: "${trimmed}"`,
      );
    }

    const transactionType = creditMarker ? "credit" : "debit";
    const classification = classifyTransaction(description, transactionType);
    const isEmi = Boolean(emiMarker);
    // Credits with a recognized type (payment/cashback/refund/reversal)
    // aren't merchant purchases -- an unrecognized credit (rare; no
    // matching pattern in classify-transaction.ts) is left as a
    // merchant, since we don't actually know it isn't one.
    const isNonMerchantCredit = classification.creditType !== null;

    sequenceNumber += 1;
    transactions.push({
      transactionDate: toIsoDate(day!, month!, year!),
      transactionTime: time ?? null,
      description,
      merchantRaw: isNonMerchantCredit ? null : description,
      merchantNormalized: isNonMerchantCredit
        ? null
        : normalizeMerchant(description),
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
      cardholderType: currentCardholderType,
      cardholderName: currentCardholderName,
      pageNumber: lines[i]!.pageNumber,
      sequenceNumber,
      rawText: rawTextLines.join("\n"),
    });
  }

  return transactions;
}
