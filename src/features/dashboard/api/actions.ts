"use server";

import { revalidatePath } from "next/cache";

import { setCycleStartingBalance } from "@/services/CycleBalanceService";
import { zMoney } from "@/lib/money";
import { isValidMonth } from "@/lib/dates/month";

export interface SetCycleStartingBalanceFormState {
  error?: string;
  success?: boolean;
}

/**
 * v3.5.0 — the pencil-icon edit behind Dashboard's "Account Balance".
 * Deliberately narrow: just the one cycle_month + amount pair, no
 * other fields to validate. `zMoney` (not `zPositiveMoney`) on purpose
 * — a starting balance can be negative (an overdrawn position).
 */
export async function setCycleStartingBalanceAction(
  _prevState: SetCycleStartingBalanceFormState,
  formData: FormData,
): Promise<SetCycleStartingBalanceFormState> {
  const cycleMonth = formData.get("cycleMonth");
  const amountRaw = formData.get("amount");

  if (typeof cycleMonth !== "string" || !isValidMonth(cycleMonth)) {
    return { error: "Missing or invalid cycle" };
  }
  if (typeof amountRaw !== "string") {
    return { error: "Missing amount" };
  }

  const parsed = zMoney.safeParse(amountRaw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid amount" };
  }

  try {
    await setCycleStartingBalance(cycleMonth, parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/dashboard");
  return { success: true };
}
