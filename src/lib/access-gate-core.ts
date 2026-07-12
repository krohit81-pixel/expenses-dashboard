import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Timing-safe string comparison. Compares SHA-256-sized HMACs of both
 * inputs rather than the raw strings — timingSafeEqual throws if the two
 * buffers aren't the same length, which raw strings of different lengths
 * would violate; hashing first normalizes that away.
 */
export function timingSafeStringEqual(
  secret: string,
  a: string,
  b: string,
): boolean {
  const hashA = Buffer.from(sign(secret, a));
  const hashB = Buffer.from(sign(secret, b));
  return timingSafeEqual(hashA, hashB);
}

export function createSignedToken(
  secret: string,
  durationMs: number = SESSION_DURATION_MS,
): string {
  const expiresAt = Date.now() + durationMs;
  const signature = sign(secret, String(expiresAt));
  return `${expiresAt}.${signature}`;
}

export function verifySignedToken(
  secret: string,
  token: string | undefined,
): boolean {
  if (!token) return false;

  const [expiresAtStr, signature] = token.split(".");
  if (!expiresAtStr || !signature) return false;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  const expected = Buffer.from(sign(secret, expiresAtStr));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length) return false;

  return timingSafeEqual(expected, actual);
}
