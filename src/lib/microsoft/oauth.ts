import "server-only";

import { serverEnv } from "@/lib/env/server";

/**
 * v3.4.12 — Microsoft Identity Platform Authorization Code flow,
 * hand-rolled against plain `fetch()` rather than `@azure/msal-node`.
 * The whole flow is two HTTP calls (build this authorize URL, POST the
 * token endpoint) plus one Graph GET (see `graph.ts`) — MSAL's real
 * value-add, a token cache, still needs a hand-written Supabase-backed
 * persistence layer in a serverless app anyway, so the library buys
 * nothing here. Matches this codebase's existing preference for
 * dependency-light, hand-written auth primitives (see
 * `access-gate-core.ts`'s own HMAC cookie signing rather than a
 * session library).
 *
 * Scopes are deliberately minimal and fixed, not configurable:
 * `openid profile email offline_access User.Read Mail.Read` — no
 * Mail.Send/Mail.ReadWrite/Calendars/Contacts/Files/etc. This is a
 * read-only proof of concept for one Inbox, nothing more.
 */
const SCOPES = "openid profile email offline_access User.Read Mail.Read";

/**
 * The OAuth "authority" path segment. Deliberately `organizations`, not
 * `common` — `common` also accepts personal Microsoft accounts (MSA),
 * which isn't the intent here; `organizations` restricts sign-in to
 * any work/school Entra tenant, the correct match for a school-issued
 * account authenticating against an app registered in a *different*
 * tenant (the household has no admin rights over the school's own
 * tenant, so the app registration necessarily lives elsewhere and must
 * be configured as multi-tenant — see INSTALL.md). `MICROSOFT_TENANT_ID`
 * lets this be pinned to one specific tenant later if ever wanted;
 * unset, it defaults to the multi-tenant `organizations` authority.
 */
function authority(): string {
  return serverEnv.MICROSOFT_TENANT_ID || "organizations";
}

function requireCredentials(): {
  clientId: string;
  clientSecret: string;
} {
  if (!serverEnv.MICROSOFT_CLIENT_ID || !serverEnv.MICROSOFT_CLIENT_SECRET) {
    throw new Error(
      "Microsoft email connection isn't configured yet — MICROSOFT_CLIENT_ID/MICROSOFT_CLIENT_SECRET aren't set.",
    );
  }
  return {
    clientId: serverEnv.MICROSOFT_CLIENT_ID,
    clientSecret: serverEnv.MICROSOFT_CLIENT_SECRET,
  };
}

/** The URL to redirect the browser to for Microsoft sign-in/consent. `redirectUri` and `state` must exactly match what `exchangeCodeForTokens` and the callback route's own CSRF check use. */
export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const { clientId } = requireCredentials();
  const url = new URL(
    `https://login.microsoftonline.com/${authority()}/oauth2/v2.0/authorize`,
  );
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);
  return url.toString();
}

export interface MicrosoftTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface TokenEndpointResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

async function callTokenEndpoint(
  body: Record<string, string>,
): Promise<MicrosoftTokens> {
  const { clientId, clientSecret } = requireCredentials();

  const response = await fetch(
    `https://login.microsoftonline.com/${authority()}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        ...body,
      }),
    },
  );

  const data = (await response.json()) as TokenEndpointResponse;

  if (!response.ok || !data.access_token || !data.refresh_token) {
    throw new Error(
      data.error_description ??
        data.error ??
        `Microsoft token request failed (${response.status})`,
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? 3600,
  };
}

/** Exchanges the callback's `code` for tokens. `redirectUri` must exactly match the one used to build the authorize URL — Microsoft rejects a mismatch. */
export function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<MicrosoftTokens> {
  return callTokenEndpoint({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    scope: SCOPES,
  });
}

/**
 * Mints a fresh access token from a stored refresh token. Microsoft's
 * v2.0 endpoint rotates refresh tokens on most (not guaranteed every)
 * call — the returned `refreshToken` here is the new one and MUST
 * replace whatever was stored, or it goes stale (see
 * `MicrosoftEmailConnectionService.getValidAccessToken`, the only
 * caller).
 */
export function refreshAccessToken(
  refreshToken: string,
): Promise<MicrosoftTokens> {
  return callTokenEndpoint({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: SCOPES,
  });
}
