"use server";

import { revalidatePath } from "next/cache";

import { createAsset } from "@/services/AssetService";
import { createLiability } from "@/services/LiabilityService";
import {
  createAssetInputSchema,
  createLiabilityInputSchema,
} from "@/features/net-worth/schemas";

export interface CreateAssetFormState {
  error?: string;
}

export async function createAssetAction(
  _prevState: CreateAssetFormState,
  formData: FormData,
): Promise<CreateAssetFormState> {
  const parsed = createAssetInputSchema.safeParse({
    assetType: formData.get("assetType"),
    name: formData.get("name"),
    acquiredOn: formData.get("acquiredOn") || null,
    acquisitionCost: formData.get("acquisitionCost") || null,
    currencyCode: formData.get("currencyCode"),
    notes: formData.get("notes") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await createAsset(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/net-worth");
  return {};
}

export interface CreateLiabilityFormState {
  error?: string;
}

export async function createLiabilityAction(
  _prevState: CreateLiabilityFormState,
  formData: FormData,
): Promise<CreateLiabilityFormState> {
  const parsed = createLiabilityInputSchema.safeParse({
    liabilityType: formData.get("liabilityType"),
    name: formData.get("name"),
    originalAmount: formData.get("originalAmount") || null,
    interestRate: formData.get("interestRate")
      ? Number(formData.get("interestRate"))
      : null,
    currencyCode: formData.get("currencyCode"),
    dueOn: formData.get("dueOn") || null,
    notes: formData.get("notes") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await createLiability(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/net-worth");
  return {};
}
