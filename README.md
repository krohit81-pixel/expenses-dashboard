# Atlas

A private, single-owner personal finance app for one household — built on
Next.js and Supabase, deployed on Vercel. Not a template or a multi-tenant
product; it's tuned to one family's real accounts, cards, and calendar.

**Setup:** see [INSTALL.md](./INSTALL.md) for environment variables,
local development, and Vercel deployment. **For anything about how the
app actually works today** — what's built, the real auth model, working
conventions — see [docs/00-current-state.md](./docs/00-current-state.md),
not the numbered docs under `docs/` (those describe the original
pre-implementation target design; doc 00 is the kept-current correction
layer, and wins wherever they disagree).

## What it does

- **Dashboard** — this cycle's income/expenses/net at a glance, an
  interactive Expenses/Income split (mark paid, edit, delete inline), a
  Balance section (what's still owed vs. a manually-kept account
  balance), and a one-tap "repeat last cycle" for anything that recurs.
- **Log** — add/edit/delete a transaction and tag it to a cycle,
  correct an account balance, or import a credit card statement PDF.
- **Intel** — spending charts by category and by card, month-on-month
  trends, and a button-triggered AI commentary (cash flow, plus a
  credit-card-spending callout) via Anthropic or Gemini.
- **Calendar** — the one public, password-free page: a shared family
  calendar merging a static school calendar, booked trips, one-off
  events, and weekly-repeating recurring events (classes, etc.), with
  optional Telegram reminders.
- **Credit card statement imports** — upload a password-protected PDF
  from any of six card products across three issuers; it's parsed
  deterministically (no LLM), reconciled against the statement's own
  printed totals, and only saved if reconciliation passes. Feeds a
  shared Merchant Dictionary (with AI-suggested merge suggestions) used
  across the whole app.
- **Ahaana's mini app** (`/ahaana/*`) — a fully separate, separately
  password-gated section for the household's daughter: her own weekly
  activity schedule, a mark-complete-with-notes flow, and real device
  push notifications (she has no Telegram). A read-only parent-facing
  progress page lives under the main app's own gate.

## Structure

- `src/app`: Next.js routes, layout, and PWA manifests (Atlas's own,
  and Ahaana's separate one for her section)
- `src/components/ui`: shared UI primitives
- `src/features`: feature-owned validation schemas, server actions, and
  components
- `src/services`: server-only business logic and Supabase orchestration
- `src/lib`: shared utilities — money handling (fixed-precision
  decimals, never floats), date/recurrence math, env validation,
  Supabase clients, the two-provider AI helper
- `supabase`: migrations and the database test harness

## Access model, in short

There's no sign-up and no Supabase Auth sign-in — every request runs as
a single fixed owner account. The real barrier is a password
(`APP_ACCESS_PASSWORD`) checked once per browser via a signed cookie,
enforced in `src/middleware.ts`, covering every route except `/calendar`
(deliberately public). See
[INSTALL.md's "The access model"](./INSTALL.md#the-access-model) for
the full picture, and `docs/00-current-state.md`'s "Auth model" section
for why Supabase's own Row Level Security isn't the live enforcement
boundary either.
