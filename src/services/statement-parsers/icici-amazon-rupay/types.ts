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
 * Covers two real ICICI Bank retail credit card products, not just one --
 * this module started as "icici-amazon" (Amazon Pay only) and was
 * renamed after a second real statement (a Sapphiro card, spent almost
 * entirely via RuPay-linked UPI) turned out to reconcile against the
 * exact same layout, password scheme, and statement conventions with no
 * structural changes needed. See parse-header.ts's detectCardVariant for
 * the one real difference between the two: Amazon Pay earns cashback
 * into the cardholder's Amazon Pay balance (an "EARNINGS" section);
 * every other ICICI retail card this was tested against earns ordinary
 * reward points (an "ICICI Bank Rewards" section) instead. Neither
 * statement prints its own product name as text anywhere in the body
 * (confirmed by full-text search against both real samples), so cardType
 * is inferred from which of those two sections is present, not read
 * directly.
 *
 * Field *names* below still match HdfcStatementHeader/AxisStatementHeader
 * field-for-field (not renamed to "cashAdvances" etc.) on purpose: it's
 * what lets CreditCardStatementService's save function reuse the exact
 * same credit_card_statements insert shape for all three issuers, since
 * that table's columns are already issuer-agnostic. The comments on each
 * field below say what it actually holds for this issuer.
 */
export interface IciciStatementHeader {
  issuer: "ICICI";
  cardType: "Amazon Pay" | "RuPay";
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
  /** Only populated for a RuPay-variant statement (see cardType above) --
   * the statement's own "Total Points earned" figure for this cycle. 0
   * for an Amazon Pay statement, which earns cashback instead (see
   * cashbackAmount below). No running points *balance* is printed on
   * either real statement this was tested against, so
   * rewardPointsBalance stays 0 either way. */
  rewardPointsBalance: number;
  rewardPointsEarned: number;
  rewardPointsExpiring30Days: number;
  rewardPointsExpiring60Days: number;
  /** Only populated for an Amazon Pay statement (see cardType above) --
   * the "EARNINGS" section's cycle cashback total, credited to the
   * cardholder's Amazon Pay balance (not reward points). 0.00 for a
   * RuPay-variant statement, which earns points instead. */
  cashbackAmount: Money;
  /** Never populated by this parser -- neither real statement this was
   * tested against prints a per-program points table. */
  rewardPointsSummary: RewardProgramLine[];
  /** Never populated by this parser -- neither real statement this was
   * tested against prints a per-transaction cashback table. */
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
