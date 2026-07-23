import type { Money } from "@/lib/money";

export interface RewardProgramLine {
  srNo: number;
  program: string;
  bonusPoints: number;
}

export interface CashbackSummaryLine {
  srNo: number;
  transaction: string;
  amount: Money;
}

/**
 * ICICI's Amazon Pay statement doesn't split its "Purchases / Charges"
 * and "Cash Advances" totals the way HDFC's purchasesDebit/financeCharges
 * split does, and it has no traditional points program at all -- see this
 * module's parse-header.ts for the actual field-mapping decisions. Field
 * *names* below still match HdfcStatementHeader/AxisStatementHeader
 * field-for-field (not renamed to "cashAdvances" etc.) on purpose: it's
 * what lets CreditCardStatementService's save function reuse the exact
 * same credit_card_statements insert shape for all three issuers, since
 * that table's columns are already issuer-agnostic. The comments on each
 * field below say what it actually holds for this card.
 */
export interface IciciStatementHeader {
  issuer: "ICICI";
  cardType: "Amazon Pay";
  cardLast4: string;
  primaryCardholder: string;
  statementDate: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  dueDate: string;
  totalAmountDue: Money;
  minimumDue: Money;
  /** The statement's own "Previous Balance" figure. */
  previousStatementDue: Money;
  /** The statement's own "Payments / Credits" figure -- payments AND
   * refunds/credits folded together, same as Axis's paymentsReceived. */
  paymentsReceived: Money;
  /** The statement's own "Purchases / Charges" figure -- already a
   * combined bucket on this statement (fees/GST are folded into the
   * printed transaction amount itself, per the statement's own "Mark-up
   * fee and corresponding GST levied is included in the transaction
   * amount displayed" footnote), so unlike HDFC/Axis there's no separate
   * fee total to carve out of this one. */
  purchasesDebit: Money;
  /** Holds the statement's own "Cash Advances" figure -- NOT a "finance
   * charges" total the way HDFC/Axis use this field. Named financeCharges
   * anyway so the shared save-statement code path doesn't need a
   * per-issuer column mapping; see reconcile.ts for how this is checked. */
  financeCharges: Money;
  availableCreditLimit: Money;
  totalCreditLimit: Money;
  availableCashLimit: Money;
  /** Amazon Pay ICICI Bank Credit Card has no traditional reward-points
   * program -- it earns cashback straight into the cardholder's Amazon
   * Pay balance (see cashbackAmount below). Always 0; kept only so this
   * header shape matches HdfcStatementHeader/AxisStatementHeader. */
  rewardPointsBalance: number;
  rewardPointsEarned: number;
  rewardPointsExpiring30Days: number;
  rewardPointsExpiring60Days: number;
  /** The statement's own "EARNINGS" section total -- cashback earned
   * this cycle, credited to the cardholder's Amazon Pay balance (not
   * reward points). */
  cashbackAmount: Money;
  /** Never populated for this card -- no per-program points table is
   * printed (see rewardPointsBalance above). */
  rewardPointsSummary: RewardProgramLine[];
  /** Never populated for this card -- the EARNINGS section prints one
   * cycle total (cashbackAmount above), not a per-transaction table. */
  cashbackSummary: CashbackSummaryLine[];
  statementCurrency: "INR";
}

export type CardholderType = "primary" | "addon";
export type TransactionType = "debit" | "credit";
export type CreditType = "payment" | "cashback" | "refund" | "reversal" | null;

export interface IciciTransaction {
  transactionDate: string;
  transactionTime: string | null;
  description: string;
  merchantRaw: string | null;
  merchantNormalized: string | null;
  amount: Money;
  currency: "INR";
  transactionType: TransactionType;
  isPayment: boolean;
  isCashback: boolean;
  isRefund: boolean;
  isEmi: boolean;
  creditType: CreditType;
  paymentReference: string | null;
  emiMerchant: string | null;
  emiAmount: Money | null;
  rewardPoints: number | null;
  purchaseIndicatorCode: string | null;
  purchaseIndicatorName: string | null;
  cardholderType: CardholderType;
  cardholderName: string;
  pageNumber: number;
  sequenceNumber: number;
  rawText: string;
}
