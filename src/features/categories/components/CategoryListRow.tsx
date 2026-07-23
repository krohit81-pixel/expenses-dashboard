"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AtlasCategory } from "@/services/MerchantService";
import {
  setAtlasCategoryActiveAction,
  updateAtlasCategoryAction,
  type CategoryFormState,
} from "@/features/categories/api/actions";

const initialState: CategoryFormState = {};

/**
 * One row in the Categories admin screen (v1.2) -- rename in place
 * (e.g. "Groceries" -> "Groceries & Food Delivery", the household's own
 * example) plus an activate/deactivate toggle, same edit-in-place
 * pattern as MerchantListRow. isSubcategory only controls indentation;
 * the page decides nesting by walking AtlasCategory.parentCategoryId,
 * this component doesn't know or care about hierarchy itself.
 */
export function CategoryListRow({
  category,
  isSubcategory,
}: {
  category: AtlasCategory;
  isSubcategory: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [updateState, updateAction, isUpdatePending] = useActionState(
    updateAtlasCategoryAction,
    initialState,
  );
  const [activeState, activeAction, isActivePending] = useActionState(
    setAtlasCategoryActiveAction,
    initialState,
  );

  useEffect(() => {
    if (updateState.success) setEditing(false);
  }, [updateState.success]);

  if (editing) {
    return (
      <li
        className={`border-b border-line px-[18px] py-3 last:border-b-0 ${isSubcategory ? "pl-9" : ""}`}
      >
        <form action={updateAction} className="flex items-center gap-2">
          <input type="hidden" name="categoryId" value={category.id} />
          <Input
            name="categoryName"
            defaultValue={category.categoryName}
            className="h-9"
          />
          <input type="hidden" name="icon" value={category.icon ?? ""} />
          <Button type="submit" size="sm" loading={isUpdatePending}>
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        </form>
        {updateState.error && (
          <p className="mt-1 text-xs text-negative">{updateState.error}</p>
        )}
      </li>
    );
  }

  return (
    <li
      className={`flex items-center justify-between gap-3 border-b border-line px-[18px] py-3 last:border-b-0 ${isSubcategory ? "pl-9" : ""}`}
    >
      <div className="min-w-0">
        <span
          className={`truncate text-sm ${isSubcategory ? "text-ink-soft" : "font-semibold text-ink"}`}
        >
          {isSubcategory ? "› " : ""}
          {category.categoryName}
        </span>
        {!category.active && (
          <span className="ml-2 text-xs font-semibold text-negative">
            Deactivated
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing(true)}
        >
          Rename
        </Button>
        <form action={activeAction}>
          <input type="hidden" name="categoryId" value={category.id} />
          <input
            type="hidden"
            name="active"
            value={category.active ? "false" : "true"}
          />
          <Button
            type="submit"
            variant={category.active ? "destructive" : "outline"}
            size="sm"
            loading={isActivePending}
          >
            {category.active ? "Deactivate" : "Reactivate"}
          </Button>
        </form>
      </div>
      {activeState.error && (
        <p className="text-xs text-negative">{activeState.error}</p>
      )}
    </li>
  );
}
