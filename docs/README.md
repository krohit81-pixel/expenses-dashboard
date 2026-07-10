# Personal Finance Architecture Documentation

This documentation describes the production target for the personal finance application and the decisions that guide its implementation. The current repository is an early Next.js scaffold; product features are intentionally not yet implemented.

## Documentation map

| Document | Purpose |
| --- | --- |
| [Product vision](./01-product-vision.md) | Audience, outcomes, scope, and success metrics. |
| [System architecture](./02-system-architecture.md) | Runtime boundaries, modules, data flow, and decisions. |
| [Database design](./03-database-design.md) | Finance schema model, invariants, RLS, and migration policy. |
| [API design](./04-api-design.md) | Backend-for-frontend contract and mutation patterns. |
| [Frontend architecture](./05-frontend-architecture.md) | Routes, feature boundaries, state, accessibility, and PWA approach. |
| [Import engine](./06-import-engine.md) | CSV/OFX ingestion, matching, review, and idempotency. |
| [AI assistant](./07-ai-assistant.md) | Grounded assistant boundaries, tools, privacy, and evaluation. |
| [Engineering standards](./08-engineering-standards.md) | Code organization, TypeScript, validation, and review rules. |
| [Testing strategy](./09-testing-strategy.md) | Test pyramid, fixtures, quality gates, and release criteria. |
| [Deployment and operations](./10-deployment-and-operations.md) | Environments, CI/CD, observability, backups, and rollback. |
| [Security and privacy](./11-security-and-privacy.md) | Threat model, access control, secrets, and retention. |
| [Roadmap](./12-roadmap-and-implementation-order.md) | Phases, dependencies, and recommended delivery sequence. |

## Current-state review

- The application uses Next.js 15, React 19, TypeScript strict mode, Tailwind, shadcn/ui foundations, Supabase clients, Zod, React Hook Form, Recharts, and Framer Motion.
- The `src/app/page.tsx` route intentionally renders no product UI. `src/features`, `src/services`, `src/hooks`, and `src/types` are reserved for feature work.
- Finance migrations live in `supabase/migrations` and create a dedicated `finance` schema in the existing Vitals Supabase project.
- The migrations grant `service_role` access, enable RLS for app data, and create a private attachment bucket. Add `finance` to Vitals' exposed API schemas before browser or REST clients use it.
- The schema migration history in the hosted project is the source of truth. Confirm migration status before applying or editing any migration in a shared environment.

## Architecture principles

1. Treat finance records as sensitive, user-owned data.
2. Keep the browser thin; enforce business rules in server-side services and database constraints.
3. Prefer explicit review over destructive automation, especially for imports and AI actions.
4. Model money as fixed-precision decimals, never JavaScript floating-point values.
5. Build vertical slices with tests and observability before adding breadth.
