"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createBudget, setBudgetLine } from "@/services/BudgetService";
import {
  createBudgetInputSchema,
  setBudgetLineInputSchema,
} from "@/features/budgets/schemas";

export interface CreateBudgetFormState {
  error?: string;
}

export async function createBudgetAction(
  _prevState: CreateBudgetFormState,
  formData: FormData,
): Promise<CreateBudgetFormState> {
  const parsed = createBudgetInputSchema.safeParse({
    name: formData.get("name"),
    currencyCode: formData.get("currencyCode"),
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let budgetId: string;
  try {
    const budget = await createBudget(parsed.data);
    budgetId = budget.id;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/budgets");
  redirect(`/budgets/${budgetId}`);
}

export interface SetBudgetLineFormState {
  error?: string;
}

export async function setBudgetLineAction(
  _prevState: SetBudgetLineFormState,
  formData: FormData,
): Promise<SetBudgetLineFormState> {
  const budgetId = String(formData.get("budgetId") ?? "");

  const parsed = setBudgetLineInputSchema.safeParse({
    budgetId,
    categoryId: formData.get("categoryId"),
    plannedAmount: formData.get("plannedAmount"),
    rolloverEnabled: formData.get("rolloverEnabled") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await setBudgetLine(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath(`/budgets/${budgetId}`);
  return {};
}
