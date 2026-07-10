import "server-only";

import { redirect } from "next/navigation";
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
 * Handler. Redirects to /sign-in if there is none. Use at the top of every
 * page/layout under the (app) route group in addition to the middleware
 * check — middleware protects navigation, this protects direct RSC data
 * fetches, matching the belt-and-suspenders posture in docs/11.
 */
export async function requireUser(): Promise<User> {
  const user = await getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return user;
}
