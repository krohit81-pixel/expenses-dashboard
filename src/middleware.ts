import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";
import { withAuthTimingRetry } from "@/lib/supabase/retry";
import { OWNER_USER_ID } from "@/lib/owner";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/access-gate";
import {
  AHAANA_ACCESS_COOKIE_NAME,
  verifyAhaanaAccessToken,
} from "@/lib/ahaana-gate";

/**
 * There is still no per-visitor Supabase session and no sign-in flow for
 * the app's own data — every request runs as the single fixed owner
 * account (see src/lib/owner.ts). An earlier version of this middleware
 * established a real Supabase Auth session via signInWithPassword on
 * every uncookied request; that broke in practice because concurrent
 * requests from the same browser (mobile Safari's prefetching, in
 * particular) triggered several sign-in attempts at once, which tripped
 * Supabase's own sign-in rate limiting. This never calls any Supabase
 * Auth endpoint.
 *
 * What's new: /calendar is meant to be shareable without exposing
 * financial data, so it's public. Everything else needs a real access
 * barrier now — a single shared password, checked once per browser via a
 * self-signed cookie (src/lib/access-gate.ts), not tied to Supabase Auth
 * at all. No external call, no rate limit surface, same reasoning as
 * above for staying away from Supabase's sign-in endpoint.
 *
 * /api/cron is also public here for a different reason (v3.2.1): Vercel
 * Cron invokes /api/cron/reminders directly with no browser and no
 * access-gate cookie to send, so the cookie check below would otherwise
 * always redirect it to /login. That route authenticates itself instead
 * via a CRON_SECRET bearer token (see its own file) — this bypass only
 * skips the cookie gate, not authentication generally.
 */
// v3.4.3 — ahaana-manifest.webmanifest is public for the same reason
// /ahaana/login is: a Home Screen "Add" action (or iOS re-checking an
// already-installed one) fetches this file directly, sometimes without
// her ahaana_access cookie attached, and it carries nothing
// sensitive — just a name/icon/start_url. Doesn't start with "/ahaana"
// (a deliberate top-level static file, not nested under her gated
// tree) so it wouldn't otherwise reach the ahaana-specific branch
// below at all; it needs its own explicit public entry here instead.
//
// v3.4.6 — ahaana-sw.js needed the exact same public entry, for a
// real bug this time, not just belt-and-suspenders: the browser fetches
// a service worker script as a plain, cookieless-by-default resource
// request, and a service worker registration MUST get back the actual
// script with a 200 — a redirect (which is what this got, straight to
// /login, since it fell through to the main app_access gate below) is
// treated as a hard failure, surfacing in WebKit as exactly
// "SecurityError: Script ... load failed" rather than anything
// mentioning auth or redirects. Same "top-level static file, not
// nested under /ahaana/" reasoning as the manifest above — plain
// `startsWith("/ahaana/")` doesn't match a path with no trailing
// slash after "ahaana".
const PUBLIC_PATHS = [
  "/calendar",
  "/login",
  "/api/cron",
  "/ahaana-manifest.webmanifest",
  "/ahaana-sw.js",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * v3.4.3 — forwards the current pathname as a request header so the
 * ROOT layout (src/app/layout.tsx) can render the right
 * `<link rel="manifest">` — Atlas's own vs. Ahaana's. Root has to be
 * the one making that call: verified (built `next build` + `next
 * start` and curled the actual response, not just the dev server,
 * which masks this) that an `app/manifest.ts` file-convention route
 * auto-injects its manifest link into every page unconditionally,
 * ignoring whatever any layout's `metadata.manifest` field says
 * anywhere in the tree — so both manifests are plain static files
 * under `public/` now, chosen by an explicit, path-aware `<link>` the
 * root layout renders itself. That requires knowing the current path
 * in a Server Component, which has no built-in way to ask for it the
 * way Client Components' `usePathname()` can — `headers()` reading
 * this forwarded header is the standard workaround.
 */
function nextWithPathname(request: NextRequest): NextResponse {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return nextWithPathname(request);
  }

  // v3.4.0 — Ahaana's mini app lives entirely under /ahaana, under a
  // SEPARATE gate from the rest of the app (src/lib/ahaana-gate.ts).
  // Handled before the main gate below, and returns early either way,
  // so /ahaana never falls through to the main app_access cookie
  // check (her password is the only key that works here — the
  // household's own main password is never even consulted) and never
  // runs the onboarding/user_settings check below either, which has
  // nothing to do with her section.
  if (pathname === "/ahaana/login" || pathname.startsWith("/ahaana/login/")) {
    return nextWithPathname(request);
  }
  if (pathname === "/ahaana" || pathname.startsWith("/ahaana/")) {
    const ahaanaToken = request.cookies.get(AHAANA_ACCESS_COOKIE_NAME)?.value;
    if (!verifyAhaanaAccessToken(ahaanaToken)) {
      return NextResponse.redirect(new URL("/ahaana/login", request.url));
    }
    return nextWithPathname(request);
  }

  const token = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  if (!verifyAccessToken(token)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/onboarding") {
    return nextWithPathname(request);
  }

  // withAuthTimingRetry: this query runs on every gated page view, so
  // it's the other place (besides /calendar's server-side data fetches)
  // that can hit Supabase's transient "JWT issued at future" error on a
  // cold first request after idle traffic — see that helper's comment.
  // Unretried, that failure left `settings` null exactly like "no row
  // found," which would have wrongly bounced an already-onboarded owner
  // to /onboarding.
  const supabase = createServiceClient();
  const { data: settings } = await withAuthTimingRetry(() =>
    supabase
      .from("user_settings")
      .select("user_id")
      .eq("user_id", OWNER_USER_ID)
      .maybeSingle(),
  );

  if (!settings) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return nextWithPathname(request);
}

export const config = {
  // @supabase/supabase-js (imported via createServiceClient) uses Node.js
  // APIs Edge doesn't support — see the commit that first fixed
  // MIDDLEWARE_INVOCATION_FAILED for the full explanation.
  runtime: "nodejs",
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, manifest.webmanifest, icons/*
     * - common static file extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
