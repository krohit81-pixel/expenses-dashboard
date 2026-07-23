# Engineering Standards

## TypeScript and validation

- `strict` stays enabled. No `any`, non-null assertions, or casts to
  bypass uncertain data.
- Validate every external boundary with Zod: env vars (`src/lib/env`),
  form input, file uploads. Statement parsers validate shape via regex +
  explicit error classes instead (e.g. `AxisHeaderParseError`), since
  they're parsing unstructured PDF text, not a typed request body.
- Money is the branded `Money` decimal-string type
  (`src/lib/money/money.ts`), backed by decimal.js — never a raw
  `number`. Use `addMoney`/`subtractMoney`/`sumMoney`/`parseMoney`,
  `dbNumberToMoney`/`moneyToDbNumber` at the DB boundary, `ZERO` for the
  identity value. Never do `+`/`-` arithmetic on amount strings or
  `number`s directly.
- Database types are generated (`npm run db:types` →
  `src/lib/db/database-types.ts`) — don't hand-maintain duplicate row
  interfaces.

## Statement-parser module convention

Every issuer under `src/services/statement-parsers/<issuer>/` follows the
same file shape (see doc 06): `types.ts`, `amounts.ts`, `parse-header.ts`,
`parse-transactions.ts`, `classify-transaction.ts`, `normalize-merchant.ts`,
`reconcile.ts`, `index.ts`. Keep new issuers consistent with this rather
than inventing a per-issuer structure. A parser's only job is literal
extraction — merchant identity and category resolution happen later, in
the shared Merchant Dictionary, never hardcoded into a parser.

## Test fixture hygiene (important, enforced by convention not tooling)

- Parser test fixtures are **always synthetic** — hand-built text shaped
  like a real statement's layout, never real personal financial data.
- When a fix genuinely needs validating against a real statement (e.g. a
  reconciliation bug that only reproduces against actual numbers), do it
  in a throwaway `__scratch-*.test.ts` that reads real data from an
  absolute path outside the repo, confirm the fix, then overwrite the
  scratch file back to an inert `describe.skip` stub before committing.
  Never leave real data, or a path to it, in a committed file.

## Code rules

- Prefer small, pure functions for parsing/financial calculations; test
  them directly and exhaustively rather than through integration-only
  coverage.
- One source of truth per domain action: UI calls a server action: a
  server action calls a service; a service enforces the rule and talks to
  the DB. Don't duplicate a rule in a component.
- Explicit names: `occurredOn`, `currencyCode`, `cycleMonth`,
  `purchasesDebit` — avoid ambiguous `date`/`value`/`data`.
- No secrets or service-role access in client modules — enforced by the
  `server-only` import in every file that touches `serverEnv` or the
  service-role client (build fails if a client component imports one
  transitively).
- Comment the "why," not the "what" — this repo's migrations and parser
  modules lean heavily on dated, reasoned comments explaining a decision;
  match that convention rather than narrating obvious code.

## Verification pipeline (run before every commit)

```bash
npx tsc --noEmit
npx eslint .
npx prettier --check .
npx vitest run
```

A full `npm run build` reliably cannot finish inside a single Cowork
sandbox tool call (see doc 00/doc 10) — don't claim a build passed based
on this pipeline alone; say so explicitly and point the user to a real
Vercel deploy for that confirmation.

## Naming and commits

Lowercase kebab-case folders, PascalCase for components/types/service
classes (`CreditCardStatementService.ts`), camelCase for functions/
variables. Commit messages follow `vX.Y.Z: <summary>`, matching the
`APP_VERSION` bump (`src/lib/version.ts`) in the same commit — see doc 10
for the actual commit mechanics used in this sandbox.
