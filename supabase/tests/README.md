# Database tests

Tests here need a real Postgres instance with the `finance` schema applied —
they are not part of `npm test` (see vitest.config.ts vs vitest.config.db.ts).

## Running locally

```bash
npm run db:start   # starts a local Supabase stack via Docker, applies migrations
npm run test:db
npm run db:stop
```

`db:start` requires Docker to be running. It reads `supabase/config.toml` and
`supabase/migrations/*`, and never touches Vitals (the local stack is a
throwaway container, not a network connection to the hosted project).

## What's covered so far

`rls-isolation.test.ts` establishes the pattern — two impersonated users,
transaction-per-test with rollback — and proves it against `institutions` and
`accounts`:

- A user can read their own rows.
- A user cannot SELECT, UPDATE, or DELETE another user's rows.
- A user can create a row that references their own other rows.
- A user cannot create a row that references another user's row (the
  ownership triggers from `20260710000300_add_finance_integrity_guards.sql`,
  not just RLS, block this).

This is intentionally not exhaustive across all 21 tables yet. As each
feature service lands (Milestone 1+), extend this suite with the same
`asUser`/`asSuperuser` helpers rather than introducing a different pattern —
see docs/09-testing-strategy.md's "Database test requirements".

## A note on verification

This harness was written against the exact SQL in the applied migrations,
but has not been executed in the environment that produced it (no Docker
was available). Treat the first real `npm run test:db` run as a
verification step, not a formality — if `auth.uid()` resolution or the
`request.jwt.claims` GUC behaves differently than assumed here for your
Supabase CLI version, `asUser` in `setup.ts` is the one place to fix it.
