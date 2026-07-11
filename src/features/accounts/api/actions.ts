"use server";

import { revalidatePath } from "next/cache";

import { createAccount } from "@/services/AccountService";
import { createAccountInputSchema } from "@/features/accounts/schemas";

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
