import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asUser, closePool, createTestUser, deleteTestUser } from "./setup";

/**
 * Exercises the two isolation mechanisms docs/11-security-and-privacy.md
 * requires in combination: RLS policies (`auth.uid() = user_id`) AND the
 * ownership triggers from migration 20260710000300 (RLS alone doesn't stop
 * one user's row from referencing another user's row by id).
 *
 * Run with `npm run db:start` then `npm run test:db`. Requires a local
 * Supabase Postgres instance — see supabase/tests/setup.ts.
 */
describe("finance schema RLS isolation", () => {
  const userA = randomUUID();
  const userB = randomUUID();

  beforeAll(async () => {
    await createTestUser(userA, `test-a-${userA}@example.test`);
    await createTestUser(userB, `test-b-${userB}@example.test`);
  });

  afterAll(async () => {
    await deleteTestUser(userA);
    await deleteTestUser(userB);
    await closePool();
  });

  it("lets a user read their own institution", async () => {
    const institutionId = await asUser(userA, async (client) => {
      const result = await client.query<{ id: string }>(
        "insert into institutions (name) values ('Test Bank A') returning id",
      );
      return result.rows[0].id;
    });

    const visible = await asUser(userA, async (client) => {
      return client.query("select id from institutions where id = $1", [
        institutionId,
      ]);
    });

    expect(visible.rowCount).toBe(1);
  });

  it("hides one user's institution from another user's SELECT", async () => {
    const institutionId = await asUser(userA, async (client) => {
      const result = await client.query<{ id: string }>(
        "insert into institutions (name) values ('Test Bank A2') returning id",
      );
      return result.rows[0].id;
    });

    const visibleToOther = await asUser(userB, async (client) => {
      return client.query("select id from institutions where id = $1", [
        institutionId,
      ]);
    });

    expect(visibleToOther.rowCount).toBe(0);
  });

  it("does not let one user UPDATE or DELETE another user's row", async () => {
    const institutionId = await asUser(userA, async (client) => {
      const result = await client.query<{ id: string }>(
        "insert into institutions (name) values ('Test Bank A3') returning id",
      );
      return result.rows[0].id;
    });

    const updateResult = await asUser(userB, async (client) => {
      return client.query(
        "update institutions set name = 'Hijacked' where id = $1",
        [institutionId],
      );
    });
    expect(updateResult.rowCount).toBe(0);

    const deleteResult = await asUser(userB, async (client) => {
      return client.query("delete from institutions where id = $1", [
        institutionId,
      ]);
    });
    expect(deleteResult.rowCount).toBe(0);
  });

  it("allows referencing your own institution from an account", async () => {
    const institutionId = await asUser(userA, async (client) => {
      const result = await client.query<{ id: string }>(
        "insert into institutions (name) values ('Test Bank A4') returning id",
      );
      return result.rows[0].id;
    });

    const accountResult = await asUser(userA, async (client) => {
      return client.query(
        `insert into accounts (institution_id, name, account_type, currency_code)
         values ($1, 'Checking', 'checking', 'USD') returning id`,
        [institutionId],
      );
    });

    expect(accountResult.rowCount).toBe(1);
  });

  it("blocks referencing another user's institution from an account", async () => {
    const institutionId = await asUser(userA, async (client) => {
      const result = await client.query<{ id: string }>(
        "insert into institutions (name) values ('Test Bank A5') returning id",
      );
      return result.rows[0].id;
    });

    await expect(
      asUser(userB, async (client) => {
        return client.query(
          `insert into accounts (institution_id, name, account_type, currency_code)
           values ($1, 'Hijack Checking', 'checking', 'USD')`,
          [institutionId],
        );
      }),
    ).rejects.toThrow();
  });
});
