/**
 * The one fully-prepared props object CreditCardReportDocument and its
 * page components render from — every aggregation (lib/intel/credit-card-report.ts)
 * and category-name lookup already run by the route handler, so this
 * whole component tree stays pure rendering with no data-fetching or
 * business logic of its own.
 */
import type { DonutSlice } from "@/lib/intel/donut";
import type {
  AppendixTransactionRow,
  CategoryMerchantBreakdown,
  LargestTransaction,
  PerCardSummaryRow,
  TopMerchant,
} from "@/lib/intel/credit-card-report";
import type { Money } from "@/lib/money";

export interface CreditCardReportProps {
  cycleLabel: string;
  generatedOn: string;
  currency: string;
  grandTotal: Money;
  totalDue: Money;
  cardCount: number;
  transactionCount: number;
  donutSlices: DonutSlice[];
  categoryMerchantBreakdown: CategoryMerchantBreakdown[];
  perCardSummary: PerCardSummaryRow[];
  topMerchants: TopMerchant[];
  largestTransactions: LargestTransaction[];
  combinedTransactions: AppendixTransactionRow[];
  llmPrompt: string;
}
