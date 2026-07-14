import "server-only";

import { dbNumberToMoney, moneyToDbNumber, type Money } from "@/lib/money";
import {
  computeNextOccurrence,
  occurrencesUpTo,
  setDayOfMonth,
} from "@/lib/dates/recurrence";
import { createServiceClient } from "@/lib/supabase/service";
import { OWNER_USER_ID } from "@/lib/owner";
import type { Enum } from "@/lib/db/helpers";
import {
  createRecurringTransactionInputSchema,
  updateRecurringTransactionInputSchema,
  type CreateRecurringTransactionInput,
  type UpdateRecurringTransactionInput,
} from "@/features/recurring/schemas";

export type {
  CreateRecurringTransactionInput,
  UpdateRecurringTransactionInput,
};

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
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("recurring_transactions")
    .select(RECURRING_SELECT)
    .eq("user_id", OWNER_USER_ID)
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
  const supabase = createServiceClient();

  const { data: templateRow, error: templateError } = await supabase
    .from("recurring_transactions")
    .insert({
      user_id: OWNER_USER_ID,
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
        user_id: OWNER_USER_ID,
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

/**
 * Updates a template's name, amount, and day-of-month — see the narrow
 * scope note on updateRecurringTransactionInputSchema. Updates the
 * matching recurring_transaction_splits row's amount too (for income/
 * expense templates), since a single-category template's split amount
 * must always equal the parent amount, same invariant as at creation.
 * Only moves next_occurrence_on's day, not starts_on's — starts_on stays
 * the original anchor for month-end clamping (see docs/lib/dates/
 * recurrence.ts); this is a deliberate simplification, not an oversight.
 */
export async function updateRecurringTransaction(
  input: UpdateRecurringTransactionInput,
): Promise<RecurringTransaction> {
  const parsed = updateRecurringTransactionInputSchema.parse(input);
  const supabase = createServiceClient();

  const { data: existing, error: readError } = await supabase
    .from("recurring_transactions")
    .select("next_occurrence_on, kind")
    .eq("id", parsed.id)
    .eq("user_id", OWNER_USER_ID)
    .single();

  if (readError) {
    throw new Error(`Recurring transaction not found: ${readError.message}`);
  }

  const nextOccurrenceOn =
    parsed.dayOfMonth !== undefined
      ? setDayOfMonth(existing.next_occurrence_on, parsed.dayOfMonth)
      : existing.next_occurrence_on;

  const { error: updateError } = await supabase
    .from("recurring_transactions")
    .update({
      payee: parsed.payee,
      amount: moneyToDbNumber(parsed.amount),
      next_occurrence_on: nextOccurrenceOn,
      frequency: parsed.frequency,
      interval_count: parsed.intervalCount,
    })
    .eq("id", parsed.id)
    .eq("user_id", OWNER_USER_ID);

  if (updateError) {
    throw new Error(
      `Failed to update recurring transaction: ${updateError.message}`,
    );
  }

  if (existing.kind !== "transfer") {
    const { error: splitError } = await supabase
      .from("recurring_transaction_splits")
      .update({ amount: moneyToDbNumber(parsed.amount) })
      .eq("recurring_transaction_id", parsed.id)
      .eq("user_id", OWNER_USER_ID);

    if (splitError) {
      throw new Error(
        `Failed to update recurring transaction category amount: ${splitError.message}`,
      );
    }
  }

  const { data: updated, error: reReadError } = await supabase
    .from("recurring_transactions")
    .select(RECURRING_SELECT)
    .eq("id", parsed.id)
    .single();

  if (reReadError) {
    throw new Error(
      `Recurring transaction was updated but could not be re-read`,
    );
  }

  return mapRow(updated as RecurringRow);
}

/**
 * Deletes a recurring template entirely. Deletes its
 * recurring_transaction_splits row first explicitly — safe whether or not
 * a DB-level cascade exists for this FK, and doesn't depend on knowing
 * which one is actually configured. Does NOT touch transactions already
 * generated from this template in the past; those stand on their own.
 */
export async function deleteRecurringTransaction(id: string): Promise<void> {
  const supabase = createServiceClient();

  const { error: splitError } = await supabase
    .from("recurring_transaction_splits")
    .delete()
    .eq("recurring_transaction_id", id)
    .eq("user_id", OWNER_USER_ID);

  if (splitError) {
    throw new Error(
      `Failed to delete recurring transaction category: ${splitError.message}`,
    );
  }

  const { error: deleteError } = await supabase
    .from("recurring_transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", OWNER_USER_ID);

  if (deleteError) {
    throw new Error(
      `Failed to delete recurring transaction: ${deleteError.message}`,
    );
  }
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
  const supabase = createServiceClient();

  const { data: templates, error: templatesError } = await supabase
    .from("recurring_transactions")
    .select(RECURRING_SELECT)
    .eq("user_id", OWNER_USER_ID)
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
        .eq("user_id", OWNER_USER_ID)
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
          user_id: OWNER_USER_ID,
          account_id: template.accountId,
          transfer_account_id: template.transferAccountId,
          recurring_transaction_id: template.id,
          kind: template.kind,
          amount: moneyToDbNumber(template.amount),
          currency_code: template.currencyCode,
          occurred_on: occurredOn,
          payee: template.payee,
          memo: template.memo,
          cycle_month: occurredOn.slice(0, 7),
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
            user_id: OWNER_USER_ID,
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
      .eq("id", template.id)
      .eq("user_id", OWNER_USER_ID);

    if (advanceError) {
      throw new Error(
        `Failed to advance recurring template: ${advanceError.message}`,
      );
    }
  }

  return { templatesProcessed: templates.length, transactionsCreated };
}

/**
 * Creates a real transaction from a template's defaults, tagged to a
 * specific cycle month — the actual mechanism behind "tag to cycle" on
 * the Recurring page. Distinct from generateDueTransactions: that one is
 * date-driven (catches up whatever's actually due by today); this one is
 * user-driven (tag August's rent now, on 15 July, regardless of when it
 * would naturally next occur). Deliberately not a query against
 * next_occurrence_on — the whole point is decoupling "which month this
 * counts toward" from "when it would naturally recur."
 *
 * Defaults occurred_on to the 1st of the target month — a placeholder,
 * not a claim about the real due date; edit it afterward via the
 * transaction edit UI once the actual date is known (e.g. once a card
 * statement arrives). Status is always "pending": tagging something
 * doesn't mean it's been paid, just that it's now counted.
 *
 * Duplicates generateDueTransactions' insert + split logic rather than
 * sharing it — the two functions differ enough in how they pick dates
 * and loop (or don't) that extracting a shared helper felt like more
 * risk to the tested, working catch-up path than the small duplication
 * here was worth.
 */
export async function tagRecurringToCycle(
  templateId: string,
  cycleMonth: string,
): Promise<{ transactionId: string }> {
  if (!/^\d{4}-\d{2}$/.test(cycleMonth)) {
    throw new Error("cycleMonth must be in YYYY-MM format");
  }

  const templates = await listRecurringTransactions();
  const template = templates.find((t) => t.id === templateId);
  if (!template) {
    throw new Error("Recurring template not found");
  }
  if (template.kind === "transfer") {
    throw new Error("Transfers aren't tagged to a cycle this way yet");
  }

  const supabase = createServiceClient();
  const occurredOn = `${cycleMonth}-01`;

  const { data: txRow, error: txError } = await supabase
    .from("transactions")
    .insert({
      user_id: OWNER_USER_ID,
      account_id: template.accountId,
      transfer_account_id: null,
      recurring_transaction_id: template.id,
      kind: template.kind,
      status: "pending",
      amount: moneyToDbNumber(template.amount),
      currency_code: template.currencyCode,
      occurred_on: occurredOn,
      payee: template.payee,
      memo: template.memo,
      cycle_month: cycleMonth,
    })
    .select("id")
    .single();

  if (txError) {
    throw new Error(
      `Failed to tag recurring template to cycle: ${txError.message}`,
    );
  }

  if (template.categoryId) {
    const { error: splitError } = await supabase
      .from("transaction_splits")
      .insert({
        user_id: OWNER_USER_ID,
        transaction_id: txRow.id,
        category_id: template.categoryId,
        amount: moneyToDbNumber(template.amount),
      });

    if (splitError) {
      await supabase.from("transactions").delete().eq("id", txRow.id);
      throw new Error(
        `Failed to create split for tagged transaction: ${splitError.message}`,
      );
    }
  }

  return { transactionId: txRow.id as string };
}
