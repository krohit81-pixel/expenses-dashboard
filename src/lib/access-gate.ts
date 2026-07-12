import "server-only";

import { serverEnv } from "@/lib/env/server";
import {
  createSignedToken,
  timingSafeStringEqual,
  verifySignedToken,
} from "@/lib/access-gate-core";

export const ACCESS_COOKIE_NAME = "app_access";

/** Checks a submitted password against APP_ACCESS_PASSWORD. See access-gate-core.ts for the actual (tested) comparison logic. */
export function checkAccessPassword(submitted: string): boolean {
  return timingSafeStringEqual(
    serverEnv.APP_SESSION_SECRET,
    serverEnv.APP_ACCESS_PASSWORD,
    submitted,
  );
}

/** Creates a signed cookie value good for 30 days from now. */
export function createAccessToken(): string {
  return createSignedToken(serverEnv.APP_SESSION_SECRET);
}

/** Verifies a cookie value: correct signature, and not expired. */
export function verifyAccessToken(token: string | undefined): boolean {
  return verifySignedToken(serverEnv.APP_SESSION_SECRET, token);
}
