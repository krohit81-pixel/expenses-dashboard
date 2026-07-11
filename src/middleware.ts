import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/db/database-types";
import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";

/**
 * This app has no visible sign-in screen, by explicit choice: every
 * visitor is automatically signed in as one fixed "owner" account.
 * Anyone with the URL gets in. RLS and every service still depend on a
 * real, authenticated auth.uid() — this preserves that entirely; it just
 * establishes the session invisibly instead of asking a person to click a
 * magic link. See .env.example for the two credentials this needs.
 *
 * If you want a real access barrier back (e.g. before making this public),
 * the credentials themselves are that barrier — anyone who can set
 * APP_OWNER_EMAIL/APP_OWNER_PASSWORD in your deployment's env vars
 * effectively controls who "is" the owner. Rotating the password and
 * redeploying signs out every existing session.
 */
async function ensureOwnerSession(
  supabase: ReturnType<typeof createServerClient<Database, "finance">>,
) {
  const signIn = () =>
    supabase.auth.signInWithPassword({
      email: serverEnv.APP_OWNER_EMAIL,
      password: serverEnv.APP_OWNER_PASSWORD,
    });

  const first = await signIn();
  if (!first.error) {
    return first.data.user;
  }

  // Most likely cause of failure on a fresh deploy: the owner account
  // doesn't exist in Supabase Auth yet. Create it once (idempotent — if
  // another concurrent request already created it, admin.createUser's
  // "already registered" error is expected and ignored), then retry.
  const admin = createSupabaseClient<Database, "finance">(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  await admin.auth.admin.createUser({
    email: serverEnv.APP_OWNER_EMAIL,
    password: serverEnv.APP_OWNER_PASSWORD,
    email_confirm: true,
  });

  const retry = await signIn();
  if (retry.error) {
    throw new Error(
      `Failed to establish owner session: ${retry.error.message}`,
    );
  }
  return retry.data.user;
}

export async function middleware(request: NextRequest) {
  // Response we may mutate with refreshed auth cookies.
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database, "finance">(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      db: { schema: "finance" },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() revalidates the token against Supabase Auth.
  // Do not swap this for getSession() here — that only reads the cookie.
  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();

  const user = existingUser ?? (await ensureOwnerSession(supabase));

  const { pathname } = request.nextUrl;

  if (pathname !== "/onboarding") {
    const { data: settings } = await supabase
      .from("user_settings")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!settings) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  return response;
}

export const config = {
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
