# Atlas

A private, single-owner personal cash-flow app — accounts,
transactions, recurring commitments, net worth, and a
Financial-Cycle-aware Home and Budgets view — built on Next.js and
Supabase.

**Start here if you're picking up development:** `docs/README.md`,
and read `docs/01-product-vision.md` in full before touching code. The
Financial Cycle → Phase model and cycle-tagging mechanic it explains
are load-bearing for almost everything else in this codebase — nothing
else here will make sense without them.

**Setup:** see [INSTALL.md](./INSTALL.md) for environment variables,
local development, and Vercel deployment.

**Receiving code changes from Claude:** see
[APPLYING-CHANGES.md](./APPLYING-CHANGES.md) — covers both direct
GitHub repo access (preferred, when available) and the zip-file
delivery method used when it isn't.

## Structure

- `src/app`: Next.js routes, layout, and PWA manifest
- `src/components/ui`: shared UI primitives (Hero, SplitCard, form inputs)
- `src/features`: feature-owned validation schemas, server actions, and components
- `src/services`: server-only business logic and Supabase orchestration
- `src/lib`: shared utilities — money handling (`decimal.js`-backed),
  date/phase/recurrence math, env validation, Supabase clients
- `supabase`: migrations and the database test harness
- `docs`: full architecture documentation — see `docs/README.md`

## Status (as of v0.6.0)

- **Built and in daily use:** accounts, transactions (income/expense/
  transfer, editable, deletable), recurring templates with cycle-based
  tagging, the phase-aware Home screen (Financial Cycle → Phase model),
  cycle-aware Budgets, net worth, attachments, a public shareable
  Calendar, dark/light mode.
- **Not yet built:** statement/CSV import (`/imports` is a placeholder),
  investment tracking, any AI/assistant feature. See
  `docs/06-import-engine.md`, `docs/07-ai-assistant.md`, and
  `docs/12-roadmap-and-implementation-order.md` for what each of those
  actually needs before starting.

This app has no sign-in screen and no per-user session — every request
runs as a single fixed owner account, gated by one shared password (see
[INSTALL.md](./INSTALL.md)). This is a deliberate single-owner design,
not an incomplete multi-user one — see `docs/11-security-and-privacy.md`
for exactly what that does and doesn't protect against.
