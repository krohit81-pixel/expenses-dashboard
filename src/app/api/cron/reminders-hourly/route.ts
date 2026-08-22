import { NextResponse, type NextRequest } from "next/server";

import { checkCronAuth } from "@/lib/cron-auth";
import { runHourlyReminders } from "@/services/ReminderService";

/**
 * v3.2.2 — the hour-based counterpart to /api/cron/reminders, on its
 * own more frequent Vercel Cron schedule (every 15 minutes — see
 * vercel.json) since an "N hours before" reminder needs tighter timing
 * precision than a day-level one. Deliberately a second route+cron
 * entry rather than folding into the existing 4-hourly one: the
 * household explicitly chose "keep the existing 4-hour cron, add a
 * second frequent one just for hour-based reminders" over tightening
 * the single schedule, so day-level checks stay exactly as infrequent
 * as they were before this existed.
 *
 * Same auth as the day-based route — see checkCronAuth
 * (lib/cron-auth.ts) and middleware.ts's PUBLIC_PATHS (/api/cron
 * bypasses the access-gate cookie for both routes under it).
 */
export async function GET(request: NextRequest) {
  const auth = checkCronAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await runHourlyReminders();
  return NextResponse.json(result);
}
