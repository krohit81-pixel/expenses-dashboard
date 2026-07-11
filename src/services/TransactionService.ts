import "server-only";

import { dbNumberToMoney, moneyToDbNumber, type Money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { Enum } from "@/lib/db/helpers";
import {
  createTransactionInputSchema,
  type CreateTransactionInput,
} from "@/features/transactions/schemas";

export type { CreateTransactionInput };
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
  splits: TransactionSplit[];
}

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  kind?: TransactionKind;
  occurredFrom?: string;
  occurredTo?: string;
  search?: string;
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
  return `id, account_id, transfer_account_id, kind, status, amount, currency_code, occurred_on, payee, memo, ${splitsEmbed}`;
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
  const supabase = await createClient();
  const limit = Math.min(filters.limit ?? 50, 200);
  const offset = filters.offset ?? 0;

  let query = supabase
    .from("transactions")
    .select(buildTransactionSelect(Boolean(filters.categoryId)), {
      count: "exact",
    })
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.accountId) {
    query = query.eq("account_id", filters.accountId);
  }
  if (filters.kind) {
    query = query.eq("kind", filters.kind);
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
  const supabase = await createClient();

  const { data: txRow, error: txError } = await supabase
    .from("transactions")
    .insert({
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
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ status: "void" })
    .eq("id", transactionId);

  if (error) {
    throw new Error(`Failed to void transaction: ${error.message}`);
  }
}
