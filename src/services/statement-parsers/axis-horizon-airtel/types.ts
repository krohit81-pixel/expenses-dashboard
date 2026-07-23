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
 * Covers two real Axis Bank retail credit card products, not just one --
 * this module started as "axis-horizon" (the Horizon travel/miles card
 * only) and was renamed after a second real statement (an Airtel-
 * co-branded Mastercard, a cashback card) turned out to reconcile
 * against the exact same layout, password scheme, and statement
 * conventions with no structural changes needed. The one real
 * difference: Horizon earns eDGE Miles reward points (an "eDGE MILES
 * POINTS" balance block); Airtel earns cashback instead (a "CASHBACK
 * DETAILS" block) -- see parse-header.ts's detectCardVariant. Neither
 * card's own product name needed inferring the hard way, though --
 * unlike the icici-amazon-rupay parser's two products, both of these
 * statements print their own product name plainly at the very top
 * ("Axis Bank HORIZON Credit Card" / "Airtel Axis Bank Mastercard Credit
 * Card Statement"), so cardType is read directly from whichever rewards
 * section is present, which happens to line up with which product name
 * is printed on both real samples tested.
 */
export interface AxisStatementHeader {
  issuer: "AXIS";
  cardType: "horizon" | "airtel";
  cardLast4: string;
  primaryCardholder: string;
  statementDate: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  dueDate: string;
  totalAmountDue: Money;
  minimumDue: Money;
  previousStatementDue: Money;
  paymentsReceived: Money;
  purchasesDebit: Money;
  financeCharges: Money;
  availableCreditLimit: Money;
  totalCreditLimit: Money;
  availableCashLimit: Money;
  /** Only populated for a Horizon statement (see cardType above) -- 0
   * for an Airtel statement, which earns cashback instead (see
   * cashbackAmount below). */
  rewardPointsBalance: number;
  rewardPointsEarned: number;
  rewardPointsExpiring30Days: number;
  rewardPointsExpiring60Days: number;
  /** Only populated for an Airtel statement (see cardType above) -- the
   * statement's own "CASHBACK DETAILS" / "Cashback Earned" figure for
   * this cycle. 0.00 for a Horizon statement, which earns eDGE Miles
   * points instead. */
  cashbackAmount: Money;
  rewardPointsSummary: RewardProgramLine[];
  cashbackSummary: CashbackSummaryLine[];
  statementCurrency: "INR";
}

export type CardholderType = "primary" | "addon";
export type TransactionType = "debit" | "credit";
export type CreditType = "payment" | "cashback" | "refund" | "reversal" | null;

export interface AxisTransaction {
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
