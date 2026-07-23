import type { CreditType, TransactionType } from "./types";

export interface Classification {
  isPayment: boolean;
  isCashback: boolean;
  isRefund: boolean;
  creditType: CreditType;
  paymentReference: string | null;
}

/**
 * Unlike HDFC/Axis, a real Amazon Pay statement's credit ("CR") rows for
 * an ordinary merchant refund carry NO keyword at all -- just the same
 * merchant description as the original purchase, with a "CR" suffix on
 * the amount (see parse-transactions.ts's ROW_REGEX). The only credit
 * row that identifies itself by name is the bank's own payment-received
 * line ("INFINITY PAYMENT RECEIVED, THANK YOU" in the one real statement
 * this was built against). So the rule here is: a payment-received match
 * wins; a cashback/reversal keyword match wins if present (kept as a
 * defensive fallback -- neither has been observed on a real Amazon Pay
 * statement, whose cashback is disbursed separately via the EARNINGS
 * section, not as a transaction row); anything else that's a credit is
 * assumed to be a merchant refund, since there's no other explanation for
 * a negative-direction amount against a normal merchant description.
 */
export function classifyTransaction(
  description: string,
  transactionType: TransactionType,
): Classification {
  if (transactionType !== "credit") {
    return {
      isPayment: false,
      isCashback: false,
      isRefund: false,
      creditType: null,
      paymentReference: null,
    };
  }

  const isPayment = /payment\s+received/i.test(description);
  const isCashback = !isPayment && /cash\s*back/i.test(description);
  const isReversal = !isPayment && !isCashback && /reversal/i.test(description);
  const isRefund = !isPayment && !isCashback && !isReversal;

  let creditType: CreditType = null;
  if (isPayment) creditType = "payment";
  else if (isCashback) creditType = "cashback";
  else if (isReversal) creditType = "reversal";
  else if (isRefund) creditType = "refund";

  return {
    isPayment,
    isCashback,
    isRefund: isRefund || isReversal,
    creditType,
    // No "(Ref# ...)" style reference is printed on this statement's
    // payment-received row -- SerNo. (see parse-transactions.ts) already
    // captures a per-row reference number for every row, payment or not,
    // so there's nothing extra to extract here.
    paymentReference: null,
  };
}

/**
 * No fee/GST/late-charge transaction row appears anywhere in the one
 * real statement this was built against (the statement's own footnote
 * says such charges are folded into the printed transaction amount
 * instead -- see types.ts's comment on purchasesDebit). Kept as a
 * defensive classifier for a future statement that does print one,
 * same spirit as axis-horizon's own isBankFeeOrTax.
 */
export function isBankFeeOrTax(description: string): boolean {
  return (
    /^IGST-/i.test(description) ||
    /^CGST-/i.test(description) ||
    /^SGST-/i.test(description) ||
    /^GST-/i.test(description) ||
    /^GST$/i.test(description) ||
    /late payment fee/i.test(description) ||
    /late fee/i.test(description) ||
    /annual fee/i.test(description) ||
    /membership fee/i.test(description) ||
    /finance charge/i.test(description) ||
    /over\s*limit fee/i.test(description) ||
    /forex markup/i.test(description)
  );
}

/**
 * Best-effort cash-advance detector -- the statement's summary block
 * prints a "Cash Advances" total (0.00 in the one real statement this
 * was built against) but no cash-advance transaction row exists there to
 * confirm actual wording against. Kept defensive, same spirit as the
 * classifiers above: reconcile.ts uses this to split debit rows between
 * header.purchasesDebit and header.financeCharges (which holds "Cash
 * Advances" here -- see types.ts), so getting this wrong only matters
 * once a statement actually has a nonzero cash-advance total.
 */
export function isCashAdvance(description: string): boolean {
  return (
    /cash\s*advance/i.test(description) ||
    /cash\s*withdrawal/i.test(description) ||
    /\batm\b.*cash/i.test(description)
  );
}
