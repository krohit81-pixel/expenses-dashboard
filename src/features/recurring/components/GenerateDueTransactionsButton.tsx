"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  generateDueTransactionsAction,
  type GenerateDueFormState,
} from "@/features/recurring/api/actions";

const initialState: GenerateDueFormState = {};

export function GenerateDueTransactionsButton() {
  const [state, formAction, isPending] = useActionState(
    generateDueTransactionsAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex items-center gap-3">
      <Button type="submit" variant="outline" loading={isPending}>
        Generate due transactions
      </Button>
      {state.message && (
        <p className="text-sm text-muted-foreground">{state.message}</p>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
