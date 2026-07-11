"use server";

import { revalidatePath } from "next/cache";

import { createTransaction } from "@/services/TransactionService";
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
