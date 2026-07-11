"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { completeOnboarding } from "@/services/UserSettingsService";
import { seedDefaultCategories } from "@/services/CategoryService";
import { userSettingsInputSchema } from "@/features/onboarding/schemas";

export interface OnboardingFormState {
  error?: string;
}

export async function submitOnboarding(
  _prevState: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
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
    await seedDefaultCategories();
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  redirect("/dashboard");
}
