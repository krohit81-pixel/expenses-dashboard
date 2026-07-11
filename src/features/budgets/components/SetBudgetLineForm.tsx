"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  setBudgetLineAction,
  type SetBudgetLineFormState,
} from "@/features/budgets/api/actions";
import type { Category } from "@/services/CategoryService";

const initialState: SetBudgetLineFormState = {};

export function SetBudgetLineForm({
  budgetId,
  categories,
}: {
  budgetId: string;
  categories: Category[];
}) {
  const [state, formAction, isPending] = useActionState(
    setBudgetLineAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex items-end gap-3">
      <input type="hidden" name="budgetId" value={budgetId} />
      <div className="space-y-2">
        <Label htmlFor="categoryId">Category</Label>
        <Select id="categoryId" name="categoryId" required className="w-56">
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="plannedAmount">Planned amount</Label>
        <Input
          id="plannedAmount"
          name="plannedAmount"
          inputMode="decimal"
          placeholder="0.00"
          required
        />
      </div>
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Saving…" : "Set"}
      </Button>
      <FieldError message={state.error} />
    </form>
  );
}
