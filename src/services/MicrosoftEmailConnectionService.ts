import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { OWNER_USER_ID } from "@/lib/owner";
import { withAuthTimingRetry } from "@/lib/supabase/retry";
import { encryptSecret, decryptSecret } from "@/lib/crypto/token-encryption";
import { refreshAccessToken } from "@/lib/microsoft/oauth";

/**
 * v3.4.12 — the Microsoft Graph mailbox connection this proof of
 * concept needs: read-only status for the "Connected —
 * ahaana.kohli@cns.ac.in" display, saving a new connection after the
 * OAuth callback succeeds, and minting a fresh access token from the
 * stored (encrypted) refresh token whenever "Test Mailbox Connection"
 * is clicked. `OWNER_USER_ID`-filtered on every query, same convention
 * as every other service (this app has no per-user session — see
 * src/lib/owner.ts).
 *
 * Deliberately does NOT store the access token at all — it's
 * short-lived (~1h) and this is a manual, click-a-button flow, so
 * minting a fresh one per call (one extra token-endpoint round trip)
 * is simpler than tracking expiry for a cached one.
 */

export interface MicrosoftEmailConnection {
  emailAddress: string;
  connectedAt: string;
}

const TABLE = "ahaana_ms_email_connections";
const PROVIDER = "microsoft";

/** Read-only status for display — never decrypts the stored token, since the page doesn't need it. */
export async function getConnection(): Promise<MicrosoftEmailConnection | null> {
  const supabase = createServiceClient();
  const { data, error } = await withAuthTimingRetry(() =>
    supabase
      .from(TABLE)
      .select("email_address, created_at")
      .eq("user_id", OWNER_USER_ID)
      .eq("provider", PROVIDER)
      .maybeSingle(),
  );

  if (error) {
    throw new Error(
      `Failed to load Microsoft email connection: ${error.message}`,
    );
  }
  if (!data) return null;

  return { emailAddress: data.email_address, connectedAt: data.created_at };
}

/** Called once, right after the OAuth callback successfully exchanges a code for tokens. Encrypts the refresh token before it ever touches the database. */
export async function saveConnection(
  emailAddress: string,
  refreshToken: string,
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: OWNER_USER_ID,
      provider: PROVIDER,
      email_address: emailAddress,
      encrypted_refresh_token: encryptSecret(refreshToken),
    },
    { onConflict: "user_id,provider" },
  );

  if (error) {
    throw new Error(
      `Failed to save Microsoft email connection: ${error.message}`,
    );
  }
}

/**
 * Custom error type so callers (the "Test Mailbox Connection" server
 * action) can show "connection expired, reconnect" specifically,
 * rather than a generic failure message, when that's actually what
 * happened.
 */
export class MicrosoftConnectionExpiredError extends Error {
  constructor() {
    super("The school email connection has expired — reconnect it.");
    this.name = "MicrosoftConnectionExpiredError";
  }
}

/**
 * Decrypts the stored refresh token, exchanges it for a fresh access
 * token, and — critically — re-encrypts and persists whatever NEW
 * refresh token Microsoft returned alongside it (their v2.0 endpoint
 * rotates refresh tokens on most calls; failing to persist the new one
 * means the next call uses a now-stale token and fails). Fails closed:
 * a decrypt failure (e.g. APP_SESSION_SECRET rotated since this token
 * was stored) or a rejected refresh (revoked/expired token — plausible
 * on a school-managed tenant with aggressive token-lifetime policy)
 * both surface as `MicrosoftConnectionExpiredError`, not an unhandled
 * throw.
 */
export async function getValidAccessToken(): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("encrypted_refresh_token")
    .eq("user_id", OWNER_USER_ID)
    .eq("provider", PROVIDER)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load Microsoft email connection: ${error.message}`,
    );
  }
  if (!data) {
    throw new MicrosoftConnectionExpiredError();
  }

  let storedRefreshToken: string;
  try {
    storedRefreshToken = decryptSecret(data.encrypted_refresh_token);
  } catch {
    throw new MicrosoftConnectionExpiredError();
  }

  let tokens;
  try {
    tokens = await refreshAccessToken(storedRefreshToken);
  } catch {
    throw new MicrosoftConnectionExpiredError();
  }

  const { error: updateError } = await supabase
    .from(TABLE)
    .update({ encrypted_refresh_token: encryptSecret(tokens.refreshToken) })
    .eq("user_id", OWNER_USER_ID)
    .eq("provider", PROVIDER);

  if (updateError) {
    // The fresh access token is still good for this one call even if
    // persisting the rotated refresh token failed — return it rather
    // than failing the whole operation, but this is a real problem
    // worth surfacing loudly (the NEXT call may fail once Microsoft
    // invalidates the old refresh token this rotation was meant to
    // replace).
    console.error(
      `Failed to persist rotated Microsoft refresh token: ${updateError.message}`,
    );
  }

  return tokens.accessToken;
}
