"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  generateDueTransactionsAction,
  type GenerateDueFormState,
} from "@/features/recurring/api/actions";

const initialState: GenerateDueFormState = {};

/**
 * v3.1.2: gained a `cycleMonth` prop, submitted as a hidden field, so
 * the action can scope catch-up to whichever cycle Recurring's own
 * month-nav is showing rather than always literal today — see
 * generateDueTransactionsAction's own comment for the bug this fixes.
 */
export function GenerateDueTransactionsButton({
  cycleMonth,
}: {
  cycleMonth: string;
}) {
  const [state, formAction, isPending] = useActionState(
    generateDueTransactionsAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="cycleMonth" value={cycleMonth} />
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
