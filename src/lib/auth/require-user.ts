import "server-only";

import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * Returns the current authenticated user, or null.
 * Uses `getUser()` (not `getSession()`), which revalidates the session
 * against Supabase Auth rather than trusting a possibly-stale cookie.
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Requires an authenticated user for a Server Component, layout, or Route
 * Handler. Use at the top of every page/layout under the (app) route
 * group in addition to the middleware check — middleware protects
 * navigation, this protects direct RSC data fetches, matching the
 * belt-and-suspenders posture in docs/11.
 *
 * There's no /sign-in page to redirect to anymore (see src/middleware.ts —
 * every request is auto-authenticated as the fixed owner account before
 * it reaches here). Reaching this function with no user means middleware
 * didn't run for this request, which is a configuration bug worth
 * surfacing loudly, not something to paper over with a redirect to a page
 * that no longer exists.
 */
export async function requireUser(): Promise<User> {
  const user = await getUser();

  if (!user) {
    throw new Error(
      "requireUser() found no session. Middleware should have established one — check that src/middleware.ts's matcher covers this route.",
    );
  }

  return user;
}
