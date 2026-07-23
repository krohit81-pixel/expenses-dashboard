# Current State — Read This First

Every other doc in this folder was written as a **pre-implementation target
architecture**, before any product code existed. The app has since been
built out substantially, and in a few places diverged from that original
target on purpose, after hitting real constraints. This doc is the
correction layer: what's actually true today, current as of **v1.8.0**
(July 2026). Read this before the numbered docs — where they conflict with
this one, this one is right.

The numbered docs still hold as a record of the original reasoning and are
kept updated where they remain accurate, but this file is the fast-start
orientation for a new session.

## What this app actually is

A private, **single-owner** personal finance dashboard — not a multi-tenant
product. There is no sign-up flow and no per-user data model in practice,
even though the database schema still has a `user_id` column on every
table (kept for FK integrity and because it was the original multi-user
design — see "Auth model" below for why it's unused as a real boundary).

Built on Next.js 15 (App Router, React 19, TypeScript strict), Supabase
Postgres (schema-only, no Supabase Auth sessions in the live app), Tailwind,
shadcn/ui, Zod, React Hook Form, Recharts, decimal.js, and pdf.js
(server-side PDF text extraction). Deployed to Vercel. See `INSTALL.md` at
the repo root for the actual setup/deploy steps and env var table — that
file is kept accurate release-to-release and is the install source of
truth, not this docs folder.

## Auth model (the biggest divergence from the original docs)

The original docs (02, 03, 11) describe Supabase Auth sign-in plus RLS
(`auth.uid() = user_id`) as the live enforcement boundary. **That is no
longer how this app works.** The actual model:

- One fixed "owner" `auth.users` row, created once via
  `npm run bootstrap:owner` (see `scripts/bootstrap-owner.mjs`). Its UUID
  lives in the `APP_OWNER_USER_ID` env var and is exported as
  `OWNER_USER_ID` from `src/lib/owner.ts`.
- Every service (`src/services/**`) reads and writes through
  `createServiceClient()` in `src/lib/supabase/service.ts` — a
  **service-role** client that **bypasses RLS entirely**. There is no
  per-request Supabase session at all.
- Because RLS is bypassed, it provides **no actual data isolation** today.
  Every service is individually responsible for filtering reads/updates/
  deletes by `user_id = OWNER_USER_ID` and setting it explicitly on every
  insert. The RLS policies and ownership triggers from the migrations are
  still correct and still present — they just aren't the thing standing
  between a request and the data.
- Instead of Supabase Auth, there's an app-level access gate:
  `src/lib/access-gate.ts`, an HMAC-signed cookie set once per browser
  after the visitor enters `APP_ACCESS_PASSWORD` (see
  `src/features/access-gate/`). `/calendar` is deliberately exempt (public,
  shareable without exposing financial data) — see `src/middleware.ts`.
  This was chosen specifically to avoid tripping Supabase's own sign-in
  rate limiting under concurrent mobile-Safari requests, which the earlier
  per-request-`signInWithPassword` design actually hit in production.

**Practical consequence:** when working on any service, filter by
`OWNER_USER_ID` explicitly — do not assume RLS is doing that job. When
touching `finance` migrations, RLS policies still belong there (they
document the intended per-user boundary and would matter again if this
ever became genuinely multi-user), but don't rely on them for anything the
app must actually enforce today.

## What's actually built

- **Ledger core**: accounts, institutions, categories, transactions
  (income/expense/transfer/split), recurring transactions, budgets,
  attachments, assets/liabilities/loans, net worth.
- **Credit card statement imports**: upload a PDF (password-protected or
  not), it's parsed deterministically (no LLM) into a structured statement
  + transaction rows, reconciled against the statement's own printed
  totals, and only saved if reconciliation passes. Three issuers today:
  **HDFC Infinia**, **Axis Horizon**, and **ICICI Amazon Pay** (v1.8.0 —
  see `src/services/statement-parsers/` and doc 06). ICICI's own summary
  block doesn't split "purchases" from "finance charges" the way HDFC/Axis
  do — see `icici-amazon/types.ts` for how that parser's header fields map
  onto the shared `credit_card_statements` columns anyway. An orphaned
  parser directory, `axis-atlas`, is a naming mistake from before the
  "Axis Horizon" rename and should be deleted by hand — it's untracked in
  git already.
- **Merchant Dictionary**: a shared, issuer-agnostic merchant/category
  resolution layer (`finance.merchants`, `finance.merchant_aliases`,
  `finance.atlas_categories`) that every statement parser feeds into, plus
  a `/merchants` admin UI for reviewing and re-categorizing.
- **Intel tab**: spending charts (by category, month-on-month, card-level
  breakdown by billing cycle) plus a single, button-triggered AI insight
  (Anthropic or Gemini — see doc 07) that's stored, not regenerated on
  every page load.
- **Calendar**: a static, in-code school calendar merged with user-entered
  travel (`finance.trips`) and calendar events — the one route that
  bypasses the access gate.
- **Budgets**: an income/fixed-expense planning view (not the older
  category-envelope model the very first design had — that was deleted,
  not hidden, per `INSTALL.md`'s v0.3 history).

## Repo orientation

```text
src/
  app/(app)/<route>/          # pages — thin, no business logic
  features/<feature>/
    api/                      # server actions (the real mutation surface — see doc 04)
    components/
  services/                   # server-only orchestration, one class per domain area
  services/statement-parsers/<issuer>/  # types, amounts, parse-header, parse-transactions,
                                          # classify-transaction, normalize-merchant, reconcile, index
  lib/                        # money (decimal.js-backed Money type), dates, env, pdf, intel, budget, owner, access-gate
supabase/migrations/          # append-only, one file per change, heavily commented with the "why"
docs/                         # this folder
INSTALL.md                    # actual setup/deploy instructions + release history (root, not here)
```

Every migration and most service/parser files have long, dated comments
explaining *why* a decision was made, not just what it does — read those
before re-deriving a decision from scratch. `docs/v1.5.0-reconstruction-guide.md`
is a large historical snapshot from the Merchant Dictionary build; useful
as an archive, not something to keep in sync going forward.

## Working conventions that matter immediately

- **Money** is never a raw number. Use the branded `Money` string type and
  helpers in `src/lib/money` (`addMoney`, `subtractMoney`, `sumMoney`,
  `parseMoney`, `dbNumberToMoney`, `moneyToDbNumber`, `ZERO`), backed by
  decimal.js. Never do arithmetic with `+`/`-` on amounts directly.
- **Statement parsers** follow one fixed module shape per issuer —
  `types.ts`, `amounts.ts`, `parse-header.ts`, `parse-transactions.ts`,
  `classify-transaction.ts`, `normalize-merchant.ts`, `reconcile.ts`,
  `index.ts` — each with a matching `.test.ts` using **synthetic fixtures
  only**. Never commit a test fixture built from a real personal
  statement; validate against real data in a throwaway scratch test, then
  neuter it back to an inert `describe.skip` stub before committing (see
  any `__scratch-*.test.ts` file for the pattern).
- **Reconciliation before persistence**: a statement's parsed transactions
  are summed and checked against the statement's own printed totals
  (`reconcile.ts`, relative tolerance) before the statement is allowed to
  save. If it doesn't reconcile, nothing is written — including no partial
  transaction rows.
- **Verification pipeline**, run before every commit:
  `npx tsc --noEmit`, `npx eslint .`, `npx prettier --check .`,
  `npx vitest run`. A full `next build` reliably cannot finish inside this
  sandbox's tool-call timeout (see "Sandbox constraints" below) — tell the
  user to confirm via a real Vercel deploy instead of claiming a build
  passed.
- **Versioning**: `APP_VERSION` in `src/lib/version.ts`, bumped with every
  release, shown in the app's own header. Commit messages follow
  `vX.Y.Z: <summary>` and match the version bump in the same commit.

## Sandbox constraints (specific to this Cowork environment)

These are environment facts, not app facts, but they change how you should
work here:

- **Files cannot be deleted, unlinked, or renamed** (`rm`, `fs.unlinkSync`,
  etc. all fail with `EPERM`). To retire a file's content, overwrite it
  (e.g. neuter a scratch test to `describe.skip`). To "rename" a
  directory, create the new one and use `git rm --cached -r
  --ignore-unmatch <old-path>` to stop tracking the old one — git still
  detects this as a rename in `git show --stat`. The old files remain as
  physical, untracked cruft; tell the user to delete them by hand.
- **A full `npm run build` cannot complete** inside a single tool call —
  it hits the timeout mid-compile, and background/`nohup` attempts get
  killed when the tool call's shell exits. Rely on the verification
  pipeline above instead, and say so explicitly when delivering a change.
- **Committing** uses a manual workflow, not plain `git commit`, because
  the sandbox can't always update `.git` the normal way:
  ```bash
  TMP_INDEX=$(mktemp)
  export GIT_INDEX_FILE="$TMP_INDEX"
  git read-tree HEAD
  git add <specific files>          # never `git add -A` — stage deliberately
  TREE=$(git write-tree)
  PARENT=$(git rev-parse HEAD)
  export GIT_AUTHOR_NAME="Atlas Delivery" GIT_AUTHOR_EMAIL="atlas-bot@local"
  export GIT_COMMITTER_NAME="Atlas Delivery" GIT_COMMITTER_EMAIL="atlas-bot@local"
  SHA=$(git commit-tree "$TREE" -p "$PARENT" -F <commit-message-file>)
  echo "$SHA" > .git/refs/heads/main
  cp "$TMP_INDEX" .git/index
  ```
  The user's real project folder is bind-mounted directly into this
  sandbox — there is no separate clone — so these commands mutate the
  user's actual repo in real time. Tell the user to `git push` themselves
  once done; this workflow doesn't push.
- **Personal data**: statement PDFs and extracted text the user shares are
  real financial data. Never let it end up in a committed test fixture or
  doc. Validate against it in a scratch test/file, confirm, then neuter or
  discard the scratch artifact.

## Where to look for more detail

- Root `INSTALL.md` — actual env vars, setup, deploy, and a running
  troubleshooting log of real production errors hit so far.
- `supabase/migrations/*.sql` — read the comments, not just the DDL; they
  carry most of the schema's design rationale.
- `docs/01` through `docs/12` — updated to match current reality where
  they hold, explicitly marked where they describe a still-pending future
  direction rather than what's built.
