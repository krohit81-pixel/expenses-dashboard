"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/require-user";
import { completeOnboarding } from "@/services/UserSettingsService";
import { userSettingsInputSchema } from "@/features/onboarding/schemas";

export interface UpdateSettingsFormState {
  error?: string;
  success?: boolean;
}

export async function updateSettingsAction(
  _prevState: UpdateSettingsFormState,
  formData: FormData,
): Promise<UpdateSettingsFormState> {
  const user = await requireUser();

  const parsed = userSettingsInputSchema.safeParse({
    baseCurrency: formData.get("baseCurrency"),
    timezone: formData.get("timezone"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await completeOnboarding(user.id, parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/settings");
  return { success: true };
}
