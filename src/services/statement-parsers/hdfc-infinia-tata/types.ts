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
 * Covers two real HDFC-issued credit card products, not just one -- this
 * module started as "hdfc-infinia" (the Infinia card only) and was
 * renamed after a real Tata Neu Plus HDFC Bank Credit Card statement
 * turned out to reconcile against the exact same parser with zero
 * changes needed for transaction parsing (only the header's rewards
 * section needed variant-aware handling -- see parse-header.ts's
 * detectCardVariant). The one real difference: Infinia earns HDFC
 * Reward Points (an "Opening Balance / Points Earned / Disbursed /
 * Adjusted-Lapsed" block, plus a 30/60-day points-expiry breakdown);
 * Tata Neu Plus earns NeuCoins instead (an "Opening NeuCoins with Bank /
 * NeuCoins Earned / NeuCoins Transferred to Tata Neu / Adjusted/Lapsed"
 * block, structurally identical in shape but with no expiry concept at
 * all -- rewardPointsExpiring30Days/60Days default to 0 for this card).
 * rewardPointsBalance/rewardPointsEarned hold whichever reward currency
 * the card actually uses (points or NeuCoins) -- the field names weren't
 * renamed to stay schema-compatible with the existing
 * credit_card_statements columns, same reasoning as Axis's cashbackAmount
 * reusing a shared column across card products.
 */
export interface HdfcStatementHeader {
  issuer: "HDFC";
  cardType: "Infinia" | "Tata Neu Plus";
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
  rewardPointsBalance: number;
  rewardPointsEarned: number;
  /** Only populated for Infinia -- Tata Neu Plus's NeuCoins have no
   * expiry concept on the one real statement this was tested against,
   * so both default to 0 for that card. */
  rewardPointsExpiring30Days: number;
  rewardPointsExpiring60Days: number;
  cashbackAmount: Money;
  rewardPointsSummary: RewardProgramLine[];
  cashbackSummary: CashbackSummaryLine[];
  statementCurrency: "INR";
}

export type CardholderType = "primary" | "addon";
export type TransactionType = "debit" | "credit";
export type CreditType = "payment" | "cashback" | "refund" | "reversal" | null;

export interface HdfcTransaction {
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
