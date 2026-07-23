# Frontend Architecture

## Actual route map

```text
/(app)/dashboard
/(app)/transactions
/(app)/accounts
/(app)/budgets
/(app)/imports          # credit-card statement upload (HDFC Infinia, Axis Horizon)
/(app)/merchants        # Merchant Dictionary admin (list + /merchants/[id] detail)
/(app)/intel            # spending charts + AI insight
/(app)/net-worth
/(app)/recurring
/(app)/calendar         # school calendar (static) + trips + events — the one gate-free route
/(app)/settings
/(app)/onboarding       # base currency/timezone, first-run only
/(app)/more             # overflow nav for secondary items
/login                  # access-gate password entry, not Supabase Auth sign-in
```

Everything under `(app)` except `/calendar` requires the access-gate
cookie, enforced in `src/middleware.ts` — see doc 00 and doc 11 for why
this isn't Supabase Auth. There is no `/(auth)/sign-in` or
`/(auth)/callback` route group; those were part of the original,
superseded design.

## Feature structure (unchanged, accurate)

```text
src/features/<feature>/
  api/actions.ts      # server actions — see doc 04
  components/         # feature UI only
```

Some features additionally have a `schemas.ts` (Zod) or feature-local pure
helpers (e.g. `src/features/transactions/group-by-cycle.ts`); not every
feature needs the full `hooks/`/`types.ts`/`utils.ts` split the original
target sketched — add those only when a feature actually needs them.
Cross-feature domain-neutral helpers belong in `src/lib`
(`src/lib/intel/card-category-breakdown.ts`, `src/lib/budget/home-stats.ts`,
`src/lib/dates/*`), not duplicated per feature.

Note: `budgets` has no `src/features/budgets/` directory — its logic
lives in `src/lib/budget/` plus `BudgetSnapshotService`, called directly
from `src/app/(app)/budgets/`. Not every route needs a full feature
module; add one when a route's logic actually grows past what a page
component and a lib helper can hold cleanly.

## State management (unchanged, accurate)

- URL state for filters, ranges, and the Intel card-level breakdown's
  month selector.
- Server Components + server actions for server state; re-fetch/revalidate
  after a command rather than maintaining a client cache.
- React Hook Form + Zod resolver for forms (e.g. the statement upload
  form's card picker + file input).
- `useState`/`useReducer` for local UI state (e.g. the Intel page's
  Suspense-wrapped card-breakdown spinner, guaranteed via client-side
  month navigation — see `IntelService` delivery notes).
- No global client state store.

## UI and accessibility (unchanged, accurate)

- Render currency with `Intl.NumberFormat`; keep `Money` decimal strings
  internally, format only at render.
- Keyboard navigation, visible focus, semantic labels, reduced motion.
- Charts (Recharts) need an accessible summary or tabular alternative;
  never communicate status by color alone.
- Optimize for a mid-tier iPhone viewport and Safari's dynamic chrome —
  the primary real-world usage pattern for this app.

## Charts

Recharts behind feature-specific adapters; chart data is prepared
server-side or in pure typed selectors (`src/lib/intel/donut.ts`,
`card-category-breakdown.ts`). Every chart shows its period/cycle-month
scope and an empty state.
