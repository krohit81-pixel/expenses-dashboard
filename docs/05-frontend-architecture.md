# Frontend Architecture

## Route map

```text
/(app)/dashboard
/(app)/transactions
/(app)/accounts
/(app)/budgets
/(app)/imports
/(app)/net-worth
/(app)/settings
/(auth)/sign-in
/(auth)/callback
```

Protect the `(app)` route group in middleware or server layouts. Layouts provide navigation and account context; individual pages own query parameters and empty/loading/error states.

## Feature structure

```text
src/features/transactions/
  api/              # typed server-facing query and command functions
  components/       # feature UI only
  schemas/          # Zod input and URL schemas
  hooks/             # feature-local client hooks
  types.ts           # feature DTOs and view models
  utils.ts           # pure transformations
```

Shared visual primitives belong in `src/components/ui`. Shared, domain-neutral helpers belong in `src/lib`. Avoid a global `components` directory for product components.

## State management

- URL state: filters, ranges, sort order, selected account, and selected period.
- Server state: Server Components and explicit fetch/query functions; invalidate after commands.
- Form state: React Hook Form plus Zod resolver.
- Local UI state: `useState` or `useReducer` within the smallest appropriate component.
- Do not add a global client state store until a proven cross-route interaction needs one.

## UI and accessibility requirements

- Render currency with `Intl.NumberFormat`; retain decimal strings internally.
- Support keyboard navigation, visible focus, semantic labels, error association, and reduced motion.
- Charts need a tabular alternative or accessible summary. Never communicate account status by color alone.
- Keep common actions reachable on small iPhone viewports. Respect safe areas and Safari's dynamic browser chrome.
- Use optimistic updates only when the command has an idempotency key and rollback path.

## PWA plan

The existing manifest and iOS metadata are the starting point. Add branded 192px and 512px icons, an Apple touch icon, a service worker, offline shell caching, and an explicit offline state before calling the application installable. Do not cache account data in a shared browser cache without considering device privacy; prefer encrypted or minimal local persistence.

## Charts

Use Recharts behind feature-specific adapters. Chart data must be prepared server-side or in pure typed selectors, and each chart must display its period, currency, account scope, and empty state. Reconciliation and money totals always outrank chart aesthetics.
