# Personal Finance Dashboard

A private, single-user personal finance dashboard: accounts, transactions,
budgets, recurring bills, net worth, and document attachments, built on
Next.js and Supabase.

**Setup:** see [INSTALL.md](./INSTALL.md) for environment variables,
local development, and Vercel deployment.

## Structure

- `src/app`: Next.js routes, layout, and PWA manifest
- `src/components/ui`: shared UI primitives
- `src/features`: feature-owned validation schemas, server actions, and components
- `src/services`: server-only business logic and Supabase orchestration
- `src/lib`: shared utilities — money handling, date/recurrence math, env validation, Supabase clients
- `supabase`: migrations and the database test harness

## Status

- **Milestone 0 — Foundation:** env validation, typed Supabase clients, CI, RLS test harness
- **Milestone 1 — Core ledger:** accounts, transactions (income/expense/transfer/split), dashboard
- **Milestone 2 — Planning and evidence:** budgets, recurring transactions, attachments, net worth
- **Not yet built:** the import engine (`/imports` is a placeholder), transaction editing, investment tracking

This app has no visible sign-in screen by design — see the
"No visible sign-in" section in [INSTALL.md](./INSTALL.md) before
deploying anywhere it could be reached by someone other than you.
