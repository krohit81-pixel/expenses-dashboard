import "server-only";

import { dbNumberToMoney, moneyToDbNumber, type Money } from "@/lib/money";
import { createServiceClient } from "@/lib/supabase/service";
import { OWNER_USER_ID } from "@/lib/owner";
import type { Enum } from "@/lib/db/helpers";
import {
  createTransactionInputSchema,
  updateTransactionInputSchema,
  type CreateTransactionInput,
  type UpdateTransactionInput,
} from "@/features/transactions/schemas";

export type { CreateTransactionInput, UpdateTransactionInput };
export type TransactionKind = Enum<"transaction_kind">;
export type TransactionStatus = Enum<"transaction_status">;

export interface TransactionSplit {
  categoryId: string;
  amount: Money;
  memo: string | null;
}

export interface Transaction {
  id: string;
  accountId: string;
  transferAccountId: string | null;
  kind: TransactionKind;
  status: TransactionStatus;
  amount: Money;
  currencyCode: string;
  occurredOn: string;
  payee: string | null;
  memo: string | null;
  recurringTransactionId: string | null;
  splits: TransactionSplit[];
}

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  kind?: TransactionKind;
  status?: TransactionStatus;
  occurredFrom?: string;
  occurredTo?: string;
  search?: string;
  /** Only transactions NOT generated from a recurring template — the
   * ad-hoc ones (card payments, one-off entries). Used by the Budget
   * month snapshot to show these as a distinct "logged this month"
   * group, separate from the recurring plan. */
  oneOffOnly?: boolean;
  /** Only transactions generated from this specific recurring template —
   * used by the Budget month snapshot to check whether a template's
   * projected amount has already been superseded by a real transaction
   * for the target month. */
  recurringTransactionId?: string;
  limit?: number;
  offset?: number;
}

interface TransactionRow {
  id: string;
  account_id: string;
  transfer_account_id: string | null;
  kind: TransactionKind;
  status: TransactionStatus;
  amount: number;
  currency_code: string;
  occurred_on: string;
  payee: string | null;
  memo: string | null;
  recurring_transaction_id: string | null;
  transaction_splits: {
    category_id: string;
    amount: number;
    memo: string | null;
  }[];
}

function buildTransactionSelect(filterByCategory: boolean): string {
  const splitsEmbed = filterByCategory
    ? "transaction_splits!inner(category_id, amount, memo)"
    : "transaction_splits(category_id, amount, memo)";
  return `id, account_id, transfer_account_id, kind, status, amount, currency_code, occurred_on, payee, memo, recurring_transaction_id, ${splitsEmbed}`;
}

function mapRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    accountId: row.account_id,
    transferAccountId: row.transfer_account_id,
    kind: row.kind,
    status: row.status,
    amount: dbNumberToMoney(row.amount),
    currencyCode: row.currency_code,
    occurredOn: row.occurred_on,
    payee: row.payee,
    memo: row.memo,
    recurringTransactionId: row.recurring_transaction_id,
    splits: row.transaction_splits.map((split) => ({
      categoryId: split.category_id,
      amount: dbNumberToMoney(split.amount),
      memo: split.memo,
    })),
  };
}

export async function listTransactions(
  filters: TransactionFilters = {},
): Promise<{ transactions: Transaction[]; total: number }> {
  const supabase = createServiceClient();
  const limit = Math.min(filters.limit ?? 50, 200);
  const offset = filters.offset ?? 0;

  let query = supabase
    .from("transactions")
    .select(buildTransactionSelect(Boolean(filters.categoryId)), {
      count: "exact",
    })
    .eq("user_id", OWNER_USER_ID)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.accountId) {
    query = query.eq("account_id", filters.accountId);
  }
  if (filters.kind) {
    query = query.eq("kind", filters.kind);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.occurredFrom) {
    query = query.gte("occurred_on", filters.occurredFrom);
  }
  if (filters.occurredTo) {
    query = query.lte("occurred_on", filters.occurredTo);
  }
  if (filters.search) {
    query = query.or(
      `payee.ilike.%${filters.search}%,memo.ilike.%${filters.search}%`,
    );
  }
  if (filters.categoryId) {
    query = query.eq("transaction_splits.category_id", filters.categoryId);
  }
  if (filters.oneOffOnly) {
    query = query.is("recurring_transaction_id", null);
  }
  if (filters.recurringTransactionId) {
    query = query.eq(
      "recurring_transaction_id",
      filters.recurringTransactionId,
    );
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to load transactions: ${error.message}`);
  }

  return {
    transactions: (data as unknown as TransactionRow[]).map(mapRow),
    total: count ?? 0,
  };
}

/**
 * Creates a transaction and, for split transactions, its child split rows.
 * Not atomic yet (no RPC exists for this) — if the splits insert fails
 * after the transaction insert succeeds, the transaction row is deleted as
 * a best-effort compensating action. See the same note on AccountService's
 * createAccount; both should move to a Postgres function together.
 */
export async function createTransaction(
  input: CreateTransactionInput,
): Promise<Transaction> {
  const parsed = createTransactionInputSchema.parse(input);
  const supabase = createServiceClient();

  const { data: txRow, error: txError } = await supabase
    .from("transactions")
    .insert({
      user_id: OWNER_USER_ID,
      account_id: parsed.accountId,
      transfer_account_id:
        parsed.kind === "transfer" ? parsed.transferAccountId : null,
      kind: parsed.kind,
      status: parsed.status,
      amount: moneyToDbNumber(parsed.amount),
      currency_code: parsed.currencyCode,
      occurred_on: parsed.occurredOn,
      payee: parsed.payee ?? null,
      memo: parsed.memo ?? null,
    })
    .select("id")
    .single();

  if (txError) {
    throw new Error(`Failed to create transaction: ${txError.message}`);
  }

  const splitsToInsert =
    parsed.kind !== "transfer" && "splits" in parsed && parsed.splits
      ? parsed.splits
      : parsed.kind !== "transfer" &&
          "categoryId" in parsed &&
          parsed.categoryId
        ? [{ categoryId: parsed.categoryId, amount: parsed.amount, memo: null }]
        : [];

  if (splitsToInsert.length > 0) {
    const { error: splitsError } = await supabase
      .from("transaction_splits")
      .insert(
        splitsToInsert.map((split) => ({
          user_id: OWNER_USER_ID,
          transaction_id: txRow.id,
          category_id: split.categoryId,
          amount: moneyToDbNumber(split.amount),
          memo: split.memo ?? null,
        })),
      );

    if (splitsError) {
      await supabase.from("transactions").delete().eq("id", txRow.id);
      throw new Error(
        `Failed to create transaction splits: ${splitsError.message}`,
      );
    }
  }

  const { data: created, error: readError } = await supabase
    .from("transactions")
    .select(buildTransactionSelect(false))
    .eq("id", txRow.id)
    .single();

  if (readError) {
    throw new Error(
      `Transaction was created but could not be re-read: ${readError.message}`,
    );
  }

  return mapRow(created as unknown as TransactionRow);
}

export async function voidTransaction(transactionId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("transactions")
    .update({ status: "void" })
    .eq("id", transactionId)
    .eq("user_id", OWNER_USER_ID);

  if (error) {
    throw new Error(`Failed to void transaction: ${error.message}`);
  }
}

/**
 * Flips a pending transaction to posted. Used for "upcoming" one-time
 * commitments (see docs on the dashboard's Upcoming section) once the
 * money actually moves — this is a status-only update, not a full edit
 * (transaction editing more broadly doesn't exist yet).
 */
export async function markTransactionPaid(
  transactionId: string,
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("transactions")
    .update({ status: "posted" })
    .eq("id", transactionId)
    .eq("user_id", OWNER_USER_ID)
    .eq("status", "pending");

  if (error) {
    throw new Error(`Failed to mark transaction paid: ${error.message}`);
  }
}

/**
 * Updates a transaction's amount, date, and memo — see the narrow-scope
 * note on updateTransactionInputSchema. Doesn't touch splits, so a
 * multi-category expense's per-category breakdown can't be edited this
 * way yet; this covers the actual need (fixing a scheduled card
 * payment's amount/date, tagging its billing cycle in memo).
 */
export async function updateTransaction(
  input: UpdateTransactionInput,
): Promise<Transaction> {
  const parsed = updateTransactionInputSchema.parse(input);
  const supabase = createServiceClient();

  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      amount: moneyToDbNumber(parsed.amount),
      occurred_on: parsed.occurredOn,
      memo: parsed.memo ?? null,
    })
    .eq("id", parsed.id)
    .eq("user_id", OWNER_USER_ID);

  if (updateError) {
    throw new Error(`Failed to update transaction: ${updateError.message}`);
  }

  const { data: updated, error: readError } = await supabase
    .from("transactions")
    .select(buildTransactionSelect(false))
    .eq("id", parsed.id)
    .single();

  if (readError) {
    throw new Error(`Transaction was updated but could not be re-read`);
  }

  return mapRow(updated as unknown as TransactionRow);
}
