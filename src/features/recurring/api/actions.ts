"use server";

import { revalidatePath } from "next/cache";

import {
  applyCycleTags,
  createRecurringTransaction,
  deleteRecurringTransaction,
  generateDueTransactions,
  tagRecurringToCycle,
  untagRecurringFromCycle,
  updateRecurringTransaction,
} from "@/services/RecurringTransactionService";
import {
  createRecurringTransactionInputSchema,
  updateRecurringTransactionInputSchema,
} from "@/features/recurring/schemas";
import { cycleWindowEnd, isValidMonth } from "@/lib/dates/month";

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

/**
 * v3.1.2: now scoped to whichever cycle Recurring's own month-nav is
 * showing, via a hidden `cycleMonth` field
 * (GenerateDueTransactionsButton) — it used to call
 * generateDueTransactions() with no `asOf` at all, which defaults to
 * literal today regardless of what cycle was on screen. Someone
 * browsing ahead to next cycle and clicking "Generate due
 * transactions" expected it to catch this page up to *that* cycle, not
 * whatever's due by today's real date — reported directly as "this
 * tagging should be done to the cycle selected above." `cycleWindowEnd`
 * maps the viewed cycle to the last real date inside its own window
 * (lib/dates/month.ts), so a past cycle just limits catch-up to that
 * window (safe no-op-ish) and a future cycle catches up through it.
 */
export async function generateDueTransactionsAction(
  _prevState: GenerateDueFormState,
  formData: FormData,
): Promise<GenerateDueFormState> {
  const cycleMonth = formValue(formData, "cycleMonth");
  const asOf =
    cycleMonth && isValidMonth(cycleMonth)
      ? cycleWindowEnd(cycleMonth)
      : undefined;

  try {
    const result = await generateDueTransactions(asOf);
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

export interface TagToCycleFormState {
  error?: string;
  success?: boolean;
}

export async function tagRecurringToCycleAction(
  _prevState: TagToCycleFormState,
  formData: FormData,
): Promise<TagToCycleFormState> {
  const templateId = formValue(formData, "templateId");
  const cycleMonth = formValue(formData, "cycleMonth");

  if (!templateId || !cycleMonth) {
    return { error: "Missing template or cycle month" };
  }

  try {
    await tagRecurringToCycle(templateId, cycleMonth);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/budgets");
  revalidatePath("/recurring");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  return { success: true };
}

export interface ApplyCycleTagsFormState {
  error?: string;
  message?: string;
}

/**
 * v2.1: the bulk "Apply" behind Recurring's cycle-tagging UI — see
 * applyCycleTags's own comment (RecurringTransactionService) for the
 * reconciliation logic. desiredTemplateIds/candidateTemplateIds arrive as
 * repeated same-named form fields (one hidden input per checkbox), read
 * via formData.getAll rather than formValue's single-value helper.
 */
export async function applyCycleTagsAction(
  _prevState: ApplyCycleTagsFormState,
  formData: FormData,
): Promise<ApplyCycleTagsFormState> {
  const cycleMonth = formValue(formData, "cycleMonth");
  if (!cycleMonth) {
    return { error: "Missing cycle month" };
  }

  const desiredTemplateIds = formData.getAll("desiredTemplateIds").map(String);
  const candidateTemplateIds = formData
    .getAll("candidateTemplateIds")
    .map(String);

  try {
    const result = await applyCycleTags({
      cycleMonth,
      desiredTemplateIds,
      candidateTemplateIds,
    });
    revalidatePath("/recurring");
    revalidatePath("/log");
    revalidatePath("/dashboard");
    revalidatePath("/budgets");
    revalidatePath("/transactions");

    const parts: string[] = [];
    if (result.tagged > 0) parts.push(`tagged ${result.tagged}`);
    if (result.untagged > 0) parts.push(`untagged ${result.untagged}`);
    return {
      message: parts.length > 0 ? parts.join(", ") + "." : "No changes.",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }
}

export interface UntagCycleFormState {
  error?: string;
  success?: boolean;
}

export async function untagRecurringFromCycleAction(
  _prevState: UntagCycleFormState,
  formData: FormData,
): Promise<UntagCycleFormState> {
  const transactionId = formValue(formData, "transactionId");
  if (!transactionId) {
    return { error: "Missing transaction id" };
  }

  try {
    await untagRecurringFromCycle(transactionId);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/recurring");
  revalidatePath("/log");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
  revalidatePath("/transactions");
  return { success: true };
}
