"use server";

import { revalidatePath } from "next/cache";

import {
  createAccount,
  correctAccountBalance,
} from "@/services/AccountService";
import { createAccountInputSchema } from "@/features/accounts/schemas";
import { zMoney } from "@/lib/money";

export interface CreateAccountFormState {
  error?: string;
}

function formValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function createAccountAction(
  _prevState: CreateAccountFormState,
  formData: FormData,
): Promise<CreateAccountFormState> {
  const accountType = formValue(formData, "accountType");

  const raw = {
    accountType,
    institutionId: formValue(formData, "institutionId") ?? null,
    name: formValue(formData, "name"),
    currencyCode: formValue(formData, "currencyCode"),
    openingBalance: formValue(formData, "openingBalance") ?? "0.00",
    openingBalanceDate: formValue(formData, "openingBalanceDate") ?? null,
    ...(accountType === "credit_card"
      ? {
          creditLimit: formValue(formData, "creditLimit") ?? null,
          statementDay: formValue(formData, "statementDay")
            ? Number(formValue(formData, "statementDay"))
            : null,
          paymentDueDay: formValue(formData, "paymentDueDay")
            ? Number(formValue(formData, "paymentDueDay"))
            : null,
          annualPercentageRate: formValue(formData, "annualPercentageRate")
            ? Number(formValue(formData, "annualPercentageRate"))
            : null,
        }
      : {}),
  };

  const parsed = createAccountInputSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await createAccount(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/accounts");
  return {};
}

export interface CorrectAccountBalanceFormState {
  error?: string;
  success?: boolean;
  /** Set on success so the panel can show what it logged without a full page reload. */
  delta?: string;
}

export async function correctAccountBalanceAction(
  _prevState: CorrectAccountBalanceFormState,
  formData: FormData,
): Promise<CorrectAccountBalanceFormState> {
  const accountId = formValue(formData, "accountId");
  const actualBalanceRaw = formValue(formData, "actualBalance");

  if (!accountId || !actualBalanceRaw) {
    return { error: "Missing account or balance" };
  }

  const parsedBalance = zMoney.safeParse(actualBalanceRaw);
  if (!parsedBalance.success) {
    return {
      error: parsedBalance.error.issues[0]?.message ?? "Invalid amount",
    };
  }

  try {
    const result = await correctAccountBalance(accountId, parsedBalance.data);
    revalidatePath("/accounts");
    revalidatePath("/log");
    revalidatePath("/transactions");
    return { success: true, delta: result.delta };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }
}
