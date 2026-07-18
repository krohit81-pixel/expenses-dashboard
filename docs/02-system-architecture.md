# System Architecture

## Actual stack

Next.js 15 (App Router) + React 19 + TypeScript (strict) + Tailwind CSS
v3 + Supabase (Postgres only — Auth and Storage are provisioned but
barely used, see below) + Zod + `decimal.js`-backed money handling.
Deployed on Vercel. Single Supabase project, referred to in comments
and docs as "Vitals."

There is **no separate backend** and **no conventional REST/GraphQL
API** beyond one route handler (`src/app/api/attachments/[id]/download`,
for signed attachment URLs). Everything else is Next.js Server
Components reading data directly and Server Actions (`"use server"`
functions in each feature's `api/actions.ts`) handling mutations. If
`docs/04-api-design.md` reads as describing something more elaborate,
that's aspirational language from before the actual build — the real
pattern is simpler and is documented accurately there now.

## Auth model — read this before touching anything access-related

There is no sign-up, no per-visitor session, and no real Supabase Auth
usage for the app's own data. Every request runs as a single fixed
"owner" account (`OWNER_USER_ID`, from `src/lib/owner.ts`, matching
`APP_OWNER_USER_ID` in env). All server-side Supabase calls use the
**service-role client** (`src/lib/supabase/service.ts`), which bypasses
Row Level Security entirely. RLS policies exist in the migrations, but
nothing in the app's actual request path is subject to them — they'd
only matter if something started using the anon/authenticated client
directly, which nothing currently does.

Access is gated by a **single shared password**, not Supabase Auth:
`src/middleware.ts` checks an HMAC-signed cookie
(`src/lib/access-gate.ts`, pure crypto logic split out into
`src/lib/access-gate-core.ts` so it's unit-testable without
`server-only`). `/calendar` is deliberately public — meant to be
shareable without exposing financial data. Everything else redirects to
`/login` without a valid cookie.

An earlier version of this middleware called
`supabase.auth.signInWithPassword` on every uncookied request. That
broke in practice: concurrent requests from the same browser (mobile
Safari's prefetching, specifically) triggered multiple simultaneous
sign-in attempts, which tripped Supabase's own rate limiting. The fix
was removing Supabase Auth from the request path entirely, not fixing
the rate-limit trigger. Don't reintroduce a per-request Auth call
without re-reading that history in the middleware's own comments.

## Layer boundaries

| Layer | Responsibility | Notes |
|---|---|---|
| `src/app/(app)/<route>/page.tsx` | Server Component: fetch via services, render. | Auth-gated routes live under the `(app)` route group; its `layout.tsx` calls `requireUser()` and renders the nav shell. |
| `src/features/<feature>/` | Feature-owned Zod schemas (`schemas.ts`), Server Actions (`api/actions.ts`), and feature-specific client components. | Components needing interactivity are `"use client"`; the schema is the single validation boundary for that feature's mutations. |
| `src/services/` | Server-only functions doing the actual Supabase reads/writes. Marked `import "server-only"`. | This is where business logic actually lives — e.g. `BudgetSnapshotService.getMonthlyBudgetSnapshot()`, not a route handler or a component. |
| `src/lib/` | Cross-cutting infra: money (`lib/money`), dates (`lib/dates`), auth (`lib/access-gate*`, `lib/auth`), Supabase clients (`lib/supabase`), env validation (`lib/env`). | `lib/dates/phase.ts` specifically is where the Financial Cycle → Phase math lives — see `docs/01-product-vision.md`. |
| `src/components/ui/` | Shared presentational primitives (Hero, SplitCard, Spinner, form inputs). | Not feature-specific; used across pages. |

## Real repository structure

```text
src/
  app/
    (app)/                # auth-gated routes, shared nav shell in layout.tsx
      dashboard/           # "Home" — phase-aware cycle view (route kept as
                            # /dashboard; nav label is "Home")
      transactions/
      budgets/
      recurring/
      accounts/
      net-worth/
      calendar/            # PUBLIC route — no password gate
      more/                # settings/nav hub, includes ThemeToggle
      settings/
      imports/              # placeholder only, not built
      intel/                 # placeholder only, not built
      onboarding/
    api/attachments/[attachmentId]/download/route.ts   # the one real API route
    layout.tsx              # ROOT layout — fonts + globals.css + theme-detection
                             # script ONLY. Must never contain nav/shell code
                             # (see its own comment for the historical bug this
                             # caused when violated).
    globals.css              # design tokens, light + dark
  components/ui/            # shared primitives
  features/<feature>/
    schemas.ts               # Zod validation for that feature's mutations
    api/actions.ts           # Server Actions
    components/               # feature-specific client/server components
  services/                  # server-only Supabase orchestration, one file per domain
  lib/
    money/                    # Money type, arithmetic, formatting — see below
    dates/                    # month.ts, phase.ts, recurrence.ts
    supabase/                  # client.ts (browser), service.ts (service-role)
    access-gate*.ts, auth/     # the password-gate mechanism
    env/                       # Zod-validated env access (public.ts, server.ts)
    db/database-types.ts       # Supabase-generated types (see note below)
supabase/
  migrations/                 # append-only, see docs/03-database-design.md
docs/                          # this folder
```

## Money handling

Every monetary value is a branded string type (`Money`, from
`src/lib/money/money.ts`), backed by `decimal.js` for arithmetic —
never a JavaScript `number` for anything that gets summed, compared, or
stored. `zMoney` (the Zod schema) is deliberately lenient on *input*
(accepts `"202000"`, strips commas/whitespace) but always normalizes to
a canonical 2-decimal string. `formatMoneyDisplay` handles currency
formatting for the UI layer. If you find yourself writing
`Number(someMoneyValue) + Number(otherMoneyValue)`, stop — use
`addMoney`/`sumMoney`/`negateMoney` instead; several bugs this project
hit were exactly this shortcut.

## A generated-types caveat worth knowing before you touch the schema

`src/lib/db/database-types.ts` is supposed to be generated via
`npm run db:types` (`supabase gen types typescript --schema finance`).
Development sessions on this project have not reliably had a live
Supabase connection available, so at least one migration
(`20260714000100_add_transaction_cycle_month.sql`) shipped with this
file **hand-edited** to match what codegen would have produced, rather
than actually regenerated. CI has an informational (non-blocking) job
that diffs the committed file against real codegen output specifically
to catch drift like this. If you have real Supabase CLI access in this
session, run `npm run db:types` for real after any migration and stop
relying on hand-edits — but if you don't, hand-editing carefully and
flagging it explicitly (as prior commits did) is the fallback, not a
silent shortcut.

## What doesn't exist, despite being planned in early docs

Earlier versions of `docs/02` through `docs/07` described an
aspirational architecture — multi-user RLS enforcement, a
`BudgetService`, an `ImportService`, an `AssistantService`, worker/
scheduled jobs, staging environments, Playwright E2E. **None of that
was built.** The docs have been rewritten to describe what's actually
here. If you're reading an old cached version of these docs somewhere,
distrust anything describing a service or table not confirmed present
in `src/services/` or referenced by real code — check the actual repo,
not the aspiration.
