import "server-only";

import { serverEnv } from "@/lib/env/server";

/**
 * The single user_id every row in the finance schema belongs to. With no
 * session/sign-in flow, there's no auth.uid() to default to or filter by —
 * every service must explicitly write and filter on this constant instead.
 * See scripts/bootstrap-owner.mjs for how the underlying auth.users row
 * gets created, and docs/03-database-design.md's note on why user_id
 * still has to reference a real auth.users row even without a login flow
 * (the schema's FK constraints require it).
 */
export const OWNER_USER_ID = serverEnv.APP_OWNER_USER_ID;
