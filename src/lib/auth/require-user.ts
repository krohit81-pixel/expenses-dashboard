import "server-only";

import { OWNER_USER_ID } from "@/lib/owner";

/**
 * There is no session and no sign-in flow (see src/middleware.ts and
 * src/lib/owner.ts) — every request runs as the same fixed owner. This
 * keeps the shape pages were already using (`const user = await
 * requireUser(); ... user.id`) so call sites didn't need to change when
 * the auth architecture did, but it's not actually checking anything
 * anymore; it's a fixed value.
 */
export async function requireUser(): Promise<{ id: string }> {
  return { id: OWNER_USER_ID };
}
