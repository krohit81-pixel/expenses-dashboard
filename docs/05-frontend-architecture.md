# Frontend Architecture

## Design system — locked tokens

Colors are HSL CSS custom properties in `src/app/globals.css`, consumed
via Tailwind's token system (e.g. `bg-bg`, `text-ink`, `bg-accent-soft`)
— never hardcode a raw Tailwind color (`bg-purple-600`, etc.) for
anything that should adapt to light/dark mode. The tokens:

`--bg`, `--surface`, `--hero-1`/`--hero-2` (hero gradient), `--ink`/
`--ink-soft`/`--ink-faint`, `--accent`/`--accent-soft`, `--positive`/
`--positive-soft`, `--negative`/`--negative-soft`, `--line`.

**Dark mode** (`.dark` class, `darkMode: ["class"]` in
`tailwind.config.ts`) overrides every one of these with re-tuned
values — not a naive invert. Text goes lighter for contrast; "soft"
tints (pale washes in light mode) become dark saturated tints in dark
mode, since a pale wash disappears against a dark card. The hero
gradient barely changes — it was already dark indigo. See
`globals.css`'s `.dark` block comment for the reasoning. **A known gap
as of this writing: dark mode's colors were chosen by reasoning about
contrast, never visually verified in a rendered browser** — the sandbox
this was built in has no way to render and inspect pixels. If you have
real browser access, look at it before trusting the palette fully.

Three hardcoded `amber-*` Tailwind utility classes (Tracking phase
styling in `HomePhaseView.tsx`) needed explicit `dark:` variants added
by hand, since they don't route through the CSS-variable token system.
If you add new hardcoded Tailwind colors anywhere, check whether they
need the same treatment — grep for `bg-(red|green|blue|purple|yellow|
orange|pink|indigo|teal|amber)-[0-9]` to find any that exist.

Theme switching: a blocking inline script in the root layout
(`src/app/layout.tsx`) sets the `dark` class before hydration — checks
`localStorage`, falls back to system preference only if nothing's
stored yet. `ThemeToggle` (`src/features/settings/ThemeToggle.tsx`,
surfaced on `/more`) persists an explicit choice. It intentionally
starts its own state as `null` and syncs in a `useEffect` after mount
— reading `document.documentElement`'s class during the initial render
would disagree with the server's render (no DOM exists there) and
trigger a hydration mismatch. The page's actual theme is already
correct instantly either way; only the toggle button's own highlighted
state needs the post-mount sync.

Typography: Manrope (display/numbers, loaded via `font-display`
utility) and Inter (body). Loaded via a plain `<link>` in the root
layout, not `next/font` — `next/font` fetches at *build* time, which
needs network access unavailable in the sandbox this was built in. If
you have full network access, revisit self-hosting via `next/font` for
the preload/optimization benefits.

## Component patterns worth reusing, not re-deriving

- **`Hero`** (`components/ui/hero.tsx`) — every page's header. Fixed
  rectangle (not rounded), `min-h-[170px]` floor. Pages with more
  content (Home, Budgets) sit taller than that floor; simpler pages
  (Calendar, Settings) sit at it. The floor is a *minimum*, not a
  forced uniform height across every page — don't "fix" a taller Hero
  on a content-rich page assuming it's a bug.
- **`SplitCard`** (`components/ui/split-card.tsx`) — the
  "titled card with a running total and an empty state" shell used
  everywhere a list splits into income vs. expense (Budgets, Home's
  checklist, Transactions' Recent list). Owns only the shell; row
  rendering is fully caller-supplied (`children`), since Budgets' plain
  rows, Home's interactive `ChecklistItem`, and Transactions' full
  `TransactionRow` (with edit/delete) are too different to force
  through one row shape.
- **`ChecklistItem`** (`features/home/ChecklistItem.tsx`) — Home's
  checkbox row. Has a `readOnly` prop: interactive (tap to mark paid,
  tap again to undo — genuinely bidirectional, see
  `docs/01-product-vision.md`'s "read-only vs. actionable" principle)
  only on the Execution tab for the real current month. Every other
  rendering is `readOnly`.
- **`TransactionRow`** (`features/transactions/components/
  TransactionRow.tsx`) — the full-featured row: inline edit
  (amount/date/memo/cycle-month), mark-paid/undo, delete (soft-delete
  via `voidTransaction`, with an inline confirm step matching
  `RecurringLineItem`'s pattern).

## The phase-aware Home screen

`src/app/(app)/dashboard/page.tsx` (route kept as `/dashboard`; nav
label is "Home" — a deliberate choice to avoid touching
middleware/onboarding redirects/nav hrefs for what's otherwise a pure
rename) fetches a 10-month window (6 back, current, 3 ahead) of budget
snapshots in parallel, then hands them to
`HomePhaseView` (client component), which owns:

- The cycle `<select>` — switching cycles is instant, zero server
  round-trips, since every cycle in the window is already fetched.
- The sticky phase tabs, whose availability/default come from
  `phaseAvailability`/`defaultPhaseForMonth` (see
  `docs/01-product-vision.md`).
- Three different arrangements of the *same* underlying data
  (checklist + outlook card), reordered by phase priority — Planning
  shows the outlook first with a compact checklist below; Execution
  flips that; Tracking shows a settled review instead of an action
  list.

Home's Hero shows only "Available cash right now" — an earlier version
had a four-stat row (Expected/Committed/Paid/Remaining) that was
removed entirely after real confusion about what "Expected" meant in a
mixed income/expense scenario. Don't re-add a derived stat row without
being able to answer, precisely and in one sentence, what each number
means for every combination of income/expense/paid/unpaid — that's the
exact test the old row failed.

## PWA

`src/app/manifest.ts` (dynamic manifest route, not a static JSON file)
+ icons. Standard "add to home screen" support; no offline/service-worker
strategy has been built.

## What isn't built on the frontend

No component test suite (no React Testing Library / Vitest component
tests exist — only pure-function unit tests, see
`docs/09-testing-strategy.md`), no E2E tests (no Playwright), no
Storybook or component catalog.
