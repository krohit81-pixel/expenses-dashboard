import type { CreditType, TransactionType } from "./types";

export interface Classification {
  isPayment: boolean;
  isCashback: boolean;
  isRefund: boolean;
  creditType: CreditType;
  paymentReference: string | null;
}

/**
 * Rule-based, from the description text and the direction the statement
 * itself already told us (transactionType, derived from whether a "+"
 * preceded the amount -- see parse-transactions.ts). This never infers
 * direction from the description; it only explains a credit that's
 * already been identified as one.
 */
export function classifyTransaction(
  description: string,
  transactionType: TransactionType,
): Classification {
  const isPayment = /credit\s*card\s*payment/i.test(description);
  const isCashback = /cash\s*back/i.test(description);
  const isReversal = /reversal/i.test(description);
  // "refund" alone, not already caught by the more specific reversal check.
  const isRefund = !isReversal && /refund/i.test(description);

  const referenceMatch = description.match(/\(Ref#?\s*([0-9A-Za-z]+)\)/i);
  const paymentReference = referenceMatch ? referenceMatch[1] : null;

  if (transactionType !== "credit") {
    return {
      isPayment: false,
      isCashback: false,
      isRefund: false,
      creditType: null,
      paymentReference: null,
    };
  }

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
    paymentReference: isPayment ? paymentReference : null,
  };
}
