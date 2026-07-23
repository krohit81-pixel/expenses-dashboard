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
