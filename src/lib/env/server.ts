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
