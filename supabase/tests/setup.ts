import { Pool, type PoolClient } from "pg";

/**
 * Points at the local Supabase Postgres instance by default (the port
 * `supabase start` prints as "DB URL"). Override with TEST_DATABASE_URL to
 * point at a CI-provisioned instance instead. This must never point at
 * Vitals — these tests create and roll back throwaway auth.users rows.
 */
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

let pool: Pool | null = null;

function getPool(): Pool {
  pool ??= new Pool({ connectionString: TEST_DATABASE_URL });
  return pool;
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = null;
}

/**
 * Runs `fn` inside a transaction impersonating `userId` the way PostgREST
 * does for a real request: as the `authenticated` role, with `auth.uid()`
 * resolving to `userId` via the `request.jwt.claims` GUC.
 *
 * Commits on success, rolls back on error. Tests that create a row in one
 * asUser() call and read/reference it in a later asUser() call within the
 * same test rely on that commit — an earlier version of this helper always
 * rolled back "for isolation," which silently discarded every write before
 * the next call could see it (surfaced as spurious "0 rows found" and
 * "referenced record must belong to the same user" failures that had
 * nothing to do with the actual RLS policies or ownership triggers being
 * tested). Test isolation instead comes from each test file's afterAll
 * deleting its test users, which cascades to every row they own.
 *
 * Does NOT create the auth.users row — callers that need auth.uid() to
 * resolve to a row with a real FK target should call `createTestUser` first
 * (see rls-isolation.test.ts) as the postgres superuser, outside this
 * transaction, since finance.* FKs reference auth.users(id).
 */
export async function asUser<T>(
  userId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    await client.query("set local search_path to finance, public");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Runs `fn` as the postgres superuser (bypasses RLS entirely). Use only for
 * fixture setup (creating auth.users rows) — never to assert product
 * behavior, since it proves nothing about RLS.
 */
export async function asSuperuser<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/**
 * Creates a minimal auth.users row so finance.* FK constraints on user_id
 * are satisfiable, and immediately schedules its (cascading) deletion via
 * the caller's own cleanup — see rls-isolation.test.ts's afterEach.
 */
export async function createTestUser(id: string, email: string): Promise<void> {
  await asSuperuser(async (client) => {
    await client.query(
      `insert into auth.users (id, email, aud, role, encrypted_password, email_confirmed_at, created_at, updated_at)
       values ($1, $2, 'authenticated', 'authenticated', '', now(), now(), now())
       on conflict (id) do nothing`,
      [id, email],
    );
  });
}

export async function deleteTestUser(id: string): Promise<void> {
  await asSuperuser(async (client) => {
    // Cascades to every finance.* row owned by this user via
    // `references auth.users(id) on delete cascade`.
    await client.query("delete from auth.users where id = $1", [id]);
  });
}
