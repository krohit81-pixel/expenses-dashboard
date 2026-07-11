import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";
import { OWNER_USER_ID } from "@/lib/owner";

/**
 * This app has no sign-in flow, no session, and no cookies, by explicit
 * choice — every request runs as the single fixed owner account (see
 * src/lib/owner.ts and scripts/bootstrap-owner.mjs). An earlier version
 * of this middleware established a real Supabase Auth session via
 * signInWithPassword on every uncookied request; that broke in practice
 * because concurrent requests from the same browser (mobile Safari's
 * prefetching, in particular) triggered several sign-in attempts at once,
 * which tripped Supabase's own sign-in rate limiting and made even
 * correct credentials start failing intermittently. Fighting a rate
 * limiter that exists specifically to stop repeated sign-in attempts,
 * for a flow that isn't providing real access control anyway, wasn't
 * worth it — this version never calls any Auth sign-in endpoint at all.
 *
 * The only thing middleware still does is the onboarding gate.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  // MIDDLEWARE_INVOCATION_FAILED for the full explanation. Still needed
  // even though this middleware no longer calls any Auth sign-in method.
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
