import { findAmount } from "./amounts";
import { classifyTransaction, isBankFeeOrTax } from "./classify-transaction";
import { normalizeMerchant } from "./normalize-merchant";
import type { AxisTransaction, CardholderType } from "./types";

/**
 * Axis's transaction table has a THIRD column HDFC's doesn't: "MERCHANT
 * CATEGORY" (e.g. "RESTAURANTS", "DEPT STORES", "HOME FURNISHING"),
 * printed between the description and the amount. An earlier draft of
 * this regex used a single lazy `(.*?)` for everything between the date
 * and the amount, which swallowed the category into the description
 * verbatim -- including the large proportional gap the layout
 * reconstruction inserts between columns (see extract-text.ts). That's
 * a real bug, not a style nit: merchantRaw is used as the Merchant
 * Dictionary's alias key, and a gap width that varies with description
 * length would produce a different merchantRaw string for the same
 * merchant from statement to statement, permanently fragmenting it into
 * duplicate merchant entries instead of matching the existing alias.
 *
 * The fix captures the category as its own optional group, split from
 * the description by a run of 2+ spaces -- the same "2+ literal spaces
 * means a real column boundary" assumption HDFC's own row parsing
 * already relies on for this exact PDF-text-reconstruction pipeline
 * (see reconstructLayout's proportional gap-filling). Rows with no
 * category at all (payments, credits -- verified against a real
 * statement) simply skip the optional group.
 */
const ROW_REGEX =
  /^(\d{2}\/\d{2}\/\d{4})\s+(.*?)\s{2,}(?:([A-Z][A-Z0-9 &'/.-]*[A-Z0-9])\s{2,})?([\d,]+\.\d{2})\s*(Dr|Cr)\s*$/i;

const CARDHOLDER_HEADER_REGEX = /Card No:\s+.+?\s+Name\s+.+/i;
const TRANSACTION_TABLE_START = /TRANSACTION\s+DETAILS/i;
// "**** End of Statement ****" -- printed once, right after the last
// real transaction row and before the page-footer/legal boilerplate.
// An earlier draft anchored on "SUMMARY OF CHARGES", a section header
// that doesn't actually appear anywhere in a real Axis Atlas/HORIZON
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

    const [
      ,
      dateStr,
      descriptionRaw,
      merchantCategory,
      amountRaw,
      debitCreditMarker,
    ] = rowMatch;
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
