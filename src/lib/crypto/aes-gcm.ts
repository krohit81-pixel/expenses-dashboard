/**
 * v3.4.12 — plain AES-256-GCM encrypt/decrypt against an arbitrary
 * 32-byte key, with no dependency on `serverEnv`/`server-only`. Kept
 * separate from `token-encryption.ts` (which supplies the actual
 * derived key from `APP_SESSION_SECRET`) purely so this pure logic is
 * unit-testable — `server-only` throws at import time outside a real
 * Next.js build, same reason `optional-string.ts` was split out from
 * `env/server.ts` for testing.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
// 96 bits — the standard IV size AES-GCM implementations are built
// around, not the 128-bit size some other block-cipher modes use.
const IV_LENGTH = 12;

/**
 * Encrypts `plaintext` into a single string safe to store in a text
 * column: base64(iv) + "." + base64(authTag) + "." +
 * base64(ciphertext). A fresh random IV every call, per GCM's own
 * requirement (reusing an IV with the same key catastrophically
 * breaks GCM's confidentiality guarantee).
 */
export function encryptWithKey(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

/**
 * Reverses `encryptWithKey`. Throws on any failure (malformed input,
 * wrong key, tampered ciphertext — GCM's auth tag check fails closed)
 * rather than returning something silently wrong.
 */
export function decryptWithKey(key: Buffer, encrypted: string): string {
  const parts = encrypted.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted value");
  }
  const [ivPart, authTagPart, ciphertextPart] = parts;
  const iv = Buffer.from(ivPart, "base64");
  const authTag = Buffer.from(authTagPart, "base64");
  const ciphertext = Buffer.from(ciphertextPart, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
