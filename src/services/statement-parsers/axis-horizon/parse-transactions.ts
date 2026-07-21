import { findAmount } from "./amounts";
import { classifyTransaction, isBankFeeOrTax } from "./classify-transaction";
import { normalizeMerchant } from "./normalize-merchant";
import type { AxisTransaction, CardholderType } from "./types";

/**
 * Axis's transaction table has a THIRD column HDFC's doesn't: "MERCHANT
 * CATEGORY" (e.g. "RESTAURANTS", "DEPT STORES", "HOME FURNISHING"),
 * printed between the description and the amount.
 *
 * v1.7.2: a real production upload of this exact statement reconciled
 * the header perfectly but found ZERO transactions -- reproduced
 * nowhere locally, including against the real extractPdfText() run on
 * the real uploaded PDF bytes (59/59 transactions, exact reconciliation).
 * The only plausible explanation left is environment-dependent PDF font
 * metrics: extractPdfText's reconstructLayout() turns pdf.js's reported
 * glyph widths into a *space count* via `gap / spaceWidth`, and pdf.js's
 * `useSystemFonts: true` resolves against whatever fonts are actually
 * installed on the host -- which differs between this sandbox and a
 * Vercel serverless container. A previous version of this regex
 * required a literal 2-or-more-space run (`\s{2,}`) between the
 * description/category and the amount as part of matching the ENTIRE
 * row -- if that boundary ever renders as a single space under different
 * font metrics, the row fails to match at all, and EVERY row fails the
 * same way, exactly reproducing "header parsed fine (its regexes only
 * ever required generous `\s+`), transactions summed to 0.00."
 *
 * Fixed by no longer requiring 2+ spaces anywhere in the *required*
 * shape of a row: the row matches on date ... description/category
 * text ... amount ... Dr/Cr, separated only by `\s+` (which
 * reconstructLayout always inserts at least one of, regardless of font
 * metrics). The category is then split out of that middle text as a
 * separate, best-effort step (CATEGORY_SPLIT_REGEX) that still prefers
 * the 2+-space column-boundary signal when it's there, but simply folds
 * the category into the description instead of losing the whole row
 * when it isn't -- a full merchant-category miss is a much smaller
 * problem than reconciliation failing outright and no transactions
 * saving at all.
 */
const ROW_REGEX =
  /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s*(Dr|Cr)\s*$/i;

// Best-effort split of the "description [gap] MERCHANT CATEGORY" middle
// text captured by ROW_REGEX above. Only applied when there's still a
// clear 2+-space column boundary AND a plausible category-shaped run of
// text after it; falls through to "no category" otherwise rather than
// guessing.
const CATEGORY_SPLIT_REGEX = /^(.+?)\s{2,}([A-Z][A-Z0-9 &'/.-]*[A-Z0-9])$/;

const CARDHOLDER_HEADER_REGEX = /Card No:\s+.+?\s+Name\s+.+/i;
const TRANSACTION_TABLE_START = /TRANSACTION\s+DETAILS/i;
// "**** End of Statement ****" -- printed once, right after the last
// real transaction row and before the page-footer/legal boilerplate.
// An earlier draft anchored on "SUMMARY OF CHARGES", a section header
// that doesn't actually appear anywhere in a real Axis Horizon
// statement (verified against a full 3-page sample) -- inTransactionSection
// never got reset to false, and stayed stuck "true" through every
// remaining page. That happened not to corrupt any output here only
// because ROW_REGEX's own leading date anchor never matched anything in
// the trailing legal/schedule-of-charges text on a real statement, but
// it was one accidental shape away from silently parsing junk as a
// transaction. This anchors on the marker that's actually printed.
const TRANSACTION_TABLE_END = /End of Statement/i;
const PAGE_FOOTER = /Page\s+:?\s*\d+\s+of\s+\d+/i;

function toIsoDate(dateStr: string): string {
  const [day, month, year] = dateStr.split("/");
  return `${year}-${month}-${day}`;
}

export class AxisTransactionParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AxisTransactionParseError";
  }
}

export function parseAxisTransactions(pageTexts: string[]): AxisTransaction[] {
  const lines: { pageNumber: number; raw: string }[] = [];
  pageTexts.forEach((pageText, pageIndex) => {
    for (const raw of pageText.split("\n")) {
      lines.push({ pageNumber: pageIndex + 1, raw });
    }
  });

  const transactions: AxisTransaction[] = [];
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
    if (TRANSACTION_TABLE_END.test(trimmed)) {
      inTransactionSection = false;
      continue;
    }
    if (!inTransactionSection) continue;

    const headerMatch = trimmed.match(CARDHOLDER_HEADER_REGEX);
    if (headerMatch) {
      const nameMatch = trimmed.match(/Name\s+([^\n]+)$/i);
      const name = nameMatch?.[1]?.trim() ?? trimmed;
      if (name) {
        if (primaryCardholderName === null) {
          primaryCardholderName = name;
          currentCardholderType = "primary";
        } else {
          currentCardholderType =
            name === primaryCardholderName ? "primary" : "addon";
        }
        currentCardholderName = name;
      }
      continue;
    }

    const rowMatch = trimmed.match(ROW_REGEX);
    if (!rowMatch) continue;

    const [, dateStr, middleRaw, amountRaw, debitCreditMarker] = rowMatch;
    const categorySplit = (middleRaw ?? "").trim().match(CATEGORY_SPLIT_REGEX);
    const descriptionRaw = categorySplit ? categorySplit[1] : middleRaw;
    const merchantCategory = categorySplit ? categorySplit[2] : undefined;
    let description = (descriptionRaw ?? "").trim();
    const rawTextLines = [lines[i].raw];

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
        .filter((item): item is string => Boolean(item))
        .join(" ")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (prevIsFragment) rawTextLines.unshift(lines[i - 1]!.raw);
      if (nextIsFragment) rawTextLines.push(lines[i + 1]!.raw);
    }

    const amount = findAmount(amountRaw);
    if (!amount) {
      throw new AxisTransactionParseError(
        `Matched a transaction row but couldn't parse its amount: "${trimmed}"`,
      );
    }

    const transactionType =
      debitCreditMarker?.toLowerCase() === "cr" ? "credit" : "debit";
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
      rewardPoints: null,
      purchaseIndicatorCode: null,
      // Axis prints an actual "MERCHANT CATEGORY" column (e.g.
      // "RESTAURANTS", "DEPT STORES") -- unlike HDFC's colour-bullet PI
      // icon (see types.ts/hdfc-infinia's own comment on why that one's
      // always null), this is real text, so it slots directly into the
      // purchaseIndicatorName column the schema already reserved for
      // exactly this "a future statement prints PI as text" case.
      purchaseIndicatorName: merchantCategory?.trim() ?? null,
      cardholderType: currentCardholderType,
      cardholderName: currentCardholderName,
      pageNumber: lines[i]!.pageNumber,
      sequenceNumber,
      rawText: rawTextLines.join("\n"),
    });
  }

  return transactions;
}
