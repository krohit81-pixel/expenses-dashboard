import { NextResponse, type NextRequest } from "next/server";

import { exchangeCodeForTokens } from "@/lib/microsoft/oauth";
import { fetchUserProfile } from "@/lib/microsoft/graph";
import { saveConnection } from "@/services/MicrosoftEmailConnectionService";
import { MS_OAUTH_STATE_COOKIE } from "@/lib/microsoft/oauth-state-cookie";

/**
 * v3.4.12 — Microsoft redirects the browser back here after
 * sign-in/consent. A normal top-level GET navigation, so the app's own
 * `app_access` cookie (SameSite=Lax) is still attached — this route
 * doesn't need its own gate beyond the CSRF `state` check below (see
 * the authorize route's own comment on why a cookie, not a signed
 * token, is the right CSRF mechanism here).
 *
 * Always redirects back to /ahaana-progress, on success or failure —
 * ?ms_connected=1 or ?ms_error=<message> — never renders anything
 * itself.
 */
export async function GET(request: NextRequest) {
  const progressUrl = new URL("/ahaana-progress", request.nextUrl.origin);

  function redirectWithError(message: string) {
    const url = new URL(progressUrl);
    url.searchParams.set("ms_error", message);
    const response = NextResponse.redirect(url);
    response.cookies.delete(MS_OAUTH_STATE_COOKIE);
    return response;
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const graphError = request.nextUrl.searchParams.get("error_description");
  const expectedState = request.cookies.get(MS_OAUTH_STATE_COOKIE)?.value;

  if (graphError) {
    return redirectWithError(graphError);
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithError(
      "Couldn't verify the sign-in request — please try connecting again.",
    );
  }

  try {
    const redirectUri = new URL(
      "/api/microsoft/callback",
      request.nextUrl.origin,
    ).toString();
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const emailAddress = await fetchUserProfile(tokens.accessToken);
    await saveConnection(emailAddress, tokens.refreshToken);
  } catch (error) {
    return redirectWithError(
      error instanceof Error ? error.message : "Something went wrong",
    );
  }

  const url = new URL(progressUrl);
  url.searchParams.set("ms_connected", "1");
  const response = NextResponse.redirect(url);
  response.cookies.delete(MS_OAUTH_STATE_COOKIE);
  return response;
}
