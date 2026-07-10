import { z } from "zod";

/**
 * Environment variables safe to expose to the browser.
 * Only NEXT_PUBLIC_* values belong here. Import from client or server code.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    message: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL",
  }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
});

function formatZodError(prefix: string, error: z.ZodError): string {
  const issues = error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  return `${prefix}\n${issues}\n\nCheck your .env.local against .env.example.`;
}

function parsePublicEnv() {
  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!result.success) {
    throw new Error(
      formatZodError("Invalid public environment variables:", result.error),
    );
  }

  return result.data;
}

/** Validated, browser-safe environment values. */
export const publicEnv = parsePublicEnv();
