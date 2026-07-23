import type { CreditType, TransactionType } from "./types";

export interface Classification {
  isPayment: boolean;
  isCashback: boolean;
  isRefund: boolean;
  creditType: CreditType;
  paymentReference: string | null;
}

/**
 * Unlike HDFC/Axis, a real ICICI statement's credit ("CR") rows for an
 * ordinary merchant refund carry NO keyword at all -- just the same
 * merchant description as the original purchase, with a "CR" suffix on
 * the amount (see parse-transactions.ts's ROW_REGEX). The only credit
 * row that identifies itself by name is the bank's own payment-received
 * line ("INFINITY PAYMENT RECEIVED, THANK YOU" on both real statements
 * this was built against). So the rule here is: a payment-received match
 * wins; a cashback/reversal keyword match wins if present (kept as a
 * defensive fallback -- neither has been observed on a real statement,
 * whose cashback/points are disbursed separately, never as a transaction
 * row); anything else that's a credit is assumed to be a merchant
 * refund, since there's no other explanation for a negative-direction
 * amount against a normal merchant description.
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
 * A real RuPay-variant statement (unlike the Amazon Pay one this
 * classifier started with) does print its own fee/tax transaction rows
 * -- "DCC Fee" (Dynamic Currency Conversion) and "SGST-CI@9%"/"CGST-
 * CI@9%" lines all appeared on a real statement. Kept alongside the
 * HDFC/Axis-style patterns that haven't been seen on either real ICICI
 * statement yet, as a defensive superset.
 */
export function isBankFeeOrTax(description: string): boolean {
  return (
    /^IGST-/i.test(description) ||
    /^CGST-/i.test(description) ||
    /^SGST-/i.test(description) ||
    /^GST-/i.test(description) ||
    /^GST$/i.test(description) ||
    /^DCC Fee$/i.test(description) ||
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
 * prints a "Cash Advances" total (0.00 on both real statements this was
 * built against) but no cash-advance transaction row exists on either to
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
