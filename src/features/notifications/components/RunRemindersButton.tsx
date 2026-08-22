"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  runRemindersAction,
  type RunRemindersFormState,
} from "@/features/notifications/api/actions";

const initialState: RunRemindersFormState = {};

/**
 * v3.2.0 — the manual trigger for ReminderService, same role
 * Recurring's GenerateDueTransactionsButton plays for
 * generateDueTransactions: proves the whole pipeline (detect -> dedupe
 * -> send) works before anything runs on a schedule. Once
 * /api/cron/reminders exists, this button stays — a way to force a
 * run without waiting for the next scheduled tick, e.g. right after
 * saving a chat ID for the first time.
 */
export function RunRemindersButton() {
  const [state, formAction, isPending] = useActionState(
    runRemindersAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex items-center gap-3">
      <Button type="submit" variant="outline" loading={isPending}>
        Run reminders now
      </Button>
      {state.message && (
        <p className="text-sm text-muted-foreground">{state.message}</p>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
