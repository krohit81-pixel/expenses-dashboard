"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { AtlasCategory } from "@/services/MerchantService";
import {
  createAtlasCategoryAction,
  type CategoryFormState,
} from "@/features/categories/api/actions";

const initialState: CategoryFormState = {};

/** Adds a new top-level category or subcategory -- v1.2 Categories admin screen. */
export function AddCategoryForm({
  topLevelCategories,
}: {
  topLevelCategories: AtlasCategory[];
}) {
  const [state, action, isPending] = useActionState(
    createAtlasCategoryAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={action}
      className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
    >
      <div className="space-y-1.5">
        <Label htmlFor="new-category-name">Category name</Label>
        <Input
          id="new-category-name"
          name="categoryName"
          placeholder="e.g. Groceries & Food Delivery"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-category-parent">Parent (optional)</Label>
        <Select
          id="new-category-parent"
          name="parentCategoryId"
          defaultValue=""
        >
          <option value="">Top-level category</option>
          {topLevelCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.categoryName}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" className="self-end" loading={isPending}>
        Add category
      </Button>
      {state.error && (
        <p className="text-xs text-negative sm:col-span-3">{state.error}</p>
      )}
    </form>
  );
}
