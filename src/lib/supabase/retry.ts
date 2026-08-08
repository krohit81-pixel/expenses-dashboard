import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Matches Supabase/PostgREST's "JWT issued at future" auth-timing error
 * (and the "issued in the future" wording some client/server versions
 * use). Never an actual credential problem here — `SUPABASE_SERVICE_ROLE_KEY`
 * is a long-lived static secret (see src/lib/supabase/service.ts), not
 * something minted fresh per request — every occurrence observed so far
 * has been the *first* query after a stretch of no traffic (Vercel logs:
 * "Failed to load trips: JWT issued at future" on /calendar's first
 * cold load, gone on the very next request with no code change), which
 * points at a transient clock-sync artifact on Supabase's side rather
 * than anything wrong with the token itself.
 */
function isTransientAuthTimingError(error: PostgrestError | null): boolean {
  return !!error && /jwt issued (at|in the) future/i.test(error.message);
}

/**
 * Retries a Supabase/PostgREST query once, after a short delay, if (and
 * only if) it fails with the transient auth-timing error above — added
 * (v2.5.3) after that error surfaced as a server-side exception on
 * /calendar's first load after idle (see the comment above), which is
 * exactly the situation a real visitor hits worst: the public,
 * gate-free page most likely to get a cold first request. Every other
 * error is returned as-is, immediately, for the caller's normal
 * `if (error) throw` handling.
 *
 * Takes a thunk, not a promise/query-builder instance, so the retry is
 * a genuinely fresh request — re-awaiting an already-settled Postgrest
 * builder isn't a documented, reliable way to re-issue the same query.
 *
 * Generic over the whole result `R`, not just a `{ data: T }` shape —
 * Supabase/PostgREST responses are a discriminated union
 * (`{ data: T; error: null } | { data: null; error: PostgrestError }`),
 * which is exactly what lets every call site's existing
 * `if (error) throw ...` narrow `data` to non-null afterward. Re-typing
 * the return as a flattened `{ data: T; error }` here would break that
 * narrowing at every call site instead of preserving it.
 */
export async function withAuthTimingRetry<
  R extends { error: PostgrestError | null },
>(query: () => PromiseLike<R>): Promise<R> {
  const first = await query();
  if (!isTransientAuthTimingError(first.error)) {
    return first;
  }
  await new Promise((resolve) => setTimeout(resolve, 400));
  return query();
}
