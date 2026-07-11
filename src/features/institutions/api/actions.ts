"use server";

import { revalidatePath } from "next/cache";

import { createInstitution } from "@/services/InstitutionService";
import { createInstitutionInputSchema } from "@/features/institutions/schemas";

export interface CreateInstitutionFormState {
  error?: string;
}

export async function createInstitutionAction(
  _prevState: CreateInstitutionFormState,
  formData: FormData,
): Promise<CreateInstitutionFormState> {
  const parsed = createInstitutionInputSchema.safeParse({
    name: formData.get("name"),
    website: formData.get("website") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await createInstitution(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/accounts");
  return {};
}
