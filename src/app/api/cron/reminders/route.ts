import { NextResponse, type NextRequest } from "next/server";

import { serverEnv } from "@/lib/env/server";
import { timingSafeStringEqual } from "@/lib/access-gate-core";
import { runReminders } from "@/services/ReminderService";

/**
 * v3.2.1 — the Vercel Cron-invoked counterpart to Settings' manual
 * "Run reminders now" button (RunRemindersButton/runRemindersAction):
 * same ReminderService.runReminders() call underneath, just on a timer
 * instead of a click. See vercel.json for the schedule.
 *
 * This route deliberately bypasses the access-gate cookie entirely
 * (see middleware.ts's PUBLIC_PATHS) — Vercel Cron has no browser
 * session to carry one. Instead it authenticates itself via
 * CRON_SECRET as a bearer token, which Vercel sends automatically as
 * `Authorization: Bearer $CRON_SECRET` to any route a `crons` entry in
 * vercel.json points at, as long as the env var is named exactly
 * CRON_SECRET (see Vercel's Cron Jobs docs). Reuses
 * timingSafeStringEqual (access-gate-core.ts) for the comparison
 * rather than a new raw `===`/`timingSafeEqual` call — same tested
 * primitive the access-gate cookie already relies on, HMACed under
 * APP_SESSION_SECRET so two different-length strings never throw.
 */
export async function GET(request: NextRequest) {
  if (!serverEnv.CRON_SECRET) {
    // Not configured yet — refuse rather than run unauthenticated.
    // Should only happen if the vercel.json crons entry is deployed
    // before CRON_SECRET is set in Vercel's env vars.
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }

  const [scheme, token] = (request.headers.get("authorization") ?? "").split(
    " ",
  );

  if (
    scheme !== "Bearer" ||
    !token ||
    !timingSafeStringEqual(
      serverEnv.APP_SESSION_SECRET,
      serverEnv.CRON_SECRET,
      token,
    )
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runReminders();
  return NextResponse.json(result);
}
