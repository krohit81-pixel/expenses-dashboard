"use server";

import { revalidatePath } from "next/cache";

import {
  createTransaction,
  listTransactions,
  markTransactionPaid,
  markTransactionPending,
  updateTransaction,
  voidTransaction,
} from "@/services/TransactionService";
import {
  createTransactionInputSchema,
  updateTransactionInputSchema,
} from "@/features/transactions/schemas";
import { shiftMonth } from "@/lib/dates/month";

export interface CreateTransactionFormState {
  error?: string;
}

function formValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function createTransactionAction(
  _prevState: CreateTransactionFormState,
  formData: FormData,
): Promise<CreateTransactionFormState> {
  const kind = formValue(formData, "kind");
  const mode = formValue(formData, "mode") ?? "single";

  const base = {
    accountId: formValue(formData, "accountId"),
    currencyCode: formValue(formData, "currencyCode"),
    occurredOn: formValue(formData, "occurredOn"),
    payee: formValue(formData, "payee") ?? null,
    memo: formValue(formData, "memo") ?? null,
    cycleMonth: formValue(formData, "cycleMonth"),
    amount: formValue(formData, "amount"),
  };

  let raw: Record<string, unknown>;

  if (kind === "transfer") {
    raw = {
      ...base,
      kind,
      transferAccountId: formValue(formData, "transferAccountId"),
      // v1.1.4: a transfer entered here represents money the person is
      // recording as already moved between their own accounts right
      // now — unlike logCardPaymentAction's deliberately-pending
      // scheduled payments (a future due date, confirmed later),
      // there's no "not yet happened" step to this form's transfers, so
      // defaulting to pending just added an extra "mark paid" tap
      // before the balance reflected what the person just told the app
      // was true. Forced to posted, overriding the schema's
      // pending-by-default (which still applies to income/expense from
      // this same form — this override is transfer-only).
      status: "posted" as const,
    };
  } else if (mode === "split") {
    const categoryIds = formData.getAll("splitCategoryId");
    const amounts = formData.getAll("splitAmount");
    const splits = categoryIds.map((categoryId, index) => ({
      categoryId,
      amount: amounts[index],
    }));
    raw = { ...base, kind, splits };
  } else {
    raw = { ...base, kind, categoryId: formValue(formData, "categoryId") };
  }

  const parsed = createTransactionInputSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await createTransaction(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  return {};
}

export interface LogCardPaymentFormState {
  error?: string;
  success?: boolean;
}

/**
 * Records a card payment as a single pending transfer (checking → card),
 * dated for when the payment will actually happen. Deliberately simple:
 * this does NOT also record an expense representing the statement total,
 * so a card's balance in Current Balances reflects transfers logged
 * against it, not the real-time statement debt — since itemized card
 * spending isn't tracked yet (no PDF import), there's no other signal to
 * set that debt from. Revisit once imports exist: the more complete model
 * is an expense (statement total, dated the statement day) plus this
 * transfer (the payment, dated the due date) as two linked entries.
 */
export async function logCardPaymentAction(
  _prevState: LogCardPaymentFormState,
  formData: FormData,
): Promise<LogCardPaymentFormState> {
  const raw = {
    kind: "transfer" as const,
    accountId: formValue(formData, "fromAccountId"),
    transferAccountId: formValue(formData, "cardAccountId"),
    amount: formValue(formData, "amount"),
    currencyCode: formValue(formData, "currencyCode"),
    occurredOn: formValue(formData, "payOn"),
    memo: formValue(formData, "memo"),
    cycleMonth: formValue(formData, "cycleMonth"),
    status: "pending" as const,
  };

  const parsed = createTransactionInputSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await createTransaction(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  return { success: true };
}

export interface MarkPaidFormState {
  error?: string;
}

/**
 * Flips a scheduled (pending) transaction to posted — the missing piece
 * that caused real confusion: logging a card payment via "Log a card
 * payment" correctly doesn't touch the account balance yet (it's a
 * future-dated, not-yet-happened payment), but there was no way to
 * confirm it actually happened afterward, so the balance never updated
 * and looked broken rather than just "not paid yet."
 */
export async function markTransactionPaidAction(
  _prevState: MarkPaidFormState,
  formData: FormData,
): Promise<MarkPaidFormState> {
  const id = formValue(formData, "id");

  if (!id) {
    return { error: "Missing transaction id" };
  }

  try {
    await markTransactionPaid(id);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  return {};
}

export async function markTransactionPendingAction(
  _prevState: MarkPaidFormState,
  formData: FormData,
): Promise<MarkPaidFormState> {
  const id = formValue(formData, "id");

  if (!id) {
    return { error: "Missing transaction id" };
  }

  try {
    await markTransactionPending(id);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  return {};
}

export interface UpdateTransactionFormState {
  error?: string;
  success?: boolean;
}

export async function updateTransactionAction(
  _prevState: UpdateTransactionFormState,
  formData: FormData,
): Promise<UpdateTransactionFormState> {
  const cycleMonthRaw = formValue(formData, "cycleMonth");
  const cycleMonth =
    cycleMonthRaw === "untagged" ? null : (cycleMonthRaw ?? undefined);

  const parsed = updateTransactionInputSchema.safeParse({
    id: formValue(formData, "id"),
    amount: formValue(formData, "amount"),
    occurredOn: formValue(formData, "occurredOn"),
    memo: formValue(formData, "memo") ?? null,
    cycleMonth,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await updateTransaction(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  return { success: true };
}

export interface VoidTransactionFormState {
  error?: string;
}

/**
 * Removes a transaction from view — a real request, not a workaround:
 * "I need to remove that income if incorrectly added." Soft-delete
 * (status: 'void') rather than a hard DB delete — voidTransaction
 * already existed for this, just never had UI wired to it.
 *
 * v1.1.3 fix: voiding a transaction used to leave it visible on the
 * Transactions page's own Recent list, even though it correctly
 * disappeared from Home/Budgets — those two already filtered void rows
 * out themselves after fetching, but listTransactions() itself (what
 * the Recent list calls, with no status filter at all) had no such
 * exclusion, so a voided row came right back on the next render. Fixed
 * at the source: listTransactions() now excludes status "void" by
 * default for every caller, unless a filter explicitly asks for a
 * specific status (or opts in via includeVoid) — see TransactionFilters
 * in TransactionService.ts.
 */
export async function voidTransactionAction(
  _prevState: VoidTransactionFormState,
  formData: FormData,
): Promise<VoidTransactionFormState> {
  const id = formValue(formData, "id");

  if (!id) {
    return { error: "Missing transaction id" };
  }

  try {
    await voidTransaction(id);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  return {};
}

export interface RepeatLastCycleFormState {
  error?: string;
  success?: boolean;
  copiedCount?: number;
}

/**
 * v3.4.14 — the "Repeat last cycle" button's action, Recurring's
 * replacement. Duplicates every live (non-void), non-transfer
 * transaction tagged to the cycle immediately before `targetMonth`
 * into `targetMonth` itself — plain, ordinary transactions, no
 * template concept involved. Copies land dated today (not the
 * original occurredOn — this represents "happening again this cycle,"
 * and keeping last cycle's literal dates would misdate everything by
 * a month) and always `status: "pending"` (mirrors
 * logCardPaymentAction's own reasoning: a freshly duplicated line
 * hasn't actually happened yet at the moment of duplication — the
 * household reviews/mark-paids each one via TransactionRow's existing
 * controls, same as any other pending row, rather than it silently
 * posting against balances).
 *
 * v3.5.2 — transfers (card-due payments) are excluded from what gets
 * copied. Household request: last cycle's card payment amount is
 * whatever that statement happened to total; blindly duplicating it
 * forward would just be a wrong number sitting in the new cycle until
 * overwritten. The real amount for this cycle comes from the PDF
 * statement import flow instead (LogCardDuePrompt), same "card dues
 * are logged via statement imports instead" exclusion Recurring's own
 * templates used to apply before Recurring was removed entirely — see
 * that page's old comment in git history.
 *
 * Sequential, not Promise.all — same "known, reportable partial state on
 * failure" reasoning ReminderService.sendCandidates and the old
 * (now-deleted) applyCycleTags used: if one copy fails partway through,
 * the household sees exactly how many succeeded rather than an
 * all-or-nothing rollback or a silently incomplete batch.
 */
export async function repeatLastCycleAction(
  _prevState: RepeatLastCycleFormState,
  formData: FormData,
): Promise<RepeatLastCycleFormState> {
  const targetMonth = formValue(formData, "targetMonth");
  if (!targetMonth) {
    return { error: "Missing target cycle" };
  }

  const sourceMonth = shiftMonth(targetMonth, -1);
  const { transactions } = await listTransactions({
    cycleMonth: sourceMonth,
    limit: 300,
  });
  const live = transactions.filter(
    (t) => t.status !== "void" && t.kind !== "transfer",
  );
  const today = new Date().toISOString().slice(0, 10);

  let copiedCount = 0;
  for (const t of live) {
    // Only income/expense reach here now — transfers are filtered out
    // of `live` above, so there's no transfer branch to build here
    // (unlike createTransactionAction's own raw-building, which still
    // needs one for its own, unfiltered callers).
    const base = {
      accountId: t.accountId,
      currencyCode: t.currencyCode,
      occurredOn: today,
      payee: t.payee,
      memo: t.memo,
      cycleMonth: targetMonth,
      amount: t.amount,
    };
    const raw =
      t.splits.length > 1
        ? {
            ...base,
            kind: t.kind,
            status: "pending" as const,
            splits: t.splits.map((s) => ({
              categoryId: s.categoryId,
              amount: s.amount,
              memo: s.memo,
            })),
          }
        : {
            ...base,
            kind: t.kind,
            status: "pending" as const,
            categoryId: t.splits[0]?.categoryId,
          };

    const parsed = createTransactionInputSchema.safeParse(raw);
    if (!parsed.success) break; // stop and report partial progress rather than a silent partial batch

    try {
      await createTransaction(parsed.data);
      copiedCount++;
    } catch {
      break;
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/accounts");

  if (copiedCount === live.length) {
    return { success: true, copiedCount };
  }
  return {
    error: `Copied ${copiedCount} of ${live.length} before stopping.`,
    copiedCount,
  };
}
