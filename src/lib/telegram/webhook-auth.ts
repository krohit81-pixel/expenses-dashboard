import "server-only";

import type { NextRequest } from "next/server";

import { serverEnv } from "@/lib/env/server";
import { timingSafeStringEqual } from "@/lib/access-gate-core";

/**
 * v3.7.0 — auth for the inbound Telegram webhook
 * (src/app/api/telegram/webhook/route.ts). Mirrors src/lib/cron-auth.ts's
 * checkCronAuth exactly, just against a different header/secret: Telegram
 * echoes TELEGRAM_WEBHOOK_SECRET back verbatim as
 * `X-Telegram-Bot-Api-Secret-Token` on every Update POST, once setWebhook
 * is registered with a matching secret_token (a one-time manual step, see
 * INSTALL.md) — nobody who merely knows this route's URL can trigger it
 * without also knowing the secret.
 */
export type TelegramWebhookAuthResult =
  { ok: true } | { ok: false; status: 401 | 503; error: string };

export function checkTelegramWebhookAuth(
  request: NextRequest,
): TelegramWebhookAuthResult {
  if (!serverEnv.TELEGRAM_WEBHOOK_SECRET) {
    // Not configured yet — refuse rather than run unauthenticated.
    return {
      ok: false,
      status: 503,
      error: "TELEGRAM_WEBHOOK_SECRET is not configured",
    };
  }

  const token = request.headers.get("x-telegram-bot-api-secret-token") ?? "";

  if (
    !token ||
    !timingSafeStringEqual(
      serverEnv.APP_SESSION_SECRET,
      serverEnv.TELEGRAM_WEBHOOK_SECRET,
      token,
    )
  ) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true };
}
