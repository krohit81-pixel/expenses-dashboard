import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";
import { OWNER_USER_ID } from "@/lib/owner";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/access-gate";

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
 */
const PUBLIC_PATHS = ["/calendar", "/login"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  if (!verifyAccessToken(token)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/onboarding") {
    return NextResponse.next();
  }

  const supabase = createServiceClient();
  const { data: settings } = await supabase
    .from("user_settings")
    .select("user_id")
    .eq("user_id", OWNER_USER_ID)
    .maybeSingle();

  if (!settings) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return NextResponse.next();
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
