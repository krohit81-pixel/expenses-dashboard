"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  runAhaanaWeeklyReportAction,
  type RunAhaanaWeeklyReportFormState,
} from "@/features/notifications/api/actions";

const initialState: RunAhaanaWeeklyReportFormState = {};

/**
 * v3.4.0 Phase 3 — manual trigger for Ahaana's weekly parent report,
 * same role RunRemindersButton plays for the day-based reminders: lets
 * the whole detect -> dedupe -> send pipeline be proven on demand
 * rather than only ever firing on Sunday's scheduled tick.
 */
export function RunAhaanaWeeklyReportButton() {
  const [state, formAction, isPending] = useActionState(
    runAhaanaWeeklyReportAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex items-center gap-3">
      <Button type="submit" variant="outline" loading={isPending}>
        Send Ahaana&rsquo;s weekly report now
      </Button>
      {state.message && (
        <p className="text-sm text-muted-foreground">{state.message}</p>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
