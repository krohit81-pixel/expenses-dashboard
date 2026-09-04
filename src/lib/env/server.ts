import "server-only";

import { z } from "zod";

import { optionalEnvString } from "@/lib/env/optional-string";

/**
 * Environment variables that must never reach a client bundle.
 * The `server-only` import above makes Next.js fail the build if any
 * client component imports this module, directly or transitively.
 */
const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  // The single fixed "owner" account every request runs as. Created once
  // via `npm run bootstrap:owner` (see scripts/bootstrap-owner.mjs and
  // INSTALL.md), not per-request — there is deliberately no sign-in flow
  // and no session/cookie involved. See src/lib/owner.ts and
  // src/lib/supabase/service.ts for how this is used.
  APP_OWNER_USER_ID: z.uuid(
    "APP_OWNER_USER_ID must be the UUID printed by npm run bootstrap:owner",
  ),
  // Optional, unlike the two above: Intel's charts work without it. If
  // unset, IntelService.regenerateInsight() reports "no provider
  // configured" when the "Generate commentary" button is pressed,
  // instead of crashing the whole app at boot over an enhancement, not
  // a core dependency.
  ANTHROPIC_API_KEY: optionalEnvString(),
  // v1.6.0 — an alternate provider for the same Intel insight, for anyone
  // who'd rather use a Gemini key than an Anthropic one (or has one
  // already and not the other). Replaces the earlier OPENAI_API_KEY
  // option (v1.2), removed at the user's request rather than kept as a
  // third option. regenerateInsight() tries Anthropic first if both are
  // set — see that function's comment for why.
  GEMINI_API_KEY: optionalEnvString(),
  // Optional override — defaults to a current small/cheap Gemini model
  // in IntelService.ts if unset. Only relevant when GEMINI_API_KEY is
  // configured; exists so a model rename/deprecation doesn't require a
  // code change to recover from, just an env var.
  GEMINI_MODEL: optionalEnvString(),
  // v1.3.0 — the password on HDFC's Infinia statement PDF (HDFC emails
  // these encrypted; the usual scheme is some combination of the
  // cardholder's name/DOB, but this app never assumes a specific
  // formula — it's just read as an opaque string from this env var).
  // Optional, same reasoning as the AI keys above: without it, the
  // /imports page still loads, it just can't decrypt a protected PDF —
  // it says so rather than crashing.
  HDFC_INFINIA_STATEMENT_PASSWORD: optionalEnvString(),
  // v1.11.0 — a real Tata Neu Plus HDFC Bank Credit Card statement turned
  // out to reconcile against the hdfc-infinia parser's transaction table
  // unmodified (renamed to hdfc-infinia-tata, with header-level cardType
  // detection added). Unlike the Axis/ICICI generalizations above, this
  // one keeps a SEPARATE password env var rather than folding into
  // HDFC_INFINIA_STATEMENT_PASSWORD, per explicit instruction: HDFC's
  // co-branded cards don't necessarily share the same password formula
  // as the core Infinia product, even though the PDF layout and parser
  // are otherwise identical.
  HDFC_TATA_STATEMENT_PASSWORD: optionalEnvString(),
  // v1.7.0 — same reasoning as HDFC_INFINIA_STATEMENT_PASSWORD above,
  // for Axis's own encrypted statement PDFs. A distinct env var rather
  // than reusing HDFC's, since the two banks' password schemes have no
  // reason to match. Renamed from AXIS_HORIZON_STATEMENT_PASSWORD in
  // v1.10.0 (was ...HORIZON... before the parser also picked up the
  // Airtel co-branded card) — same password scheme confirmed across
  // both real statements, one shared env var, not a per-card-product one.
  AXIS_STATEMENT_PASSWORD: optionalEnvString(),
  // v1.8.0 — same reasoning again, for ICICI's own encrypted statement
  // PDFs. Named ICICI_STATEMENT_PASSWORD (not ICICI_AMAZON_..., its
  // v1.8.0 name) since v1.9.0 confirmed ICICI uses the same password
  // scheme for both statement types this parser covers (Amazon Pay and
  // RuPay-variant cards) — one shared env var, not a per-card-product
  // one. Neither real sample statement this parser was built against was
  // password-protected, but ICICI does encrypt these in production the
  // same way HDFC/Axis do, so this follows the identical optional
  // env-var pattern rather than assuming no password is ever needed.
  ICICI_STATEMENT_PASSWORD: optionalEnvString(),
  // The access gate: /calendar stays public (shareable without exposing
  // financial data), everything else requires this shared password once
  // per browser. This is NOT Supabase Auth and never calls any Supabase
  // Auth endpoint — that's deliberate. The earlier per-request
  // signInWithPassword design was replaced specifically because it hit
  // Supabase's own sign-in rate limiting under concurrent requests (see
  // src/middleware.ts's history). This gate is a self-contained,
  // app-level HMAC-signed cookie (see src/lib/access-gate.ts) with no
  // external calls and no rate limit to trip.
  APP_ACCESS_PASSWORD: z
    .string()
    .min(6, "APP_ACCESS_PASSWORD must be at least 6 characters"),
  APP_SESSION_SECRET: z
    .string()
    .min(
      32,
      "APP_SESSION_SECRET must be at least 32 characters — generate a random one, don't reuse another secret",
    ),
  // v3.2.0 — the bot token from @BotFather, powering the first
  // notification channel (src/lib/notifications/providers/telegram.ts).
  // Optional, same reasoning as the AI provider keys above: without it,
  // TelegramProvider.isConfigured() returns false and ReminderService
  // just skips sending (logged, not crashed) rather than the app
  // failing to boot over an opt-in feature. Never exposed to the
  // client — only ever read server-side when actually sending.
  TELEGRAM_BOT_TOKEN: optionalEnvString(),
  // v3.2.0, wired to a real route in v3.2.1 — authenticates the
  // cron-triggered reminder route (src/app/api/cron/reminders/route.ts)
  // so it isn't reachable by anyone who finds the URL. Vercel
  // automatically sends this exact value as
  // `Authorization: Bearer $CRON_SECRET` when the vercel.json `crons`
  // entry invokes the route, as long as the env var is named exactly
  // this — see Vercel's own Cron Jobs docs. Still optional at the env
  // schema level (the app must still boot in a fresh environment before
  // anyone's set it in Vercel) — but the route itself refuses every
  // request with a 503 until this is set, rather than running
  // unauthenticated.
  CRON_SECRET: optionalEnvString(),
  // v3.7.0 — the Telegram inbound webhook's own secret
  // (src/app/api/telegram/webhook/route.ts), distinct from CRON_SECRET
  // above: a different caller (Telegram's own servers, not Vercel),
  // checked against a different header. Telegram echoes this value
  // back verbatim as `X-Telegram-Bot-Api-Secret-Token` on every Update
  // POST, once `setWebhook` is registered with a matching
  // `secret_token` (a one-time manual step — see INSTALL.md). Optional
  // at the schema level for the same reason CRON_SECRET is — the app
  // must still boot before this is set — but the route itself refuses
  // every request with a 503 until it is.
  TELEGRAM_WEBHOOK_SECRET: optionalEnvString(),
  // v3.4.0 — Ahaana's own access gate (src/lib/ahaana-gate.ts), a
  // second, separate password scoped only to /ahaana/* (see
  // middleware.ts) — deliberately a different value than
  // APP_ACCESS_PASSWORD, so knowing hers never unlocks the rest of
  // Atlas and vice versa. Optional at the schema level for the same
  // reason CRON_SECRET is: the app must still boot in a fresh
  // environment before anyone's set this in Vercel. Unlike
  // APP_ACCESS_PASSWORD (required — the whole app is unusable
  // without it), her gate simply refuses every /ahaana request until
  // this is set, rather than crashing the entire app's boot over one
  // section's password being missing.
  AHAANA_ACCESS_PASSWORD: optionalEnvString(),
  // v3.4.0 Phase 2 — real web push notifications for Ahaana's mini
  // app (she has no Telegram). VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY are
  // a key pair generated once (`npx web-push generate-vapid-keys`)
  // identifying this app to push services — never regenerate them
  // once real subscriptions exist, or every existing subscription
  // silently stops working (the public key is baked into each
  // subscription at the moment it's created client-side).
  // VAPID_SUBJECT is a contact URL/mailto the Web Push spec requires
  // push services to be able to reach if this app misbehaves — a
  // plain project URL (not a personal email) to avoid sending
  // personal contact info to Google/Mozilla/Apple's push
  // infrastructure on every single send. All three optional at the
  // schema level (same "app must still boot before Vercel is
  // configured" reasoning as CRON_SECRET/AHAANA_ACCESS_PASSWORD) —
  // src/lib/notifications/providers/web-push.ts's isConfigured()
  // is what actually gates whether this channel can send.
  VAPID_PUBLIC_KEY: optionalEnvString(),
  VAPID_PRIVATE_KEY: optionalEnvString(),
  VAPID_SUBJECT: optionalEnvString(),
  // v3.4.12 — Ahaana's school Outlook mailbox, "Connect School Email"
  // on /ahaana-progress. Deliberately the simplest possible connection
  // the household explicitly asked for: an email + password, IMAP
  // against Outlook's own server (src/lib/microsoft/imap-client.ts) —
  // no OAuth, no stored token. Both optional at the schema level (same
  // "app must still boot before Vercel is configured" reasoning as
  // CRON_SECRET/AHAANA_ACCESS_PASSWORD) — the feature just refuses
  // with a clear error until both are set. Real caveat: Microsoft
  // retired plain username+password IMAP access for most Exchange
  // Online tenants in 2022 — whether this actually works depends on
  // the school's own tenant configuration, not this app.
  AHAANA_SCHOOL_EMAIL: optionalEnvString(),
  AHAANA_SCHOOL_EMAIL_PASSWORD: optionalEnvString(),
});

function formatZodError(prefix: string, error: z.ZodError): string {
  const issues = error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  return `${prefix}\n${issues}\n\nCheck your .env.local against .env.example.`;
}

function parseServerEnv() {
  const result = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    APP_OWNER_USER_ID: process.env.APP_OWNER_USER_ID,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    HDFC_INFINIA_STATEMENT_PASSWORD:
      process.env.HDFC_INFINIA_STATEMENT_PASSWORD,
    HDFC_TATA_STATEMENT_PASSWORD: process.env.HDFC_TATA_STATEMENT_PASSWORD,
    AXIS_STATEMENT_PASSWORD: process.env.AXIS_STATEMENT_PASSWORD,
    ICICI_STATEMENT_PASSWORD: process.env.ICICI_STATEMENT_PASSWORD,
    APP_ACCESS_PASSWORD: process.env.APP_ACCESS_PASSWORD,
    APP_SESSION_SECRET: process.env.APP_SESSION_SECRET,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    CRON_SECRET: process.env.CRON_SECRET,
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
    AHAANA_ACCESS_PASSWORD: process.env.AHAANA_ACCESS_PASSWORD,
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
    AHAANA_SCHOOL_EMAIL: process.env.AHAANA_SCHOOL_EMAIL,
    AHAANA_SCHOOL_EMAIL_PASSWORD: process.env.AHAANA_SCHOOL_EMAIL_PASSWORD,
  });

  if (!result.success) {
    throw new Error(
      formatZodError("Invalid server environment variables:", result.error),
    );
  }

  return result.data;
}

/**
 * Validated, server-only environment values (e.g. the Supabase service-role key).
 * Only import this from server-only modules such as src/lib/supabase/service.ts
 * or src/services/**.
 */
export const serverEnv = parseServerEnv();
