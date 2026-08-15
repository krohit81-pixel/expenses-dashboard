# Testing Strategy

> The original pyramid below (unit/integration/component/e2e/security)
> was the target. **What's actually built and run today is the unit
> layer only**, via Vitest — no Playwright/e2e suite, no live two-user RLS
> integration harness (RLS isn't the live enforcement path — see doc 00),
> no component-interaction tests. This doc describes what's real.

## What's actually tested

- **Pure calculations and parsers** — the overwhelming majority of test
  coverage. Every statement-parser submodule
  (`amounts`, `parse-header`, `parse-transactions`, `classify-transaction`,
  `normalize-merchant`, `reconcile`) has a matching `.test.ts` with
  synthetic fixtures. Money math (`src/lib/money`), date/recurrence math
  (`src/lib/dates`), budget helpers (`src/lib/budget`), Intel chart-data
  prep (`src/lib/intel`), and the access-gate core all have direct unit
  coverage.
- **`supabase/tests/`** exists as a migration/RLS test harness run in CI
  against a disposable local Supabase instance — see its own README for
  scope. Per `INSTALL.md`'s troubleshooting notes, this documents the
  schema's own guarantees; it is a separate system from the live app's
  actual enforcement (which is the service-role client + explicit
  `OWNER_USER_ID` filtering, not RLS — doc 00).
- Run via `npm run test` (`vitest run`) locally/in CI; `npm run test:db`
  for the separate Supabase-backed suite (`vitest.config.db.ts`).

## Testing a pure helper that lives inside a server-only service file

`serverEnv`/`publicEnv` (`src/lib/env/server.ts`/`public.ts`) are parsed
eagerly at module import time (fail fast on boot) — so importing
anything that transitively imports either of them (most `src/services/*`
files do, via `src/lib/owner.ts` or `src/lib/supabase/service.ts`) throws
in plain Vitest before a single test runs, over env vars the test never
actually touches. Two things needed together to test a pure function
that happens to live in such a file (see
`MerchantMergeSuggestionService.test.ts`'s `splitCandidates`/
`parseSuggestions` tests for the full pattern):

```ts
vi.mock("server-only", () => ({})); // throws unconditionally outside a real Next.js build
vi.mock("@/lib/env/server", () => ({ serverEnv: { /* minimal valid fixture */ } }));
vi.mock("@/lib/env/public", () => ({ publicEnv: { /* minimal valid fixture */ } })); // only if the chain reaches this too
```

Export the pure function specifically for this (same reasoning as
`cycleMonthForStatementDate`, `guessCardAccountId`, etc. already being
exported plain functions) rather than trying to test it only through the
server-only function that calls it — that one still isn't unit-tested
directly (no precedent for mocking Supabase itself in this codebase; see
"What's actually tested" above), only its pure sub-logic is.

## Fixture hygiene (the one hard rule)

Parser fixtures are always synthetic, hand-built to mirror a real
statement's layout — never real personal financial data. When a fix
genuinely needs validating against real data, use a throwaway
`__scratch-*.test.ts` (see doc 08), confirm, then neuter it back to
`describe.skip` before committing.

## Verification pipeline (what actually gates a change)

```bash
npx tsc --noEmit
npx eslint .
npx prettier --check .
npx vitest run
```

All four green is the bar for "this change is verified" in this repo
today. A full `next build` is the one thing this can't confirm inside a
Cowork sandbox session (tool-call timeout — see doc 10); flag that
explicitly rather than treating the four commands above as proof a
production build would succeed.

## Explicitly not built yet

Playwright/e2e critical-path tests, component-interaction tests, a live
two-authenticated-user RLS proof (meaningless anyway while the service-role
client bypasses RLS), an accessibility scan step, and a dependency/security
scan step. Add these deliberately when the app's risk profile changes
(e.g. if it ever becomes genuinely multi-user again), not by default.
