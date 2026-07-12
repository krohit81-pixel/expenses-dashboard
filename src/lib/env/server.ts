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
