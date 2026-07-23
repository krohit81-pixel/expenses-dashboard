"use server";

import { revalidatePath } from "next/cache";

import {
  createAtlasCategory,
  updateAtlasCategory,
} from "@/services/MerchantService";

export interface CategoryFormState {
  success?: boolean;
  error?: string;
}

function nullableString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function createAtlasCategoryAction(
  _prevState: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const categoryName = nullableString(formData, "categoryName");
  if (!categoryName) {
    return { error: "Category name can't be empty." };
  }

  try {
    await createAtlasCategory({
      categoryName,
      parentCategoryId: nullableString(formData, "parentCategoryId"),
      icon: nullableString(formData, "icon"),
    });
    revalidatePath("/categories");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create category.",
    };
  }
}

/**
 * Full-object edit, same reasoning as updateMerchantAction: every
 * field the rename form shows is always submitted, so a cleared icon
 * field means "set to null", not "leave unchanged."
 */
export async function updateAtlasCategoryAction(
  _prevState: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const categoryId = formData.get("categoryId");
  if (typeof categoryId !== "string" || !categoryId) {
    return { error: "Missing category." };
  }

  const categoryName = nullableString(formData, "categoryName");
  if (!categoryName) {
    return { error: "Category name can't be empty." };
  }

  try {
    await updateAtlasCategory({
      categoryId,
      categoryName,
      icon: nullableString(formData, "icon"),
    });
    revalidatePath("/categories");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update category.",
    };
  }
}

export async function setAtlasCategoryActiveAction(
  _prevState: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const categoryId = formData.get("categoryId");
  const active = formData.get("active");
  if (typeof categoryId !== "string" || !categoryId) {
    return { error: "Missing category." };
  }

  try {
    await updateAtlasCategory({ categoryId, active: active === "true" });
    revalidatePath("/categories");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update category.",
    };
  }
}
