import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/database-types";
import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";

/**
 * Service-role Supabase client, scoped to the `finance` schema.
 *
 * This client BYPASSES ROW LEVEL SECURITY. It must only be used from
 * server-only modules (src/services/**, route handlers, scheduled jobs) —
 * the `server-only` import above fails the build if a client component
 * imports this module, directly or transitively.
 *
 * `auth.uid()` is not populated for service-role requests, so every write
 * through this client MUST set `user_id` explicitly rather than relying on
 * the column default (see supabase/README.md and docs/03-database-design.md).
 * Never accept `user_id` from a browser request; it must come from the
 * caller's already-authenticated session on the server (see
 * src/lib/auth/require-user.ts).
 */
export function createServiceClient() {
  return createSupabaseClient<Database, "finance">(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      db: { schema: "finance" },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
