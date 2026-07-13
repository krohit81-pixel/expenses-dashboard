"use server";

import { revalidatePath } from "next/cache";

import {
  createTransaction,
  markTransactionPaid,
} from "@/services/TransactionService";
import { createTransactionInputSchema } from "@/features/transactions/schemas";

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
    amount: formValue(formData, "amount"),
  };

  let raw: Record<string, unknown>;

  if (kind === "transfer") {
    raw = {
      ...base,
      kind,
      transferAccountId: formValue(formData, "transferAccountId"),
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
