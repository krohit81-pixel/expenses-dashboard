# Frontend Architecture

## Actual route map

> Bottom nav (primary) is **Dashboard / Log / Intel / Calendar**, plus
> More — see [00 — Current state](./00-current-state.md)'s "v2.0/v2.1
> revamp" section for the full story of how this changed from an earlier
> Transactions-first, 3-phase design.

```text
/(app)/dashboard        # primary tab. Full cycle-wise income/expense breakdown — absorbed
                         # Budgets in v2.1.0. Was "Home" pre-v2.1.0.
/(app)/log               # primary tab (new, v2.1.0). Hub linking to Recurring, Accounts, Imports.
/(app)/recurring         # under Log. Cycle-scoped, bulk cycle-tagging (v2.1.0) — see doc 00.
/(app)/accounts          # under Log. Includes inline balance-correction panel (v2.1.0).
/(app)/imports           # under Log. Credit-card statement upload (HDFC Infinia, Axis Horizon, ICICI).
/(app)/intel             # primary tab. Spending charts + AI insight.
/(app)/calendar          # primary tab. School calendar (static) + trips + events + recurring events —
                         # the one gate-free route. See "Calendar tab structure" below (v2.5.0).
/(app)/transactions      # under More. Read-only historical log as of v2.0.0 — no entry forms.
/(app)/budgets           # under More→ nowhere (unlinked, v2.1.0). Still runs; content now duplicated on Dashboard.
/(app)/merchants         # under More. Merchant Dictionary admin (list + /merchants/[id] detail)
/(app)/net-worth         # under More
/(app)/ais               # under More. Static Income Tax AIS summary (v1.13.0), not ledger-backed.
/(app)/settings          # under More
/(app)/onboarding        # base currency/timezone, first-run only
/(app)/more              # overflow nav for secondary items
/login                   # access-gate password entry, not Supabase Auth sign-in
```

Everything under `(app)` except `/calendar` requires the access-gate
cookie, enforced in `src/middleware.ts` — see doc 00 and doc 11 for why
this isn't Supabase Auth. There is no `/(auth)/sign-in` or
`/(auth)/callback` route group; those were part of the original,
superseded design.

## Calendar tab structure (v2.5.0)

`TravelCalendarSection` (`src/features/travel/components/`) owns all
interactive state for `/calendar` and renders three switchable sections
behind a pill tab switcher, below the person filter chips (which stay
visible across all three since they filter every section's content):

- **Dashboard** — `TripCalendarGrid` (the month grid) and
  `WeekScheduleGrid` (a navigable day-list for "This week's schedule",
  `±1 week` at a time via its own `weekOffset` state, with a "This week"
  button to jump back). Both always expanded.
- **Report** — `GoodTravelWindows`, `TripDetailedList` (the chronological
  detailed event list), and `RecurringEventsList` (the recurring-rules
  list) — each individually collapsed by default.
- **Log** — `LoggingSection`, three collapsed add-cards (trip / event /
  recurring), each opening the matching `AddTripModal`/`AddEventModal`/
  `AddRecurringEventModal`.

Tapping any day — a month-grid cell or a week-list row — expands
`DayDetailCard` inline right below it (an "All day" section, then a
time-sorted "Schedule" section for recurring occurrences); there is no
full-screen day view. `chipsForDate` (`TripCalendarGrid.tsx`) is the one
shared "what's on this date" function every view builds from, so
visibility-filter/date-range logic never diverges between the grid, the
week list, and the day card. `compactChipsForDate` wraps it for the
grid/week-list's smaller "ChipBadge" rendering (a bold color bar + pale
body), collapsing same-day recurring occurrences into one "N classes"
summary chip — `DayDetailCard` is where each occurrence gets its own row
and click target once expanded.

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
