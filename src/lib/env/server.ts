import "server-only";

import { z } from "zod";

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
  // unset, IntelService.generateInsight() returns null and the page shows
  // a "not configured" message in the insight card instead of crashing
  // the whole app at boot over an enhancement, not a core dependency.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  // v1.6.0 — an alternate provider for the same Intel insight, for anyone
  // who'd rather use a Gemini key than an Anthropic one (or has one
  // already and not the other). Replaces the earlier OPENAI_API_KEY
  // option (v1.2), removed at the user's request rather than kept as a
  // third option. generateInsight() tries Anthropic first if both are
  // set — see that function's comment for why.
  GEMINI_API_KEY: z.string().min(1).optional(),
  // Optional override — defaults to a current small/cheap Gemini model
  // in IntelService.ts if unset. Only relevant when GEMINI_API_KEY is
  // configured; exists so a model rename/deprecation doesn't require a
  // code change to recover from, just an env var.
  GEMINI_MODEL: z.string().min(1).optional(),
  // v1.3.0 — the password on HDFC's Infinia statement PDF (HDFC emails
  // these encrypted; the usual scheme is some combination of the
  // cardholder's name/DOB, but this app never assumes a specific
  // formula — it's just read as an opaque string from this env var).
  // Optional, same reasoning as the AI keys above: without it, the
  // /imports page still loads, it just can't decrypt a protected PDF —
  // it says so rather than crashing. Only one card is supported for
  // now (Infinia); a second card would get its own env var when that's
  // actually needed, not a speculative multi-card scheme today.
  HDFC_INFINIA_STATEMENT_PASSWORD: z.string().min(1).optional(),
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
    APP_ACCESS_PASSWORD: process.env.APP_ACCESS_PASSWORD,
    APP_SESSION_SECRET: process.env.APP_SESSION_SECRET,
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
