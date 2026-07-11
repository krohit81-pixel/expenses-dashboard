import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/database-types";
import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";

/**
 * Service-role Supabase client, scoped to the `finance` schema.
 *
 * This is now the primary data-access client for every service in
 * src/services/** — there is no per-request session (see
 * src/middleware.ts and src/lib/owner.ts for why), so the RLS-scoped
 * client in src/lib/supabase/server.ts is unused. This client BYPASSES
 * ROW LEVEL SECURITY entirely, which means RLS is no longer providing
 * any actual data isolation — every service is responsible for
 * explicitly filtering every read/update/delete by
 * `user_id = OWNER_USER_ID` and setting it explicitly on every insert
 * (see src/lib/owner.ts). The RLS policies and ownership triggers from
 * the migrations are still in place and still correct — they just aren't
 * the active enforcement mechanism for this app's actual traffic anymore.
 *
 * Only import this from server-only modules — the `server-only` import
 * above fails the build if a client component imports this module,
 * directly or transitively.
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
