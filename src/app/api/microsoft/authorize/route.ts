import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { buildAuthorizeUrl } from "@/lib/microsoft/oauth";
import { MS_OAUTH_STATE_COOKIE } from "@/lib/microsoft/oauth-state-cookie";

/**
 * v3.4.12 — starts the Microsoft OAuth flow. Not in middleware.ts's
 * PUBLIC_PATHS — this route falls through to the normal `app_access`
 * cookie gate like any other page, which is correct: only reaches here
 * at all via a click from the already-gated /ahaana-progress page.
 *
 * The `state` cookie is this flow's CSRF protection — a random,
 * unguessable value set here and compared with plain equality against
 * the callback's own `state` query param. Deliberately NOT reusing
 * access-gate-core.ts's createSignedToken/verifySignedToken: those
 * sign an expiry timestamp only, with no per-flow randomness, so they
 * don't actually bind the callback to the browser that started it —
 * a real CSRF state needs exactly that binding, which a cookie set
 * right before the redirect (and checked right after it returns)
 * provides directly.
 */
export function GET(request: NextRequest) {
  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL(
    "/api/microsoft/callback",
    request.nextUrl.origin,
  ).toString();

  let authorizeUrl: string;
  try {
    authorizeUrl = buildAuthorizeUrl(redirectUri, state);
  } catch (error) {
    const url = new URL("/ahaana-progress", request.nextUrl.origin);
    url.searchParams.set(
      "ms_error",
      error instanceof Error ? error.message : "Something went wrong",
    );
    return NextResponse.redirect(url);
  }

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(MS_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes — long enough to actually sign in/consent, short-lived since it's single-purpose
  });
  return response;
}
