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

export interface HdfcStatementHeader {
  issuer: "HDFC";
  cardType: "Infinia";
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
