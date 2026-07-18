# Roadmap and Version History

## Actual version history

**Foundation (pre-v0.3):** scaffold, initial schema (including the
tables later found to be vestigial — see `docs/03-database-design.md`),
core ledger (accounts, transactions, dashboard), budgets/recurring/
attachments/net-worth as originally conceived (period + planned-amount
model, since superseded), a real sign-in flow that was later removed
entirely in favor of the single-owner no-session model
(`docs/02-system-architecture.md`).

**v0.3 — redesign:** locked the visual system (Hero, design tokens,
Manrope/Inter), new information architecture (4 primary tabs + More),
rebuilt Budgets and Intel, added the public `/calendar` route and the
access-gate password (replacing the removed sign-in flow).

**v0.4 — v0.4.1:** month-aware Budgets (the first version of what
became `BudgetSnapshotService`), "Mark as paid," Atlas rebrand
(name/logo/PWA), transaction editing.

**v0.5.0 — v0.5.8 — the Financial Cycle → Phase pivot.** This is the
major architectural shift and the current product's actual identity.
In order:

- **v0.5.0**: `cycle_month` added to `transactions`
  (migration `20260714000100`). `BudgetSnapshotService` rewritten
  around tagged inclusion instead of auto-projecting every active
  recurring template — recurring templates became reference data.
  `tagRecurringToCycle` + the "Tag" control on `/recurring` shipped as
  the actual mechanism.
- **v0.5.1**: cycle-month fields added to the remaining transaction
  forms; first version of the phase-aware Home screen (Planning/
  Execution/Tracking tabs, one "current month" at a time).
- **v0.5.2 – v0.5.6**: a real sequence of bug fixes from actual daily
  use — an outlook card's amounts overflowing their layout, no way to
  retag an old untagged transaction, a phase's displayed date range
  being wrong (anchored to today instead of the selected cycle),
  "mark paid" having no undo, Transactions' sort order not matching
  "recently added," no delete capability for a mistaken entry, Home's
  Accounts section showing credit cards where they added no value.
  Each of these came from the person actually using the app daily and
  hitting something concrete — worth reading the commit messages from
  this range directly if you want the full reasoning per fix, since
  several are long and specific about the real report that prompted
  them.
- **v0.5.3**: the cycle *dropdown* — the realization that Planning/
  Execution/Tracking shouldn't be global application modes but a
  per-cycle lifecycle, derived from three worked examples (see
  `docs/01-product-vision.md`). `phaseAvailability`/
  `defaultPhaseForMonth` date from here.
- **v0.5.7**: the card-payment quick-log widget gained its own cycle
  selector (previously hardcoded to "next month," with no way to
  review or log for any other cycle).
- **v0.5.8**: Budgets' headline changed to reuse the same
  projected-balance formula as Home, instead of a narrower "fixed
  net" calculation; removed a field made redundant by v0.5.7's cycle
  selector.

**v0.6.0 — the last completed release as of this writing:**

1. Removed Home's four-stat row (Expected/Committed/Paid/Remaining)
   entirely after it failed a direct test — walking through a real
   income+expense scenario didn't match any of three reasonable
   guesses for what "Expected" should show.
2. Fixed the projected-balance formula to include one-off income as an
   addition (it previously excluded it, which made a real scenario —
   a one-off entry representing starting cash — show a materially
   wrong, more-negative number than the actual position).
3. Income/expense split applied everywhere a mixed list existed (Home's
   checklist, Transactions' Recent list), matching the layout Budgets
   already had. `SplitCard` extracted as the shared shell.
4. Dark mode — token-based, toggle in `/more`, colors chosen by
   reasoning about contrast rather than visual verification (no
   browser render available in-session — see `docs/05-frontend-architecture.md`).

## What's actually next (as of v0.6.0)

Nothing is currently mid-flight. The backlog, roughly in the order it
was raised, not necessarily the order it should be tackled:

- **Import engine** — genuinely not started; see
  `docs/06-import-engine.md` for the design questions to resolve first,
  specifically how imported rows interact with cycle-tagging.
- **Investment tracking** — `securities`/`investment_transactions`
  tables exist but are unused; would need real design work, not just
  wiring up existing tables (see `docs/03-database-design.md`).
- **Dark mode visual verification** — built, unverified in an actual
  browser. Highest-value five-minute task for a session with real
  browser/screenshot access.
- **Observability and backups** — see `docs/10-deployment-and-operations.md`'s
  closing notes; not urgent at current scale, worth revisiting if that
  changes.
- **AI assistant** — considered, deliberately not started; see
  `docs/07-ai-assistant.md` for why a generic approach likely doesn't
  fit this app's model as-is.

## How to pick this up in a new session

1. Read `docs/01-product-vision.md` first, fully — the Financial Cycle
   → Phase model and cycle-tagging mechanic are load-bearing for
   almost every other file in this codebase, and nothing else here
   will make sense without them.
2. Skim `docs/02` and `docs/03` for the architecture/schema shape
   before touching code.
3. Confirm what access you actually have this session (real Supabase
   CLI? Real GitHub repo access? Neither?) before assuming either is
   available — see `docs/09` and `docs/10`'s notes on both.
4. Run the full verification sequence
   (`docs/08-engineering-standards.md`) before considering any change
   complete, every time, regardless of how small the change looks.
