import "server-only";

import { createHash } from "node:crypto";

import { moneyToDbNumber } from "@/lib/money";
import { OWNER_USER_ID } from "@/lib/owner";
import { createServiceClient } from "@/lib/supabase/service";
import { cycleMonthForStatementDate } from "@/lib/statement-cycle";
import { resolveMerchantsForImport } from "@/services/MerchantDictionaryService";
import {
  HdfcHeaderParseError,
  parseHdfcInfiniaHeader,
} from "@/services/statement-parsers/hdfc-infinia/parse-header";
import {
  HdfcTransactionParseError,
  parseHdfcTransactions,
} from "@/services/statement-parsers/hdfc-infinia/parse-transactions";
import {
  assertHdfcStatementReconciles,
  HdfcReconciliationError,
} from "@/services/statement-parsers/hdfc-infinia/reconcile";
import {
  AxisHeaderParseError,
  parseAxisHeader,
} from "@/services/statement-parsers/axis-horizon/parse-header";
import {
  AxisTransactionParseError,
  parseAxisTransactions,
} from "@/services/statement-parsers/axis-horizon/parse-transactions";
import {
  assertAxisStatementReconciles,
  AxisReconciliationError,
} from "@/services/statement-parsers/axis-horizon/reconcile";
import {
  IciciHeaderParseError,
  parseIciciHeader,
} from "@/services/statement-parsers/icici-amazon-rupay/parse-header";
import {
  IciciTransactionParseError,
  parseIciciTransactions,
} from "@/services/statement-parsers/icici-amazon-rupay/parse-transactions";
import {
  assertIciciStatementReconciles,
  IciciReconciliationError,
} from "@/services/statement-parsers/icici-amazon-rupay/reconcile";
import type { Json } from "@/lib/db/database-types";
import type { HdfcStatementHeader } from "@/services/statement-parsers/hdfc-infinia/types";
import type { AxisStatementHeader } from "@/services/statement-parsers/axis-horizon/types";
import type { IciciStatementHeader } from "@/services/statement-parsers/icici-amazon-rupay/types";

export {
  HdfcHeaderParseError,
  HdfcReconciliationError,
  HdfcTransactionParseError,
  AxisHeaderParseError,
  AxisReconciliationError,
  AxisTransactionParseError,
  IciciHeaderParseError,
  IciciReconciliationError,
  IciciTransactionParseError,
};

export interface SaveHdfcStatementResult {
  /** "duplicate" means this exact statement was already saved -- see statement_hash below. Nothing new was written. */
  outcome: "saved" | "duplicate";
  statementId: string;
  header: HdfcStatementHeader;
  transactionCount: number;
  /** How many of this statement's transactions reference a merchant with no category yet -- see needs_review. Always 0 for a "duplicate" outcome. */
  needsReviewCount: number;
}

export interface SaveAxisStatementResult {
  outcome: "saved" | "duplicate";
  statementId: string;
  header: AxisStatementHeader;
  transactionCount: number;
  needsReviewCount: number;
}

export interface SaveIciciStatementResult {
  outcome: "saved" | "duplicate";
  statementId: string;
  header: IciciStatementHeader;
  transactionCount: number;
  needsReviewCount: number;
}

/**
 * sha256 of the extracted statement text (not the original PDF bytes --
 * see the migration's comment on statement_hash for why: two
 * byte-different-but-content-identical exports of the same statement
 * should still be recognized as the same statement).
 */
function hashStatementText(pageTexts: string[]): string {
  return createHash("sha256").update(pageTexts.join("\n")).digest("hex");
}

/**
 * Parses, reconciles, and persists an HDFC Infinia statement -- the full
 * pipeline behind "parse and save automatically" (Atlas has no manual
 * review/confirm step; reconciliation is what stands in for one). Throws
 * HdfcHeaderParseError / HdfcTransactionParseError if the text can't be
 * turned into structured data, or HdfcReconciliationError if it parses
 * but the numbers don't add up -- in both cases nothing is written to
 * the database. Never overwrites or duplicates an already-saved
 * statement (see statement_hash); calling this again with the same PDF
 * is always safe and returns { outcome: "duplicate" } instead of erroring.
 */
export async function saveHdfcInfiniaStatement(
  pageTexts: string[],
  pdfFilename: string,
): Promise<SaveHdfcStatementResult> {
  const header = parseHdfcInfiniaHeader(pageTexts);
  const transactions = parseHdfcTransactions(pageTexts);
  assertHdfcStatementReconciles(header, transactions);

  const statementHash = hashStatementText(pageTexts);
  const supabase = createServiceClient();

  const { data: existing, error: lookupError } = await supabase
    .from("credit_card_statements")
    .select("id")
    .eq("user_id", OWNER_USER_ID)
    .eq("statement_hash", statementHash)
    .eq("statement_date", header.statementDate)
    .eq("card_last4", header.cardLast4)
    .maybeSingle();

  if (lookupError) {
    throw new Error(
      `Failed to check for a duplicate statement: ${lookupError.message}`,
    );
  }
  if (existing) {
    return {
      outcome: "duplicate",
      statementId: existing.id,
      header,
      transactionCount: transactions.length,
      needsReviewCount: 0,
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("credit_card_statements")
    .insert({
      user_id: OWNER_USER_ID,
      issuer: header.issuer,
      card_type: header.cardType,
      card_last4: header.cardLast4,
      primary_cardholder: header.primaryCardholder,
      statement_date: header.statementDate,
      billing_period_start: header.billingPeriodStart,
      billing_period_end: header.billingPeriodEnd,
      due_date: header.dueDate,
      total_amount_due: moneyToDbNumber(header.totalAmountDue),
      minimum_due: moneyToDbNumber(header.minimumDue),
      previous_statement_due: moneyToDbNumber(header.previousStatementDue),
      payments_received: moneyToDbNumber(header.paymentsReceived),
      purchases_debit: moneyToDbNumber(header.purchasesDebit),
      finance_charges: moneyToDbNumber(header.financeCharges),
      available_credit_limit: moneyToDbNumber(header.availableCreditLimit),
      total_credit_limit: moneyToDbNumber(header.totalCreditLimit),
      available_cash_limit: moneyToDbNumber(header.availableCashLimit),
      reward_points_balance: header.rewardPointsBalance,
      reward_points_earned: header.rewardPointsEarned,
      reward_points_expiring_30_days: header.rewardPointsExpiring30Days,
      reward_points_expiring_60_days: header.rewardPointsExpiring60Days,
      cashback_amount: moneyToDbNumber(header.cashbackAmount),
      // Cast, not re-serialized: these are already plain
      // string/number/boolean data (see types.ts), just missing an index
      // signature TypeScript wants for a structural Json match.
      reward_points_summary: header.rewardPointsSummary as unknown as Json,
      cashback_summary: header.cashbackSummary as unknown as Json,
      statement_currency: header.statementCurrency,
      pdf_filename: pdfFilename,
      statement_hash: statementHash,
      // v1.6.1: which cash-flow cycle this statement is paid from --
      // see cycleMonthForStatementDate's own comment for the (statement
      // month + 1) rule this implements.
      cycle_month: cycleMonthForStatementDate(header.statementDate),
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    throw new Error(
      `Failed to save statement: ${insertError?.message ?? "unknown error"}`,
    );
  }

  let needsReviewCount = 0;

  if (transactions.length > 0) {
    // Merchant Dictionary resolution happens here, not inside the HDFC
    // parser -- the parser's only job is producing merchantRaw/
    // merchantNormalized from the statement text; deciding what merchant
    // (and eventually what category) that resolves to is shared,
    // dictionary-driven logic every future card parser reuses as-is. A
    // credit row with no merchant (a payment, cashback, refund -- see
    // isNonMerchantCredit in parse-transactions.ts) has merchantRaw null
    // and is never sent to the dictionary; merchant_id and needs_review
    // both stay at their defaults (null / false) for those rows.
    const merchantInputs = transactions
      .filter((t) => t.merchantRaw !== null)
      .map((t) => ({
        rawText: t.merchantRaw!,
        normalizedText: t.merchantNormalized ?? t.merchantRaw!,
        sourceBank: "hdfc-infinia",
        currency: t.currency,
      }));
    const merchantResolutions = await resolveMerchantsForImport(merchantInputs);

    const { error: transactionsError } = await supabase
      .from("credit_card_transactions")
      .insert(
        transactions.map((t) => {
          const resolution =
            t.merchantRaw !== null
              ? merchantResolutions.get(t.merchantRaw)
              : undefined;
          return {
            user_id: OWNER_USER_ID,
            statement_id: inserted.id,
            transaction_date: t.transactionDate,
            transaction_time: t.transactionTime,
            description: t.description,
            merchant_raw: t.merchantRaw,
            merchant_normalized: t.merchantNormalized,
            amount: moneyToDbNumber(t.amount),
            currency: t.currency,
            transaction_type: t.transactionType,
            is_payment: t.isPayment,
            is_cashback: t.isCashback,
            is_refund: t.isRefund,
            is_emi: t.isEmi,
            credit_type: t.creditType,
            payment_reference: t.paymentReference,
            emi_merchant: t.emiMerchant,
            emi_amount: t.emiAmount ? moneyToDbNumber(t.emiAmount) : null,
            reward_points: t.rewardPoints,
            purchase_indicator_code: t.purchaseIndicatorCode,
            purchase_indicator_name: t.purchaseIndicatorName,
            cardholder_type: t.cardholderType,
            cardholder_name: t.cardholderName,
            page_number: t.pageNumber,
            sequence_number: t.sequenceNumber,
            raw_text: t.rawText,
            merchant_id: resolution?.merchantId ?? null,
            needs_review: resolution?.needsReview ?? false,
          };
        }),
      );

    if (transactionsError) {
      // A statement row with no (or partial) transactions is worse than
      // no statement row at all -- it would permanently block
      // re-importing the same PDF via the dedup check above, without
      // ever having usable transaction data. Roll it back rather than
      // leave a half-saved statement behind.
      await supabase
        .from("credit_card_statements")
        .delete()
        .eq("id", inserted.id);
      throw new Error(
        `Failed to save transactions: ${transactionsError.message}`,
      );
    }

    needsReviewCount = transactions.filter((t) => {
      const resolution =
        t.merchantRaw !== null
          ? merchantResolutions.get(t.merchantRaw)
          : undefined;
      return resolution?.needsReview ?? false;
    }).length;
  }

  return {
    outcome: "saved",
    statementId: inserted.id,
    header,
    transactionCount: transactions.length,
    needsReviewCount,
  };
}

/**
 * Parses, reconciles, and persists an Axis Horizon statement -- mirrors
 * saveHdfcInfiniaStatement's pipeline exactly, since
 * credit_card_statements/credit_card_transactions are already
 * issuer-agnostic (generic issuer/card_type/card_last4 columns -- see
 * that migration's own comment), and AxisStatementHeader/AxisTransaction
 * (see axis-horizon/types.ts) intentionally match HdfcStatementHeader/
 * HdfcTransaction field-for-field. The only per-issuer differences live
 * inside the axis-horizon parser module itself (its own header/transaction
 * regexes, tuned against a real Axis statement -- see that module's own
 * comments), not in how a parsed statement gets saved.
 */
export async function saveAxisHorizonStatement(
  pageTexts: string[],
  pdfFilename: string,
): Promise<SaveAxisStatementResult> {
  const header = parseAxisHeader(pageTexts);
  const transactions = parseAxisTransactions(pageTexts);
  assertAxisStatementReconciles(header, transactions);

  const statementHash = hashStatementText(pageTexts);
  const supabase = createServiceClient();

  const { data: existing, error: lookupError } = await supabase
    .from("credit_card_statements")
    .select("id")
    .eq("user_id", OWNER_USER_ID)
    .eq("statement_hash", statementHash)
    .eq("statement_date", header.statementDate)
    .eq("card_last4", header.cardLast4)
    .maybeSingle();

  if (lookupError) {
    throw new Error(
      `Failed to check for a duplicate statement: ${lookupError.message}`,
    );
  }
  if (existing) {
    return {
      outcome: "duplicate",
      statementId: existing.id,
      header,
      transactionCount: transactions.length,
      needsReviewCount: 0,
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("credit_card_statements")
    .insert({
      user_id: OWNER_USER_ID,
      issuer: header.issuer,
      card_type: header.cardType,
      card_last4: header.cardLast4,
      primary_cardholder: header.primaryCardholder,
      statement_date: header.statementDate,
      billing_period_start: header.billingPeriodStart,
      billing_period_end: header.billingPeriodEnd,
      due_date: header.dueDate,
      total_amount_due: moneyToDbNumber(header.totalAmountDue),
      minimum_due: moneyToDbNumber(header.minimumDue),
      previous_statement_due: moneyToDbNumber(header.previousStatementDue),
      payments_received: moneyToDbNumber(header.paymentsReceived),
      purchases_debit: moneyToDbNumber(header.purchasesDebit),
      finance_charges: moneyToDbNumber(header.financeCharges),
      available_credit_limit: moneyToDbNumber(header.availableCreditLimit),
      total_credit_limit: moneyToDbNumber(header.totalCreditLimit),
      available_cash_limit: moneyToDbNumber(header.availableCashLimit),
      reward_points_balance: header.rewardPointsBalance,
      reward_points_earned: header.rewardPointsEarned,
      reward_points_expiring_30_days: header.rewardPointsExpiring30Days,
      reward_points_expiring_60_days: header.rewardPointsExpiring60Days,
      cashback_amount: moneyToDbNumber(header.cashbackAmount),
      reward_points_summary: header.rewardPointsSummary as unknown as Json,
      cashback_summary: header.cashbackSummary as unknown as Json,
      statement_currency: header.statementCurrency,
      pdf_filename: pdfFilename,
      statement_hash: statementHash,
      cycle_month: cycleMonthForStatementDate(header.statementDate),
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    throw new Error(
      `Failed to save statement: ${insertError?.message ?? "unknown error"}`,
    );
  }

  let needsReviewCount = 0;

  if (transactions.length > 0) {
    const merchantInputs = transactions
      .filter((t) => t.merchantRaw !== null)
      .map((t) => ({
        rawText: t.merchantRaw!,
        normalizedText: t.merchantNormalized ?? t.merchantRaw!,
        sourceBank: "axis-horizon",
        currency: t.currency,
      }));
    const merchantResolutions = await resolveMerchantsForImport(merchantInputs);

    const { error: transactionsError } = await supabase
      .from("credit_card_transactions")
      .insert(
        transactions.map((t) => {
          const resolution =
            t.merchantRaw !== null
              ? merchantResolutions.get(t.merchantRaw)
              : undefined;
          return {
            user_id: OWNER_USER_ID,
            statement_id: inserted.id,
            transaction_date: t.transactionDate,
            transaction_time: t.transactionTime,
            description: t.description,
            merchant_raw: t.merchantRaw,
            merchant_normalized: t.merchantNormalized,
            amount: moneyToDbNumber(t.amount),
            currency: t.currency,
            transaction_type: t.transactionType,
            is_payment: t.isPayment,
            is_cashback: t.isCashback,
            is_refund: t.isRefund,
            is_emi: t.isEmi,
            credit_type: t.creditType,
            payment_reference: t.paymentReference,
            emi_merchant: t.emiMerchant,
            emi_amount: t.emiAmount ? moneyToDbNumber(t.emiAmount) : null,
            reward_points: t.rewardPoints,
            purchase_indicator_code: t.purchaseIndicatorCode,
            purchase_indicator_name: t.purchaseIndicatorName,
            cardholder_type: t.cardholderType,
            cardholder_name: t.cardholderName,
            page_number: t.pageNumber,
            sequence_number: t.sequenceNumber,
            raw_text: t.rawText,
            merchant_id: resolution?.merchantId ?? null,
            needs_review: resolution?.needsReview ?? false,
          };
        }),
      );

    if (transactionsError) {
      await supabase
        .from("credit_card_statements")
        .delete()
        .eq("id", inserted.id);
      throw new Error(
        `Failed to save transactions: ${transactionsError.message}`,
      );
    }

    needsReviewCount = transactions.filter((t) => {
      const resolution =
        t.merchantRaw !== null
          ? merchantResolutions.get(t.merchantRaw)
          : undefined;
      return resolution?.needsReview ?? false;
    }).length;
  }

  return {
    outcome: "saved",
    statementId: inserted.id,
    header,
    transactionCount: transactions.length,
    needsReviewCount,
  };
}

/**
 * Parses, reconciles, and persists an ICICI statement -- covers both
 * Amazon Pay and RuPay-variant cards (see icici-amazon-rupay/types.ts;
 * renamed from saveIciciAmazonStatement in v1.9.0 once a second real
 * statement confirmed one shared parser handles both). Same pipeline as
 * saveHdfcInfiniaStatement/saveAxisHorizonStatement above, for the same
 * reason (credit_card_statements/credit_card_transactions are already
 * issuer-agnostic). One real difference: parseIciciTransactions needs
 * the header's already-parsed primaryCardholder passed in (see that
 * module's own comment on why), so the header must be parsed first here
 * rather than in either order.
 */
export async function saveIciciStatement(
  pageTexts: string[],
  pdfFilename: string,
): Promise<SaveIciciStatementResult> {
  const header = parseIciciHeader(pageTexts);
  const transactions = parseIciciTransactions(
    pageTexts,
    header.primaryCardholder,
  );
  assertIciciStatementReconciles(header, transactions);

  const statementHash = hashStatementText(pageTexts);
  const supabase = createServiceClient();

  const { data: existing, error: lookupError } = await supabase
    .from("credit_card_statements")
    .select("id")
    .eq("user_id", OWNER_USER_ID)
    .eq("statement_hash", statementHash)
    .eq("statement_date", header.statementDate)
    .eq("card_last4", header.cardLast4)
    .maybeSingle();

  if (lookupError) {
    throw new Error(
      `Failed to check for a duplicate statement: ${lookupError.message}`,
    );
  }
  if (existing) {
    return {
      outcome: "duplicate",
      statementId: existing.id,
      header,
      transactionCount: transactions.length,
      needsReviewCount: 0,
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("credit_card_statements")
    .insert({
      user_id: OWNER_USER_ID,
      issuer: header.issuer,
      card_type: header.cardType,
      card_last4: header.cardLast4,
      primary_cardholder: header.primaryCardholder,
      statement_date: header.statementDate,
      billing_period_start: header.billingPeriodStart,
      billing_period_end: header.billingPeriodEnd,
      due_date: header.dueDate,
      total_amount_due: moneyToDbNumber(header.totalAmountDue),
      minimum_due: moneyToDbNumber(header.minimumDue),
      previous_statement_due: moneyToDbNumber(header.previousStatementDue),
      payments_received: moneyToDbNumber(header.paymentsReceived),
      purchases_debit: moneyToDbNumber(header.purchasesDebit),
      finance_charges: moneyToDbNumber(header.financeCharges),
      available_credit_limit: moneyToDbNumber(header.availableCreditLimit),
      total_credit_limit: moneyToDbNumber(header.totalCreditLimit),
      available_cash_limit: moneyToDbNumber(header.availableCashLimit),
      reward_points_balance: header.rewardPointsBalance,
      reward_points_earned: header.rewardPointsEarned,
      reward_points_expiring_30_days: header.rewardPointsExpiring30Days,
      reward_points_expiring_60_days: header.rewardPointsExpiring60Days,
      cashback_amount: moneyToDbNumber(header.cashbackAmount),
      reward_points_summary: header.rewardPointsSummary as unknown as Json,
      cashback_summary: header.cashbackSummary as unknown as Json,
      statement_currency: header.statementCurrency,
      pdf_filename: pdfFilename,
      statement_hash: statementHash,
      cycle_month: cycleMonthForStatementDate(header.statementDate),
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    throw new Error(
      `Failed to save statement: ${insertError?.message ?? "unknown error"}`,
    );
  }

  let needsReviewCount = 0;

  if (transactions.length > 0) {
    const merchantInputs = transactions
      .filter((t) => t.merchantRaw !== null)
      .map((t) => ({
        rawText: t.merchantRaw!,
        normalizedText: t.merchantNormalized ?? t.merchantRaw!,
        sourceBank: "icici-amazon-rupay",
        currency: t.currency,
      }));
    const merchantResolutions = await resolveMerchantsForImport(merchantInputs);

    const { error: transactionsError } = await supabase
      .from("credit_card_transactions")
      .insert(
        transactions.map((t) => {
          const resolution =
            t.merchantRaw !== null
              ? merchantResolutions.get(t.merchantRaw)
              : undefined;
          return {
            user_id: OWNER_USER_ID,
            statement_id: inserted.id,
            transaction_date: t.transactionDate,
            transaction_time: t.transactionTime,
            description: t.description,
            merchant_raw: t.merchantRaw,
            merchant_normalized: t.merchantNormalized,
            amount: moneyToDbNumber(t.amount),
            currency: t.currency,
            transaction_type: t.transactionType,
            is_payment: t.isPayment,
            is_cashback: t.isCashback,
            is_refund: t.isRefund,
            is_emi: t.isEmi,
            credit_type: t.creditType,
            payment_reference: t.paymentReference,
            emi_merchant: t.emiMerchant,
            emi_amount: t.emiAmount ? moneyToDbNumber(t.emiAmount) : null,
            reward_points: t.rewardPoints,
            purchase_indicator_code: t.purchaseIndicatorCode,
            purchase_indicator_name: t.purchaseIndicatorName,
            cardholder_type: t.cardholderType,
            cardholder_name: t.cardholderName,
            page_number: t.pageNumber,
            sequence_number: t.sequenceNumber,
            raw_text: t.rawText,
            merchant_id: resolution?.merchantId ?? null,
            needs_review: resolution?.needsReview ?? false,
          };
        }),
      );

    if (transactionsError) {
      await supabase
        .from("credit_card_statements")
        .delete()
        .eq("id", inserted.id);
      throw new Error(
        `Failed to save transactions: ${transactionsError.message}`,
      );
    }

    needsReviewCount = transactions.filter((t) => {
      const resolution =
        t.merchantRaw !== null
          ? merchantResolutions.get(t.merchantRaw)
          : undefined;
      return resolution?.needsReview ?? false;
    }).length;
  }

  return {
    outcome: "saved",
    statementId: inserted.id,
    header,
    transactionCount: transactions.length,
    needsReviewCount,
  };
}
