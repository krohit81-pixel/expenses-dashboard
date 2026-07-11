import "server-only";

import { dbNumberToMoney, moneyToDbNumber, type Money } from "@/lib/money";
import { computeNextOccurrence, occurrencesUpTo } from "@/lib/dates/recurrence";
import { createClient } from "@/lib/supabase/server";
import type { Enum } from "@/lib/db/helpers";
import {
  createRecurringTransactionInputSchema,
  type CreateRecurringTransactionInput,
} from "@/features/recurring/schemas";

export type { CreateRecurringTransactionInput };

export interface RecurringTransaction {
  id: string;
  accountId: string;
  transferAccountId: string | null;
  kind: Enum<"transaction_kind">;
  amount: Money;
  currencyCode: string;
  payee: string | null;
  memo: string | null;
  frequency: Enum<"recurrence_frequency">;
  intervalCount: number;
  startsOn: string;
  endsOn: string | null;
  nextOccurrenceOn: string;
  isActive: boolean;
  categoryId: string | null;
}

interface RecurringRow {
  id: string;
  account_id: string;
  transfer_account_id: string | null;
  kind: Enum<"transaction_kind">;
  amount: number;
  currency_code: string;
  payee: string | null;
  memo: string | null;
  frequency: Enum<"recurrence_frequency">;
  interval_count: number;
  starts_on: string;
  ends_on: string | null;
  next_occurrence_on: string;
  is_active: boolean;
  recurring_transaction_splits: { category_id: string }[];
}

const RECURRING_SELECT =
  "id, account_id, transfer_account_id, kind, amount, currency_code, payee, memo, frequency, interval_count, starts_on, ends_on, next_occurrence_on, is_active, recurring_transaction_splits(category_id)";

function mapRow(row: RecurringRow): RecurringTransaction {
  return {
    id: row.id,
    accountId: row.account_id,
    transferAccountId: row.transfer_account_id,
    kind: row.kind,
    amount: dbNumberToMoney(row.amount),
    currencyCode: row.currency_code,
    payee: row.payee,
    memo: row.memo,
    frequency: row.frequency,
    intervalCount: row.interval_count,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    nextOccurrenceOn: row.next_occurrence_on,
    isActive: row.is_active,
    categoryId: row.recurring_transaction_splits[0]?.category_id ?? null,
  };
}

export async function listRecurringTransactions(): Promise<
  RecurringTransaction[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_transactions")
    .select(RECURRING_SELECT)
    .order("next_occurrence_on");

  if (error) {
    throw new Error(`Failed to load recurring transactions: ${error.message}`);
  }

  return (data as RecurringRow[]).map(mapRow);
}

export async function createRecurringTransaction(
  input: CreateRecurringTransactionInput,
): Promise<RecurringTransaction> {
  const parsed = createRecurringTransactionInputSchema.parse(input);
  const supabase = await createClient();

  const { data: templateRow, error: templateError } = await supabase
    .from("recurring_transactions")
    .insert({
      account_id: parsed.accountId,
      transfer_account_id:
        parsed.kind === "transfer" ? parsed.transferAccountId : null,
      kind: parsed.kind,
      amount: moneyToDbNumber(parsed.amount),
      currency_code: parsed.currencyCode,
      payee: parsed.payee ?? null,
      memo: parsed.memo ?? null,
      frequency: parsed.frequency,
      interval_count: parsed.intervalCount,
      starts_on: parsed.startsOn,
      ends_on: parsed.endsOn ?? null,
      next_occurrence_on: parsed.startsOn,
    })
    .select("id")
    .single();

  if (templateError) {
    throw new Error(
      `Failed to create recurring transaction: ${templateError.message}`,
    );
  }

  if (parsed.kind !== "transfer" && parsed.categoryId) {
    const { error: splitError } = await supabase
      .from("recurring_transaction_splits")
      .insert({
        recurring_transaction_id: templateRow.id,
        category_id: parsed.categoryId,
        amount: moneyToDbNumber(parsed.amount),
      });

    if (splitError) {
      await supabase
        .from("recurring_transactions")
        .delete()
        .eq("id", templateRow.id);
      throw new Error(
        `Failed to create recurring transaction category: ${splitError.message}`,
      );
    }
  }

  const { data: created, error: readError } = await supabase
    .from("recurring_transactions")
    .select(RECURRING_SELECT)
    .eq("id", templateRow.id)
    .single();

  if (readError) {
    throw new Error(
      `Recurring transaction was created but could not be re-read`,
    );
  }

  return mapRow(created as RecurringRow);
}

export interface GenerateDueTransactionsResult {
  templatesProcessed: number;
  transactionsCreated: number;
}

/**
 * Generates any transactions due for every active recurring template, up
 * to and including `asOf` (defaults to today). Idempotent and catch-up
 * aware:
 *
 * - Idempotent: before inserting, checks whether a transaction already
 *   exists for (recurring_transaction_id, occurred_on). Safe to call this
 *   function repeatedly, or more than once for the same day.
 * - Catch-up: if a template hasn't been generated in a while (the app was
 *   unused for a month, say), this creates every missed occurrence, not
 *   just the most recent one — see occurrencesUpTo.
 *
 * There is currently no scheduler calling this automatically (no cron/edge
 * function is configured yet — see docs/10-deployment-and-operations.md).
 * For now it's invoked manually from the recurring transactions page.
 * Automating it is a deployment concern for a later milestone, not a
 * limitation of this function itself.
 */
export async function generateDueTransactions(
  asOf?: string,
): Promise<GenerateDueTransactionsResult> {
  const today = asOf ?? new Date().toISOString().slice(0, 10);
  const supabase = await createClient();

  const { data: templates, error: templatesError } = await supabase
    .from("recurring_transactions")
    .select(RECURRING_SELECT)
    .eq("is_active", true)
    .lte("next_occurrence_on", today);

  if (templatesError) {
    throw new Error(
      `Failed to load due recurring transactions: ${templatesError.message}`,
    );
  }

  let transactionsCreated = 0;

  for (const row of templates as RecurringRow[]) {
    const template = mapRow(row);
    const dueDates = occurrencesUpTo(
      template.startsOn,
      template.frequency,
      template.intervalCount,
      template.nextOccurrenceOn,
      today,
      template.endsOn,
    );

    let lastProcessed = template.nextOccurrenceOn;

    for (const occurredOn of dueDates) {
      const { data: existing, error: existingError } = await supabase
        .from("transactions")
        .select("id")
        .eq("recurring_transaction_id", template.id)
        .eq("occurred_on", occurredOn)
        .maybeSingle();

      if (existingError) {
        throw new Error(
          `Failed to check for existing generated transaction: ${existingError.message}`,
        );
      }

      if (existing) {
        lastProcessed = occurredOn;
        continue;
      }

      const { data: txRow, error: txError } = await supabase
        .from("transactions")
        .insert({
          account_id: template.accountId,
          transfer_account_id: template.transferAccountId,
          recurring_transaction_id: template.id,
          kind: template.kind,
          amount: moneyToDbNumber(template.amount),
          currency_code: template.currencyCode,
          occurred_on: occurredOn,
          payee: template.payee,
          memo: template.memo,
        })
        .select("id")
        .single();

      if (txError) {
        throw new Error(
          `Failed to generate transaction from recurring template: ${txError.message}`,
        );
      }

      if (template.kind !== "transfer" && template.categoryId) {
        const { error: splitError } = await supabase
          .from("transaction_splits")
          .insert({
            transaction_id: txRow.id,
            category_id: template.categoryId,
            amount: moneyToDbNumber(template.amount),
          });

        if (splitError) {
          await supabase.from("transactions").delete().eq("id", txRow.id);
          throw new Error(
            `Failed to create split for generated transaction: ${splitError.message}`,
          );
        }
      }

      transactionsCreated += 1;
      lastProcessed = occurredOn;
    }

    const nextOccurrenceOn =
      dueDates.length > 0
        ? computeNextOccurrence(
            template.startsOn,
            lastProcessed,
            template.frequency,
            template.intervalCount,
          )
        : template.nextOccurrenceOn;

    const { error: advanceError } = await supabase
      .from("recurring_transactions")
      .update({ next_occurrence_on: nextOccurrenceOn })
      .eq("id", template.id);

    if (advanceError) {
      throw new Error(
        `Failed to advance recurring template: ${advanceError.message}`,
      );
    }
  }

  return { templatesProcessed: templates.length, transactionsCreated };
}
