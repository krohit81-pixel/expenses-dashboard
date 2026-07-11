"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createBudgetAction,
  type CreateBudgetFormState,
} from "@/features/budgets/api/actions";

const initialState: CreateBudgetFormState = {};

function firstAndLastDayOfCurrentMonth(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  );
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function CreateBudgetForm({
  defaultCurrency,
}: {
  defaultCurrency: string;
}) {
  const [state, formAction, isPending] = useActionState(
    createBudgetAction,
    initialState,
  );
  const { start, end } = firstAndLastDayOfCurrentMonth();

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          placeholder="e.g. June 2026"
          required
          maxLength={200}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="currencyCode">Currency</Label>
          <Input
            id="currencyCode"
            name="currencyCode"
            defaultValue={defaultCurrency}
            maxLength={3}
            required
            className="uppercase"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="periodStart">Start</Label>
          <Input
            id="periodStart"
            name="periodStart"
            type="date"
            defaultValue={start}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="periodEnd">End</Label>
          <Input
            id="periodEnd"
            name="periodEnd"
            type="date"
            defaultValue={end}
            required
          />
        </div>
      </div>

      <FieldError message={state.error} />

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create budget"}
      </Button>
    </form>
  );
}
