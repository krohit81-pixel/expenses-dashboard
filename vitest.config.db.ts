import { defineConfig } from "vitest/config";

/**
 * Separate config for tests that need a real Postgres instance (RLS,
 * ownership triggers, migration behavior). Run with `npm run test:db`
 * after `npm run db:start`, or in CI where the Supabase CLI can start a
 * disposable local stack. Kept out of `npm test` so the fast unit suite
 * never silently depends on Docker being available.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["supabase/tests/**/*.test.ts"],
    // RLS tests share one Postgres connection pool and rely on transaction
    // rollback for isolation between cases — run them serially, not in
    // parallel workers, to avoid cross-test interference.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
