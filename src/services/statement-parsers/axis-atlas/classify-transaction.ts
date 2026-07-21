import type { CreditType, TransactionType } from "./types";

export interface Classification {
  isPayment: boolean;
  isCashback: boolean;
  isRefund: boolean;
  creditType: CreditType;
  paymentReference: string | null;
}

export function classifyTransaction(
  description: string,
  transactionType: TransactionType,
): Classification {
  const isPayment = /credit\s*card\s*payment/i.test(description);
  const isCashback = /cash\s*back/i.test(description);
  const isReversal = /reversal/i.test(description);
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

export function isBankFeeOrTax(description: string): boolean {
  return (
    /^IGST-/i.test(description) ||
    /^CGST-/i.test(description) ||
    /^SGST-/i.test(description) ||
    /^GST-/i.test(description) ||
    /^CONSOLIDATED FCY MARKUP FEE/i.test(description) ||
    /\bDCC Transaction\b/i.test(description) ||
    /late payment fee/i.test(description) ||
    /late fee/i.test(description) ||
    /annual fee/i.test(description) ||
    /finance charge/i.test(description) ||
    /forex markup/i.test(description)
  );
}
