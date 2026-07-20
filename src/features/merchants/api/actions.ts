"use server";

import { revalidatePath } from "next/cache";

import { mergeMerchants, updateMerchant } from "@/services/MerchantService";

export interface MerchantFormState {
  success?: boolean;
  error?: string;
}

function nullableString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Full-object edit: category, subcategory, display name, merchant type,
 * recurring/subscription flags — every field the form shows is always
 * submitted, so there's no partial-patch ambiguity to handle here (a
 * cleared dropdown means "set to null", not "leave unchanged").
 */
export async function updateMerchantAction(
  _prevState: MerchantFormState,
  formData: FormData,
): Promise<MerchantFormState> {
  const merchantId = formData.get("merchantId");
  if (typeof merchantId !== "string" || !merchantId) {
    return { error: "Missing merchant." };
  }

  const displayName = nullableString(formData, "displayName");
  if (!displayName) {
    return { error: "Display name can't be empty." };
  }

  try {
    await updateMerchant({
      merchantId,
      displayName,
      atlasCategoryId: nullableString(formData, "atlasCategoryId"),
      atlasSubcategoryId: nullableString(formData, "atlasSubcategoryId"),
      merchantType: nullableString(formData, "merchantType"),
      isRecurring: formData.get("isRecurring") === "on",
      isSubscription: formData.get("isSubscription") === "on",
    });
    revalidatePath("/merchants");
    revalidatePath(`/merchants/${merchantId}`);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update merchant.",
    };
  }
}

export async function setMerchantActiveAction(
  _prevState: MerchantFormState,
  formData: FormData,
): Promise<MerchantFormState> {
  const merchantId = formData.get("merchantId");
  const active = formData.get("active");
  if (typeof merchantId !== "string" || !merchantId) {
    return { error: "Missing merchant." };
  }

  try {
    await updateMerchant({ merchantId, active: active === "true" });
    revalidatePath("/merchants");
    revalidatePath(`/merchants/${merchantId}`);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update merchant.",
    };
  }
}

export async function mergeMerchantsAction(
  _prevState: MerchantFormState,
  formData: FormData,
): Promise<MerchantFormState> {
  const sourceMerchantId = formData.get("sourceMerchantId");
  const targetMerchantId = formData.get("targetMerchantId");

  if (typeof sourceMerchantId !== "string" || !sourceMerchantId) {
    return { error: "Missing merchant." };
  }
  if (typeof targetMerchantId !== "string" || !targetMerchantId) {
    return { error: "Choose a merchant to merge into." };
  }

  try {
    await mergeMerchants({ sourceMerchantId, targetMerchantId });
    revalidatePath("/merchants");
    revalidatePath(`/merchants/${sourceMerchantId}`);
    revalidatePath(`/merchants/${targetMerchantId}`);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to merge merchants.",
    };
  }
}
