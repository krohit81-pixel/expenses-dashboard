# Atlas — Architecture Documentation

This documentation covers the personal finance application's architecture
and the decisions behind it. **Start with
[00 — Current state](./00-current-state.md)** — it corrects the numbered
docs below wherever the app has diverged from its original target design,
and orients a new session fast. The numbered docs are kept updated where
they still hold; where they describe direction rather than what's built,
they say so.

## Documentation map

| Document | Purpose |
| --- | --- |
| [Current state — read first](./00-current-state.md) | What's actually built, the real auth model, working conventions, sandbox constraints. |
| [Product vision](./01-product-vision.md) | Audience, outcomes, scope, and success metrics. |
| [System architecture](./02-system-architecture.md) | Runtime boundaries, modules, data flow, and decisions. |
| [Database design](./03-database-design.md) | Finance schema model, invariants, and migration policy. |
| [API design](./04-api-design.md) | Server actions, validation, and mutation conventions. |
| [Frontend architecture](./05-frontend-architecture.md) | Routes, feature boundaries, state, accessibility. |
| [Import engine](./06-import-engine.md) | PDF credit-card statement parsing, reconciliation, and per-issuer parser modules. |
| [AI assistant](./07-ai-assistant.md) | Intel's button-triggered insight: providers, prompt shape, and boundaries. |
| [Engineering standards](./08-engineering-standards.md) | Code organization, TypeScript, money handling, and review rules. |
| [Testing strategy](./09-testing-strategy.md) | What's actually tested today, fixture hygiene, and verification pipeline. |
| [Deployment and operations](./10-deployment-and-operations.md) | Environments, release process, and sandbox build limitations. |
| [Security and privacy](./11-security-and-privacy.md) | The real access model (access-gate + service-role), secrets, and data handling. |
| [Roadmap](./12-roadmap-and-implementation-order.md) | What's shipped by version, and plausible next steps. |

## Current-state summary

- Next.js 15, React 19, TypeScript strict, Tailwind, shadcn/ui, Supabase
  Postgres (schema-only — no live Supabase Auth sessions), Zod, React Hook
  Form, Recharts, decimal.js, pdf.js. Deployed to Vercel.
- Single-owner app: one fixed account, an HMAC-signed access-gate cookie
  instead of sign-in, and a service-role Supabase client that bypasses RLS
  (see doc 00 for why, and what that means for how you write services).
- Feature set as of v1.11.0: ledger core (accounts, transactions, budgets,
  recurring, net worth, attachments), credit-card statement imports (HDFC
  Infinia / Tata Neu Plus, Axis Horizon / Airtel, ICICI Amazon Pay /
  RuPay) with a shared Merchant Dictionary, an Intel tab with charts and a
  button-triggered AI insight, and a Calendar tab (school calendar +
  trips) that's the one public, gate-free route.
- Root `INSTALL.md` is the source of truth for setup, environment
  variables, and release history — not this folder.

## Architecture principles

1. Treat finance records as sensitive, owner-only data — even without a
   multi-user boundary today, services must filter explicitly by
   `OWNER_USER_ID` (see doc 00).
2. Keep the browser thin; enforce business rules in server-side services.
3. Prefer explicit review over destructive automation, especially for
   statement imports.
4. Model money as fixed-precision decimals (the `Money` branded type),
   never JavaScript floating-point values.
5. A parser's only job is to say what a statement literally printed —
   categorization and merchant identity are resolved elsewhere (the
   Merchant Dictionary), never hardcoded into a parser.
