import "server-only";

import { serverEnv } from "@/lib/env/server";
import {
  createSignedToken,
  timingSafeStringEqual,
  verifySignedToken,
} from "@/lib/access-gate-core";

export const AHAANA_ACCESS_COOKIE_NAME = "ahaana_access";

/**
 * v3.4.0 — Ahaana's own gate, mirroring src/lib/access-gate.ts almost
 * exactly, but deliberately NOT signed with the raw APP_SESSION_SECRET
 * the main gate uses. access-gate-core.ts's sign/createSignedToken/
 * verifySignedToken only ever check a token's HMAC signature — they
 * carry no notion of "which gate issued this," so reusing the exact
 * same secret for both would mean a valid `app_access` cookie value,
 * if copied into the `ahaana_access` slot, would ALSO verify
 * successfully (same key, same signature scheme) — precisely the
 * "her password should be the only key that works there" guarantee
 * this gate exists to provide, broken. `AHAANA_SIGNING_KEY` derives a
 * cryptographically distinct HMAC key from the same
 * APP_SESSION_SECRET via a fixed suffix (no new env var needed — an
 * HMAC key with a different input produces an unrelated output,
 * standard key-separation practice), so a token signed for one gate
 * can never validate against the other.
 */
const AHAANA_SIGNING_KEY = `${serverEnv.APP_SESSION_SECRET}:ahaana-gate`;

/**
 * Checks a submitted password against AHAANA_ACCESS_PASSWORD. Always
 * false when that env var isn't set yet (optional at the schema
 * level — see server.ts's comment) — refuses every attempt rather
 * than ever comparing against an empty/undefined password.
 */
export function checkAhaanaAccessPassword(submitted: string): boolean {
  if (!serverEnv.AHAANA_ACCESS_PASSWORD) return false;
  return timingSafeStringEqual(
    AHAANA_SIGNING_KEY,
    serverEnv.AHAANA_ACCESS_PASSWORD,
    submitted,
  );
}

/** Creates a signed cookie value good for 30 days from now — same duration as the main access-gate cookie. */
export function createAhaanaAccessToken(): string {
  return createSignedToken(AHAANA_SIGNING_KEY);
}

/** Verifies a cookie value: correct signature (under the ahaana-specific derived key, not the main gate's), and not expired. */
export function verifyAhaanaAccessToken(token: string | undefined): boolean {
  return verifySignedToken(AHAANA_SIGNING_KEY, token);
}
