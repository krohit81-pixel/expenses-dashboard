import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/lib/db/database-types";
import { publicEnv } from "@/lib/env/public";

/**
 * Server-side Supabase client for Server Components, Route Handlers, and
 * Server Actions, scoped to the `finance` schema. Runs as the authenticated
 * user's session and is subject to RLS. This is NOT the service-role client —
 * see src/lib/supabase/service.ts for trusted server operations.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database, "finance">(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      db: { schema: "finance" },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot mutate cookies; middleware handles refreshes.
          }
        },
      },
    },
  );
}
