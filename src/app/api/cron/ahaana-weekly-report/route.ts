import { NextResponse, type NextRequest } from "next/server";

import { checkCronAuth } from "@/lib/cron-auth";
import { runAhaanaWeeklyReportCron } from "@/services/ReminderService";

/**
 * v3.6.2 — the parent's weekly Ahaana report's own dedicated cron, split
 * out from the general `/api/cron/reminders` (every 4 hours) so it can
 * run near the END of Sunday instead of at the first tick where the
 * calendar date crosses into Sunday (5:30am IST) — see
 * ReminderService.runAhaanaWeeklyReportCron's own comment for the full
 * story. Schedule in vercel.json: `30 14 * * 0` (Vercel Cron is always
 * UTC) = Sunday 20:00 IST.
 *
 * Same auth pattern as every other cron route (checkCronAuth,
 * lib/cron-auth.ts) — Vercel Cron has no browser session to carry the
 * access-gate cookie.
 */
export async function GET(request: NextRequest) {
  const auth = checkCronAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await runAhaanaWeeklyReportCron();
  return NextResponse.json(result);
}
