import "server-only";

import type { NextRequest } from "next/server";

import { serverEnv } from "@/lib/env/server";
import { timingSafeStringEqual } from "@/lib/access-gate-core";

/**
 * v3.2.1, factored out in v3.2.2 when a second cron route
 * (`/api/cron/reminders-hourly`) needed the exact same check —
 * shared so the two routes can't silently drift in how they
 * authenticate.
 *
 * Bearer-token auth against CRON_SECRET, the same value Vercel sends
 * automatically as `Authorization: Bearer $CRON_SECRET` to a route a
 * `crons` entry in vercel.json points at. Uses timingSafeStringEqual
 * (access-gate-core.ts) — the same tested primitive the access-gate
 * cookie itself relies on — rather than a raw `===`/`timingSafeEqual`
 * call, HMACed under APP_SESSION_SECRET so two different-length
 * strings never throw.
 */
export type CronAuthResult =
  { ok: true } | { ok: false; status: 401 | 503; error: string };

export function checkCronAuth(request: NextRequest): CronAuthResult {
  if (!serverEnv.CRON_SECRET) {
    // Not configured yet — refuse rather than run unauthenticated.
    // Should only happen if a vercel.json crons entry is deployed
    // before CRON_SECRET is set in Vercel's env vars.
    return { ok: false, status: 503, error: "CRON_SECRET is not configured" };
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
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true };
}
