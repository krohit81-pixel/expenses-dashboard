import { NextResponse, type NextRequest } from "next/server";

import { checkCronAuth } from "@/lib/cron-auth";
import { runReminders } from "@/services/ReminderService";

/**
 * v3.2.1 — the Vercel Cron-invoked counterpart to Settings' manual
 * "Run reminders now" button (RunRemindersButton/runRemindersAction):
 * same ReminderService.runReminders() call underneath, just on a timer
 * instead of a click. See vercel.json for the schedule (every 4 hours
 * — day-level lead times don't need tighter precision than that).
 *
 * This route deliberately bypasses the access-gate cookie entirely
 * (see middleware.ts's PUBLIC_PATHS) — Vercel Cron has no browser
 * session to carry one. Auth is checkCronAuth (lib/cron-auth.ts,
 * factored out in v3.2.2 when /api/cron/reminders-hourly needed the
 * exact same check) — a CRON_SECRET bearer token instead.
 */
export async function GET(request: NextRequest) {
  const auth = checkCronAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await runReminders();
  return NextResponse.json(result);
}
