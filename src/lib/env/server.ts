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
  // Credentials for the single fixed "owner" account that every visitor is
  // automatically signed in as — see src/middleware.ts. This app has no
  // visible sign-in screen; anyone with the URL gets in, by the person's
  // own explicit choice. These still need to be real, unguessable
  // credentials: they're what stands between "no login page" and "no
  // login at all" for the underlying Supabase Auth session that RLS
  // depends on. Do not reuse a password used anywhere else.
  APP_OWNER_EMAIL: z.email("APP_OWNER_EMAIL must be a valid email address"),
  APP_OWNER_PASSWORD: z
    .string()
    .min(12, "APP_OWNER_PASSWORD must be at least 12 characters"),
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
    APP_OWNER_EMAIL: process.env.APP_OWNER_EMAIL,
    APP_OWNER_PASSWORD: process.env.APP_OWNER_PASSWORD,
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
