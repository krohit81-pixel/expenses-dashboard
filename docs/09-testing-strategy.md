# Testing Strategy

## What actually exists

Unit tests only, run via Vitest (`npm run test`). No component tests
(no React Testing Library), no E2E (no Playwright), no accessibility
scanning, no dependency/security scanning pipeline. This is
intentionally different from what earlier drafts of this document
described — that was aspirational for a larger team/timeline than
this project has had.

What *is* tested, and tested thoroughly: pure calculation and
date-math logic. As of the latest count, roughly 120 unit tests across
`src/lib/dates/*.test.ts`, `src/lib/money/*.test.ts`,
`src/lib/budget/*.test.ts`, `src/features/transactions/schemas.test.ts`,
and a few others. The Financial Cycle → Phase logic
(`src/lib/dates/phase.ts`) has the deepest coverage — boundary days,
month rollover, year rollover, and the three worked examples the whole
model was derived from, each asserted directly.

## What verification means in this project, concretely

Before any change is considered complete:

```bash
rm -rf .next && npm run format && npm run format:check && npm run typecheck && npm run lint && npm run test && npm run build
```

`npm run build` needs *some* env vars present even if they're
placeholders — env validation (`src/lib/env/*`) fails the build fast on
missing vars by design, which is useful for confirming the app is
structurally soundable but doesn't confirm it works against a real
Supabase project. See `docs/10-deployment-and-operations.md` for the
exact placeholder values used.

## A real, important limitation: no live Supabase in most sessions

Development sessions on this project have frequently had **no live
Supabase connection available** — no `supabase` CLI, no local Postgres
instance to run migrations against. This means:

- `npm run test:db` (the RLS/migration integration suite, run against a
  real local Supabase stack) **cannot be run locally** in that
  situation. It only actually executes in CI (`.github/workflows/ci.yml`'s
  `database-tests` job), which does have Docker + the Supabase CLI
  available via `supabase/setup-cli`.
- Migration SQL gets written and manually double-checked against
  existing migration patterns, but not executed locally before commit.
  Real validation happens when CI runs against the change.
- `src/lib/db/database-types.ts` can't be regenerated locally in that
  situation either — see `docs/08-engineering-standards.md`'s note on
  this.

If you have a working Supabase CLI and Docker in your session, use
them — run `supabase start`, `npm run db:reset`, `npm run test:db`, and
`npm run db:types` for real rather than working around their absence.
If you don't, say so explicitly rather than silently skipping database
verification, and lean more heavily on careful manual review of any
migration SQL against the existing four migrations' patterns.

## Existing test-fixture patterns worth reusing

Test files construct minimal fixture objects inline rather than using
shared factories — see `src/lib/budget/home-stats.test.ts`'s
`snapshot()` helper for the pattern: build the minimal valid shape,
override only what a given test cares about. One real bug this
approach caught: a helper that defaulted `incomeTotal`/
`fixedExpenseTotal` to `"0.00"` regardless of what array data was
passed in, silently making several tests pass for the wrong reason
until a new test that actually depended on the derived total exposed
it. When writing a fixture helper, derive totals from arrays rather
than hardcoding them, or the helper itself becomes a source of false
confidence.

## Release gate, as actually practiced

A change ships when: `format:check`, `typecheck`, `lint`, `test`
(local), and `build` all pass locally, and the change has been
committed with a message explaining the reasoning. `test:db` passing in
CI is the final confirmation for anything touching a migration —
treated as required, not advisory, even though it can't always be
run pre-commit.
