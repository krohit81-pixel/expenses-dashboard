# Engineering Standards

## TypeScript and validation

- `strict` mode stays on. No `any`, no non-null assertions, no casts to
  bypass uncertain data.
- Every external boundary is validated with Zod: form inputs (via
  `FormData` in Server Actions), environment variables
  (`src/lib/env/public.ts`, `src/lib/env/server.ts`), route params.
- Money is always the branded `Money` string type from
  `src/lib/money/money.ts`, backed by `decimal.js`. Never a raw
  `number` for anything summed, compared, or persisted. `zMoney` is
  lenient on input format, strict on normalized output — see
  `docs/02-system-architecture.md`.
- `src/lib/db/database-types.ts` is meant to be generated
  (`npm run db:types`), not hand-maintained — see that same doc's note
  about the one migration where this had to be hand-edited due to no
  live Supabase connection in-session, and why that's a documented
  fallback, not a default practice.

## Code organization rules actually followed

- Pure, testable logic gets extracted and tested in isolation before
  being wired into a component — `lib/dates/phase.ts`,
  `lib/dates/month.ts`, `lib/budget/home-stats.ts` are all pure
  functions with their own test files, callable from both Server
  Components and (via type-only imports where the source is
  `server-only`) client-side test files without touching a database.
- Duplication gets caught and extracted, not tolerated as "good
  enough for now" — `computeProjectedClosing` was extracted from a
  duplicate inline function once Budgets and Home both needed the
  exact same math; `SplitCard` was extracted once a third page needed
  the same card-with-total shell Budgets already had inline. When you
  notice yourself copying logic a second time, that's the signal to
  extract, not to copy a third time later.
- Comments explain *why*, especially for non-obvious financial,
  date-math, or security decisions (see almost any file touched
  during the Financial Cycle → Phase work for examples) — not
  restating what the code already says.

## Naming

`occurredOn`, `cycleMonth`, `currencyCode` — explicit, not `date`/
`value`/`data`. Lowercase kebab-case folders, PascalCase components/
types, camelCase functions/variables.

## The verification sequence — non-negotiable before any commit

Every change, no matter how small, gets verified in this order before
being considered done:

```bash
rm -rf .next
npm run format
npm run format:check
npm run typecheck
npm run lint
npm run test
npm run build     # needs placeholder env vars if no real Supabase project
                   # is configured — see docs/10-deployment-and-operations.md
```

This has held even for one-line fixes throughout this project's
history. A change that "obviously can't have broken anything" has, in
practice, broken something else in this codebase more than once
(stale imports after removing a function, a test asserting the old
default after a schema default changed, etc.) — running the full
sequence catches this before it ships, not after.

If a real Supabase connection isn't available in the current session
(a `test:db` requirement — see `docs/09-testing-strategy.md`), that's
a known, documented limitation, not something to work around by
skipping the check silently. Say so explicitly.

## Pull request / commit standard

Commits are self-contained and explain *why*, not just *what* —
several commit messages in this project's history are longer than the
diff itself, because the reasoning (why a formula changed, why a
default flipped, what real report prompted the fix) matters more for
future readers than the mechanical change. Match that standard, not a
one-line "fix bug" message.
