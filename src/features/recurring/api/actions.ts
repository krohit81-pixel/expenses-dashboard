"use server";

import { revalidatePath } from "next/cache";

import {
  createRecurringTransaction,
  deleteRecurringTransaction,
  generateDueTransactions,
  updateRecurringTransaction,
} from "@/services/RecurringTransactionService";
import {
  createRecurringTransactionInputSchema,
  updateRecurringTransactionInputSchema,
} from "@/features/recurring/schemas";

export interface CreateRecurringFormState {
  error?: string;
}

function formValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function createRecurringTransactionAction(
  _prevState: CreateRecurringFormState,
  formData: FormData,
): Promise<CreateRecurringFormState> {
  const kind = formValue(formData, "kind");

  const base = {
    accountId: formValue(formData, "accountId"),
    currencyCode: formValue(formData, "currencyCode"),
    amount: formValue(formData, "amount"),
    payee: formValue(formData, "payee") ?? null,
    memo: formValue(formData, "memo") ?? null,
    frequency: formValue(formData, "frequency"),
    intervalCount: Number(formValue(formData, "intervalCount") ?? "1"),
    startsOn: formValue(formData, "startsOn"),
    endsOn: formValue(formData, "endsOn") ?? null,
  };

  const raw =
    kind === "transfer"
      ? {
          ...base,
          kind,
          transferAccountId: formValue(formData, "transferAccountId"),
        }
      : { ...base, kind, categoryId: formValue(formData, "categoryId") };

  const parsed = createRecurringTransactionInputSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await createRecurringTransaction(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/recurring");
  revalidatePath("/budgets");
  return {};
}

export interface GenerateDueFormState {
  message?: string;
  error?: string;
}

export async function generateDueTransactionsAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's action signature
  _prevState: GenerateDueFormState,
): Promise<GenerateDueFormState> {
  try {
    const result = await generateDueTransactions();
    revalidatePath("/recurring");
    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    revalidatePath("/accounts");
    return {
      message: `Checked ${result.templatesProcessed} template${result.templatesProcessed === 1 ? "" : "s"}, created ${result.transactionsCreated} transaction${result.transactionsCreated === 1 ? "" : "s"}.`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }
}

export interface UpdateRecurringFormState {
  error?: string;
  success?: boolean;
}

export async function updateRecurringTransactionAction(
  _prevState: UpdateRecurringFormState,
  formData: FormData,
): Promise<UpdateRecurringFormState> {
  const dayOfMonthRaw = formValue(formData, "dayOfMonth");

  const parsed = updateRecurringTransactionInputSchema.safeParse({
    id: formValue(formData, "id"),
    payee: formValue(formData, "payee"),
    amount: formValue(formData, "amount"),
    dayOfMonth: dayOfMonthRaw !== undefined ? Number(dayOfMonthRaw) : undefined,
    frequency: formValue(formData, "frequency"),
    intervalCount: Number(formValue(formData, "intervalCount") ?? "1"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await updateRecurringTransaction(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/recurring");
  revalidatePath("/budgets");
  return { success: true };
}

export interface DeleteRecurringFormState {
  error?: string;
}

export async function deleteRecurringTransactionAction(
  _prevState: DeleteRecurringFormState,
  formData: FormData,
): Promise<DeleteRecurringFormState> {
  const id = formValue(formData, "id");

  if (!id) {
    return { error: "Missing recurring transaction id" };
  }

  try {
    await deleteRecurringTransaction(id);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/recurring");
  revalidatePath("/budgets");
  return {};
}
