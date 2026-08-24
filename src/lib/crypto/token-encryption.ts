import "server-only";

import { createHash } from "node:crypto";

import { serverEnv } from "@/lib/env/server";
import { encryptWithKey, decryptWithKey } from "@/lib/crypto/aes-gcm";

/**
 * v3.4.12 — the first real encryption-at-rest this app has ever
 * needed. Every "secret" stored in Supabase before this (a Telegram
 * chat ID, a web push subscription's own auth keys, in
 * finance.notification_channels' plain `config` JSON column) has been
 * plain text, relying only on the service-role client's own access
 * control — none of it was sensitive enough on its own to warrant
 * actual encryption. A Microsoft mailbox refresh token is: it's a
 * standing credential to read a real person's real email, so it's
 * encrypted before it ever touches the database.
 *
 * The actual AES-256-GCM logic lives in `aes-gcm.ts` (no
 * `server-only`/`serverEnv` dependency there, so it stays unit-
 * testable) — this file's only job is supplying the derived key.
 *
 * Key = SHA-256 digest (already exactly 32 bytes, used directly, no
 * truncation) of `APP_SESSION_SECRET` + a fixed suffix — the same
 * "derive a scoped key from the existing master secret rather than add
 * a new required env var" precedent `src/lib/ahaana-gate.ts` already
 * established for its own signing key.
 *
 * Operational note, not a bug: rotating `APP_SESSION_SECRET` changes
 * this derived key too, which makes every already-stored refresh token
 * permanently undecryptable. That's an acceptable, understood
 * consequence — the fix is simply reconnecting the mailbox (see
 * `decryptSecret`'s own comment below), not data recovery, since a
 * refresh token has no other value once it can't be read back.
 */
const ENCRYPTION_KEY = createHash("sha256")
  .update(`${serverEnv.APP_SESSION_SECRET}:ms-token-encryption`)
  .digest();

/** Encrypts a Microsoft refresh token (in practice) for storage — see `aes-gcm.ts`'s own comment for the exact format. */
export function encryptSecret(plaintext: string): string {
  return encryptWithKey(ENCRYPTION_KEY, plaintext);
}

/**
 * Reverses `encryptSecret`. Throws on any failure. Callers (see
 * `MicrosoftEmailConnectionService.getValidAccessToken`) must treat a
 * thrown error here as "this connection needs to be re-authorized,"
 * not a crash — the two realistic causes are `APP_SESSION_SECRET`
 * having been rotated since this token was stored, or genuinely
 * corrupted data, and both have the same fix: reconnect.
 */
export function decryptSecret(encrypted: string): string {
  return decryptWithKey(ENCRYPTION_KEY, encrypted);
}
