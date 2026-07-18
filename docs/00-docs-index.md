# Atlas — Architecture Documentation

Atlas is a private, single-owner personal cash-flow app built around a
**Financial Cycle → Phase** model, not a traditional category-budget or
transaction-ledger app. **Read `01-product-vision.md` first and in
full** — the phase model and cycle-tagging mechanic it explains are
load-bearing for almost everything else in this codebase.

This documentation was substantially rewritten as part of launch
preparation (v0.6.0) to describe the application as it actually is,
replacing earlier drafts that described an aspirational architecture
(multi-user, an AI assistant, an import engine, staging environments)
written before the product's real direction was established. If
anything here contradicts the actual repo, trust the repo and flag the
doc as needing a fix — but as of this rewrite, every claim in these
docs was checked directly against the current codebase, not
remembered or assumed.

## Documentation map

| Document | Purpose | Status |
|---|---|---|
| [Product vision](./01-product-vision.md) | The Financial Cycle → Phase model, cycle-tagging, scope. **Start here.** | Current |
| [System architecture](./02-system-architecture.md) | Real stack, auth model, layer boundaries, repo structure. | Current |
| [Database design](./03-database-design.md) | Schema, including which tables are actually used vs. vestigial. | Current |
| [API design](./04-api-design.md) | The Server Action pattern (there's no conventional API). | Current |
| [Frontend architecture](./05-frontend-architecture.md) | Design tokens, dark mode, component patterns, the Home screen. | Current |
| [Import engine](./06-import-engine.md) | Not built — design questions to resolve before starting. | Stub / not built |
| [AI assistant](./07-ai-assistant.md) | Not built, not currently planned. | Stub / not built |
| [Engineering standards](./08-engineering-standards.md) | TypeScript/Zod/money rules, the verification sequence. | Current |
| [Testing strategy](./09-testing-strategy.md) | What's actually tested, and the no-live-Supabase-in-session caveat. | Current |
| [Deployment and operations](./10-deployment-and-operations.md) | Env vars, real CI/CD, how code has been delivered historically. | Current |
| [Security and privacy](./11-security-and-privacy.md) | The actual (single-owner) threat model and access-gate mechanism. | Current |
| [Roadmap](./12-roadmap-and-implementation-order.md) | Real version history through v0.6.0, and what's actually next. | Current |

## Fast orientation for a new session

- **Stack:** Next.js 15 (App Router) + React 19 + TypeScript strict +
  Tailwind v3 + Supabase Postgres (service-role only, no per-request
  RLS enforcement) + Zod + `decimal.js`-backed money.
- **Auth:** no sign-up, no per-user session — single shared password,
  single fixed owner account. Not a bug, not incomplete — the product
  is single-owner by design.
- **The one thing to never get wrong:** `cycle_month` on `transactions`
  is independent of `occurred_on`, and untagged means excluded from
  every budget/home calculation, not zero. See `01-product-vision.md`.
- **Verification before "done":** `format:check`, `typecheck`, `lint`,
  `test`, `build` — every time, per `08-engineering-standards.md`.

See also the repo root's `README.md` and `INSTALL.md` for setup
instructions — those are kept accurate independently of this folder and
aren't duplicated here.
