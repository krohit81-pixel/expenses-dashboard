import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/db/database-types";
import { publicEnv } from "@/lib/env/public";

/**
 * Browser Supabase client, scoped to the `finance` schema.
 * Subject to RLS: only returns rows where `auth.uid() = user_id`.
 * Use for narrowly-scoped reads or realtime needs only — see docs/02.
 */
export function createClient() {
  return createBrowserClient<Database, "finance">(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { db: { schema: "finance" } },
  );
}
