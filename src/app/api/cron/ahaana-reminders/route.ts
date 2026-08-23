import { NextResponse, type NextRequest } from "next/server";

import { checkCronAuth } from "@/lib/cron-auth";
import { runAhaanaReminders } from "@/services/ReminderService";

/**
 * v3.4.0 Phase 2 — the cron-invoked counterpart to
 * ReminderService.runAhaanaReminders(), same auth pattern as the other
 * two cron routes (checkCronAuth, lib/cron-auth.ts). A separate route
 * (not folded into /api/cron/reminders) since this one targets
 * web_push only, on its own schedule, and there's no manual "run now"
 * button for it yet the way RunRemindersButton exists for the
 * household's own reminders — it only ever runs on the schedule below.
 */
export async function GET(request: NextRequest) {
  const auth = checkCronAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await runAhaanaReminders();
  return NextResponse.json(result);
}
