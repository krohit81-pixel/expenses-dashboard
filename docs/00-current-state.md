# Current State — Read This First

Every other doc in this folder was written as a **pre-implementation target
architecture**, before any product code existed. The app has since been
built out substantially, and in a few places diverged from that original
target on purpose, after hitting real constraints. This doc is the
correction layer: what's actually true today, current as of **v3.1.0**
(August 2026). Read this before the numbered docs — where they conflict with
this one, this one is right.

**v2.0.0 was a total revamp of the app's shape**, not just a feature add —
if you're orienting from an older memory of this app (a Transactions-first,
3-phase Planning/Execution/Tracking UI with 5 bottom-nav tabs), that's gone.
See "The v2.0/v2.1 revamp" section below before touching navigation,
Dashboard, Recurring, or Accounts.

The numbered docs still hold as a record of the original reasoning and are
kept updated where they remain accurate, but this file is the fast-start
orientation for a new session.

## What this app actually is

A private, **single-owner** personal finance dashboard — not a multi-tenant
product. There is no sign-up flow and no per-user data model in practice,
even though the database schema still has a `user_id` column on every
table (kept for FK integrity and because it was the original multi-user
design — see "Auth model" below for why it's unused as a real boundary).

Built on Next.js 15 (App Router, React 19, TypeScript strict), Supabase
Postgres (schema-only, no Supabase Auth sessions in the live app), Tailwind,
shadcn/ui, Zod, React Hook Form, Recharts, decimal.js, and pdf.js
(server-side PDF text extraction). Deployed to Vercel. See `INSTALL.md` at
the repo root for the actual setup/deploy steps and env var table — that
file is kept accurate release-to-release and is the install source of
truth, not this docs folder.

## Auth model (the biggest divergence from the original docs)

The original docs (02, 03, 11) describe Supabase Auth sign-in plus RLS
(`auth.uid() = user_id`) as the live enforcement boundary. **That is no
longer how this app works.** The actual model:

- One fixed "owner" `auth.users` row, created once via
  `npm run bootstrap:owner` (see `scripts/bootstrap-owner.mjs`). Its UUID
  lives in the `APP_OWNER_USER_ID` env var and is exported as
  `OWNER_USER_ID` from `src/lib/owner.ts`.
- Every service (`src/services/**`) reads and writes through
  `createServiceClient()` in `src/lib/supabase/service.ts` — a
  **service-role** client that **bypasses RLS entirely**. There is no
  per-request Supabase session at all.
- Because RLS is bypassed, it provides **no actual data isolation** today.
  Every service is individually responsible for filtering reads/updates/
  deletes by `user_id = OWNER_USER_ID` and setting it explicitly on every
  insert. The RLS policies and ownership triggers from the migrations are
  still correct and still present — they just aren't the thing standing
  between a request and the data.
- Instead of Supabase Auth, there's an app-level access gate:
  `src/lib/access-gate.ts`, an HMAC-signed cookie set once per browser
  after the visitor enters `APP_ACCESS_PASSWORD` (see
  `src/features/access-gate/`). `/calendar` is deliberately exempt (public,
  shareable without exposing financial data) — see `src/middleware.ts`.
  This was chosen specifically to avoid tripping Supabase's own sign-in
  rate limiting under concurrent mobile-Safari requests, which the earlier
  per-request-`signInWithPassword` design actually hit in production.

**Practical consequence:** when working on any service, filter by
`OWNER_USER_ID` explicitly — do not assume RLS is doing that job. When
touching `finance` migrations, RLS policies still belong there (they
document the intended per-user boundary and would matter again if this
ever became genuinely multi-user), but don't rely on them for anything the
app must actually enforce today.

**Known production quirk (v2.5.3, still real, has a workaround):**
`createServiceClient()`'s static `SUPABASE_SERVICE_ROLE_KEY` occasionally
gets rejected by Supabase with a `"JWT issued at future"` PostgREST error
— not an actual credential problem (the key doesn't expire or get
reissued per request), a transient clock-sync artifact on Supabase's
side, seen only on the very first query after a stretch of no traffic.
`src/lib/supabase/retry.ts`'s `withAuthTimingRetry` wraps a query and
retries it once, after a short delay, specifically for this error class —
applied so far to `/calendar`'s server-side data fetches (`TripService`,
`CalendarEventService`, `RecurringCalendarEventService`) and
`middleware.ts`'s `user_settings` check, the two places most exposed to a
cold first request (the public route, and every gated page's own
middleware check). Not applied everywhere — extend the same wrapper to
any other query that starts showing this error rather than re-solving it
ad hoc.

## The v2.0/v2.1 revamp (read this before touching nav, Dashboard, Recurring, or Accounts)

Starting in v2.0.0, the household steered the app away from a
transaction-logging tool and toward a **reporting/intel-first** tool. The
old model was "record every transaction as it happens, walk through
Planning → Execution → Tracking phases each month." The new model: each
month ("cycle"), you key in what you *expect* — income and fixed expenses —
and the app assumes it happens; you don't track individual postings against
that expectation. Concretely:

- The 3-phase system (`lib/dates/phase.ts`, `HomePhaseView`,
  `ChecklistItem`) is **deleted** (v2.0.0). The only time concept left is
  the monthly "cycle" (`currentCycleMonth()` in `lib/dates/month.ts`,
  rolling to next month on day 25).
- **Bottom nav is 4 primary tabs**: `Dashboard`, `Log`, `Intel`, `Calendar`
  (v2.1.0; was `Home`/`Calendar`/`Intel` + More in v2.0.0, and
  `Home`/`Transactions`/`Calendar`/`Intel` + More before that). See
  `src/components/app-nav.tsx`.
- **More is a hamburger icon now, not a nav tab** (v2.5.8) — it used to be
  a fifth item in both `BottomNav` and `TopNav`; it's a plain link to
  `/more` in the top-left of every page's `Hero`, next to the wordmark,
  freeing the bottom nav down to four evenly-spaced tabs. `/more` itself
  (the actual overflow page — Merchants, Net worth, Categories, AIS,
  Settings, theme toggle, log out) is unchanged, just reached differently.
  `Hero`'s `atlas-mark.png` icon was also dropped (v2.5.9) — the header's
  left side is now hamburger + "Atlas" + version, no image. The asset
  itself still renders on `/login`, outside `Hero`.
- **Dashboard** (`/dashboard`, was "Home") is the full cycle-wise
  income/expense breakdown — it absorbed everything **Budgets**
  (`/budgets`) used to show. `/budgets` still runs (unlinked from nav, not
  deleted) in case anything still points at it directly; don't build new
  features there.
- **Log** (`/log`, new in v2.1.0) is a landing hub for the three things
  that used to be scattered under More: **Recurring** (`/recurring` — tag
  templates to a cycle), **Accounts** (`/accounts` — balances, plus an
  inline balance-correction panel), and **Imports** (`/imports` —
  statement PDFs).
- **Transactions** (`/transactions`) is now **read-only** — a historical
  log, not an entry point. `TransactionRow`/`RecentTransactionsSection`
  take a `readOnly` prop; the quick-log and add-transaction forms were
  removed from that page. It lives under More now, not primary nav.
- **Recurring** (`/recurring`) is cycle-scoped (a `month` search param,
  like Dashboard) with **bulk cycle-tagging**: every template due this
  cycle (`isDueInCycle()` in `lib/dates/recurrence.ts`) starts
  pre-checked (opt-out, not opt-in) via `RecurringCycleTagger`; Apply once
  tags/untags the whole set (`RecurringTransactionService.applyCycleTags`).
  Templates not naturally due get a per-row "Tag anyway" toggle
  (`NotDueTemplateRow`). **Transfer-kind templates are filtered out
  entirely** — card dues are logged via statement imports instead, not
  recurring transfer templates.
- **Accounts** (`/accounts`) has an inline **balance correction** panel
  per account (`AccountBalanceRow`). There's no stored `balance` column
  to overwrite (see "Money and balances" below) — correcting a balance
  computes the delta between what's shown and what you type, and logs it
  as an ordinary `income`/`expense` transaction dated today, with
  `cycle_month: null` so it never lands inside a cycle's breakdown
  (`AccountService.correctAccountBalance`).
- **AIS** (`/ais`, added v1.13.0) is a static Income Tax Annual Information
  Statement summary page for the current FY, linked from More. Not
  connected to the ledger — hand-maintained reference data.

Full detail (exact files, function signatures) is in each version's commit
message — `git log --oneline` — not duplicated here beyond what's needed to
orient quickly.

## v3.0.0: flat header, Dashboard cycle-nav loading indicator

Two independent cosmetic/UX fixes, shipped together:

- **Hero dropped its indigo gradient background.** `src/components/ui/hero.tsx`
  (rendered at the top of every gated page) used to be a deep indigo→purple
  gradient block (`--hero-1`/`--hero-2`) with white text. It's now flush
  with the page's own `--bg`, ink/ink-soft/ink-faint text, and just a
  hairline `border-line` bottom edge — no separate colored bar. The
  headline `amount` moved to `text-accent` to keep it the visually loudest
  element without a colored backdrop doing that job. `--hero-1`/`--hero-2`
  themselves are untouched in `globals.css` — `/login`'s full-screen
  background still uses them on purpose, since that's a distinct one-time
  screen, not this header. Three pages that rendered their own
  white-on-indigo month-nav pills inside Hero's `children` (Dashboard,
  Budgets, Recurring) and the calendar `ThemeToggleButton`
  (`src/features/settings/ThemeToggle.tsx`) were re-themed to
  accent-soft/accent alongside this, plus `/intel/card-category/loading.tsx`'s
  skeleton (it stands in for Hero before the real page renders).
- **Dashboard's cycle prev/next/Today pager now shows an in-progress
  spinner.** It used to be a plain `<Link>` group, same problem
  `CardMonthNav` (Intel's card-level breakdown nav, v1.6.2) already hit and
  fixed: nothing on screen changed while the next cycle's server data was
  fetching, which read as "did my tap even register?" Dashboard now uses
  `DashboardMonthNav` (`src/features/dashboard/components/DashboardMonthNav.tsx`,
  new, mirrors `CardMonthNav`'s pattern exactly) — a client component
  driving navigation via `useRouter().push` inside `useTransition`, so
  `isPending` is reliably true for the whole round trip and a `Spinner`
  renders next to the pager while it's in flight; `scroll: false` also
  keeps the page from jumping. Budgets/Recurring's month pagers were only
  recolored, not converted to this pattern — not asked for, and they're
  already `<Link>`-based like Dashboard used to be, so the same fix is a
  drop-in later if wanted.

## v3.1.0: Dashboard rebuild, header menu button moved, app-wide accent recolor

The household pointed at a different app's header/dashboard (screenshots,
not code) as a reference for "more professional finance planner" styling
and asked to build on those lines. Real implementation, not another
mockup round — everything below reads real Atlas data, nothing simulated.

- **Global accent recolor, purple → blue.** `--accent`/`--accent-soft` in
  `globals.css` (both themes) changed from the old indigo/purple family to
  a flat blue (`220 82% 55%` light / `220 78% 69%` dark), at the
  household's explicit "same colors" request. This is app-wide — every
  `bg-accent`/`text-accent`/`border-accent` usage (buttons, active nav,
  link cards, `CardMonthNav`, merchant-merge UI, etc.) picks it up
  automatically since none of them hardcode a hex. **Not** touched:
  Intel's chart color palette (`app/(app)/intel/page.tsx`) is a separate
  hardcoded hex array for Recharts and is still the old purple family — a
  known follow-up, not an oversight. `--hero-1`/`--hero-2` (still indigo,
  `/login`'s background) are also untouched, same reasoning as v3.0.0.
- **Hero's menu button moved from left to right.** Used to sit left of the
  wordmark as a plain circular icon; now it's a bordered white
  rounded-square button paired with the date, top-right — matching the
  reference's header arrangement. Left side is just the wordmark, version,
  and a new optional `subtitle` prop (a small caption under the wordmark —
  Dashboard passes `"{month} cycle"`). `title`/`label`/`amount`/`sub`
  still work exactly as before for every other page that uses them
  (Accounts, Net worth, Budgets, Recurring, AIS, ...) — this was additive,
  not a breaking change to Hero's API.
- **Dashboard rebuilt around `src/lib/budget/cycle-compare.ts`** (new, pure
  functions, unit-tested): the net figure moved out of Hero entirely into
  a new **Cycle Brief** card (`CycleBriefCard`) — a deficit↔surplus
  gradient meter, a state word (`onTrack`/`tight`/`overBudget`, from
  `pickCycleState`), and a short factual summary paragraph
  (`buildCycleSummary` — every sentence is derived from real snapshot
  data, nothing invented). The old 3-stat "at a glance" row is replaced by
  **This Cycle vs Last** (`CycleStatGrid`) — 4 real stat cards
  (Income/Expenses/Net/Card dues) compared against the previous cycle's
  own `getMonthlyBudgetSnapshot` (one extra call — the function already
  takes any month, no schema change), each with a two-bar "then vs now"
  comparison and a real percent delta. Deliberately **not** a multi-point
  sparkline — only two real data points exist per figure (this cycle,
  last cycle), and a curve drawn through two points would just be
  decorating a straight line; a real trend sparkline is a plausible
  follow-up once there's a cheap way to fetch several cycles' totals
  without N redundant snapshot queries. **Biggest Changes**
  (`BiggestChanges`) is new too — the largest cycle-over-cycle swings,
  solid-color tiles reserved for real movers, flat cards otherwise.
  `computeBiggestChanges` matches income/fixed-expense lines **by name**
  across cycles (`SnapshotLine` has no stable cross-cycle template id —
  its `id` is the specific transaction row tagged to that one cycle — so
  name is the best signal available without changing
  `BudgetSnapshotService`'s shared shape, also used by `/budgets`); card
  dues is folded in as one synthetic aggregate line since those come from
  one-off logging, not a named recurring template. "Logged this cycle" is
  visually restyled (`LoggedFeedList` — pill tags instead of a plain
  list) but reads the exact same `snapshot.oneOff` data as before. The
  Full breakdown split-cards and the bottom Recurring/Intel link-cards are
  unchanged. `SectionHeading` is the small numbered/colored-bar header
  component used throughout (purely presentational — the chevron is
  decorative, nothing collapses today).

## What's actually built

- **Ledger core**: accounts, institutions, categories, transactions
  (income/expense/transfer/split, now read-only day-to-day — see the
  revamp section above), recurring transactions (cycle-tagged, not
  individually posted), budgets (now shown on Dashboard, not a separate
  tab), attachments, assets/liabilities/loans, net worth.
- **Credit card statement imports**: upload a PDF (password-protected or
  not), it's parsed deterministically (no LLM) into a structured statement
  + transaction rows, reconciled against the statement's own printed
  totals, and only saved if reconciliation passes. Four issuer slots
  today: **HDFC Infinia / Tata Neu Plus** (`hdfc-infinia-tata` — added as
  `hdfc-infinia` in v1.3.0, renamed in v1.11.0 after a second real
  statement, a Tata Neu Plus co-branded card, reconciled against the
  exact same transaction parser with zero code changes, needing only a
  header-level cardType detection for its differently-shaped rewards
  section; unlike the two generalizations below, this one keeps TWO
  separate `CardStatementSource` entries with distinct password env vars,
  since HDFC's co-branded cards aren't guaranteed to share the core
  product's password formula), **Axis Horizon / Airtel**
  (`axis-horizon-airtel` — added as `axis-horizon` in v1.7.0, renamed in
  v1.10.0 after a second real statement, an Airtel co-branded Mastercard,
  reconciled against the exact same parser with zero code changes — same
  bank, same password scheme, same PDF layout, differing only in which
  rewards section is printed), and **ICICI Amazon Pay / RuPay**
  (`icici-amazon-rupay` — added as `icici-amazon` in v1.8.0, renamed in
  v1.9.0 after a second real statement, a RuPay-variant card spent almost
  entirely via UPI, reconciled against the exact same parser with no
  structural changes). ICICI's own summary block doesn't split
  "purchases" from "finance charges" the way HDFC/Axis do, and neither
  real ICICI statement prints its own product name anywhere in the body —
  see `icici-amazon-rupay/types.ts` for how that parser's header fields
  map onto the shared `credit_card_statements` columns, and its
  `parse-header.ts` for how `cardType` is inferred (Amazon Pay's cashback
  section vs. every other card's reward-points section) rather than read
  directly. Four orphaned parser directories, `axis-atlas`, the pre-rename
  `axis-horizon`, the pre-rename `icici-amazon`, and the pre-rename
  `hdfc-infinia`, are naming leftovers and should be deleted by hand — all
  are untracked in git already.
- **Merchant Dictionary**: a shared, issuer-agnostic merchant/category
  resolution layer (`finance.merchants`, `finance.merchant_aliases`,
  `finance.atlas_categories`) that every statement parser feeds into, plus
  a `/merchants` admin UI for reviewing and re-categorizing. The
  resolver itself only ever does exact alias/name matching — v2.5.5
  added an optional, button-triggered "Find likely duplicates"
  (`MerchantMergeSuggestionService`, AI, advisory only, never auto-merges
  — see doc 07) to catch the near-duplicate "unmapped" merchants that
  exact matching alone always misses (an order-ID suffix, a city name, an
  abbreviation); v2.5.6 also surfaces the same tool right after a
  statement import creates new merchants, and added
  `scripts/suggest-merchant-merges.mjs`/`apply-merchant-merges.mjs` for a
  one-off backlog sweep outside the UI (report-only, then explicit
  ID-pair apply — see those scripts' own comments). v2.5.7 moved merging
  itself onto the `/merchants` list directly: a "Merge" button next to
  "Edit" on every row (was only reachable from a merchant's own detail
  page before), plus checkbox multi-select with a "Merge N into…" bulk
  bar (`MerchantListWithSelection`). Merge-target dropdowns everywhere
  are built from the *unfiltered* merchant list on purpose — building
  them from whatever's currently on screen breaks exactly on the
  "uncategorized only" filter, which would otherwise only ever offer
  other uncategorized merchants as a target.
- **Intel tab**: spending charts (by category, month-on-month, card-level
  breakdown by billing cycle) plus a single, button-triggered AI insight
  (Anthropic or Gemini — see doc 07) that's stored, not regenerated on
  every page load.
- **Calendar**: a static, in-code school calendar (`src/features/calendar/data.ts`
  — Ahaana's from Chatrabhuj Narsee School's official AY calendar PDF plus
  the CA1/CA2 subject-test circular, Rohana's from NUS's academic calendar
  PDF) merged with user-entered travel (`finance.trips`), one-off calendar
  events (`finance.calendar_events`), and **weekly-repeating recurring
  events** (`finance.recurring_calendar_events`, added v2.2.0 — a *rule*
  with `days_of_week`/`start_time`/`end_time`/a bounded `start_date`–
  `end_date`, expanded into actual occurrences by the pure
  `expandRecurringOccurrences` helper, never stored as individual rows).
  `/calendar` is the one route that bypasses the access gate.

  As of v2.5.0, `TravelCalendarSection` renders three switchable sections
  behind a pill tab switcher (person filter chips stay visible above all
  three, since they filter every section's content): **Dashboard** (the
  month grid plus a navigable "This week's schedule" day-list — both
  always expanded), **Report** (good windows for travel, the detailed
  chronological event list, and the recurring-rules list — each
  individually collapsed), and **Log** (three collapsed add-cards: trip /
  event / recurring). Tapping any day (a month-grid cell or a week-list
  row) expands `DayDetailCard` inline right below it — an "All day"
  section plus a time-sorted "Schedule" section — instead of opening a
  modal; there is no more full-screen day view. Items render as
  `ChipBadge`s (a bold saturated color bar + a pale body, not a solid
  color pill), and same-day recurring occurrences collapse into one "N
  classes" summary chip in the compact month-grid/week-list views —
  `DayDetailCard` is where each occurrence gets its own row and click
  target once expanded.

  v2.5.1/v2.5.2 cosmetic pass, on top of the above: the selected-day
  ring went from `ring-ink` (near-black in light mode) to a soft
  accent-tinted background + thin accent ring, visually distinct from
  the separate accent-outline "today" indicator; the section pill
  switcher (Summary/Details/Log, renamed from Dashboard/Report/Log)
  active state moved off `bg-ink` onto `bg-accent` for the same reason.
  Person identification in `DayDetailCard` switched from color-only
  dots (`PersonNames` replacing the old `PersonDots`) to actual
  color-coded names, capped and truncated so a trip with several
  travellers can't spill to a second line. `DayDetailCard`'s heading is
  one line now ("22 August Saturday", no "In N days" relative label),
  and its Schedule rows show the full time range with AM/PM
  ("10–11:30 AM") instead of a bare, truncated start hour. The public
  footer paragraph is one line (the public/no-password notice only —
  source-attribution detail dropped). `todayISODate()`
  (`lib/dates/calendar-grid.ts`) was computing "today" in UTC, not IST
  — wrong every morning between midnight and 5:30am IST; fixed to use
  `Asia/Kolkata` explicitly. A compact `ThemeToggleButton` (top-right of
  `Hero`, via a new `topRightAction` slot) makes dark/light reachable
  from `/calendar` without logging in, where the full Appearance card on
  More isn't reachable.
- **Card dues, connected to Dashboard (v2.5.4)**: a statement import
  used to only ever write to `credit_card_statements`/
  `credit_card_transactions` (Intel's reporting tables) — Dashboard's
  cycle math (`BudgetSnapshotService`'s `oneOff`,
  `lib/budget/home-stats.ts`'s `computeCardDuesTotal`) only reads real
  `finance.transactions` rows tagged to a cycle, which an import never
  created. `LogCardDuePrompt` (shown right after a successful/duplicate
  import, `StatementUploadForm`) closes that gap: pre-filled from the
  statement (amount due, due date, cycle — derived via
  `cycleMonthForStatementDate`), the person just confirms the
  from-account and hits Log payment. Reuses the same
  `logCardPaymentAction`/`createTransaction` path a since-removed
  standalone form (`CardPaymentQuickLog`, dead code, still in the repo)
  used to.
- **Budgets** (income/fixed-expense planning, not the older category-envelope
  model the very first design had — that was deleted, not hidden, per
  `INSTALL.md`'s v0.3 history): as of v2.1.0 this is shown **on Dashboard**,
  not a separate nav tab — see the revamp section above. `/budgets` still
  exists and works, just unlinked.
- **AIS**: static Income Tax Annual Information Statement summary for the
  current FY (`/ais`, added v1.13.0), linked from More. Hand-maintained
  reference data, not wired to the ledger.

## Repo orientation

```text
src/
  app/(app)/<route>/          # pages — thin, no business logic
  features/<feature>/
    api/                      # server actions (the real mutation surface — see doc 04)
    components/
  services/                   # server-only orchestration, one class per domain area
  services/statement-parsers/<issuer>/  # types, amounts, parse-header, parse-transactions,
                                          # classify-transaction, normalize-merchant, reconcile, index
  lib/                        # money (decimal.js-backed Money type), dates (month/recurrence —
                                # phase.ts was deleted in v2.0.0, no phase concept anymore), env,
                                # pdf, intel, budget, owner, access-gate
supabase/migrations/          # append-only, one file per change, heavily commented with the "why"
docs/                         # this folder
INSTALL.md                    # actual setup/deploy instructions + release history (root, not here)
```

Every migration and most service/parser files have long, dated comments
explaining *why* a decision was made, not just what it does — read those
before re-deriving a decision from scratch. `docs/v1.5.0-reconstruction-guide.md`
is a large historical snapshot from the Merchant Dictionary build; useful
as an archive, not something to keep in sync going forward.

## Working conventions that matter immediately

- **Money** is never a raw number. Use the branded `Money` string type and
  helpers in `src/lib/money` (`addMoney`, `subtractMoney`, `sumMoney`,
  `parseMoney`, `dbNumberToMoney`, `moneyToDbNumber`, `ZERO`), backed by
  decimal.js. Never do arithmetic with `+`/`-` on amounts directly.
- **Statement parsers** follow one fixed module shape per issuer —
  `types.ts`, `amounts.ts`, `parse-header.ts`, `parse-transactions.ts`,
  `classify-transaction.ts`, `normalize-merchant.ts`, `reconcile.ts`,
  `index.ts` — each with a matching `.test.ts` using **synthetic fixtures
  only**. Never commit a test fixture built from a real personal
  statement; validate against real data in a throwaway scratch test, then
  neuter it back to an inert `describe.skip` stub before committing (see
  any `__scratch-*.test.ts` file for the pattern).
- **Reconciliation before persistence**: a statement's parsed transactions
  are summed and checked against the statement's own printed totals
  (`reconcile.ts`, relative tolerance) before the statement is allowed to
  save. If it doesn't reconcile, nothing is written — including no partial
  transaction rows.
- **Verification pipeline**, run before every commit:
  `npx tsc --noEmit`, `npx eslint .`, `npx prettier --check .`,
  `npx vitest run`. Whether a full local `npm run build` completes inside
  one tool call depends on the session's environment (see "Working
  environment" below) — if it times out, fall back to treating a
  successful Vercel deploy as the real build check instead of claiming a
  local build passed.
- **Versioning**: `APP_VERSION` in `src/lib/version.ts`, bumped with every
  release, shown in the app's own header. Commit messages follow
  `vX.Y.Z: <summary>` and match the version bump in the same commit.

## Working environment (observed directly, v2.5.1–v2.5.9 sessions — verify fresh, don't assume it always holds)

Earlier revisions of this doc described a heavily restricted "Cowork"
sandbox here (no file deletion, no `next build`, a manual
`git commit-tree` workaround, no `git push`). **None of that held in the
sessions that shipped v2.5.1 through v2.5.9** — this section is what
actually worked, replacing that. Environment capabilities can differ
session to session (a different harness, a different sandbox profile),
so treat this as "what to try first, and a known-working fallback," not
a permanent guarantee — a quick `rm` of a scratch file or a plain
`git commit` will fail loudly and fast if this session is more
restricted, at which point falling back to the older workaround (still
valid technique, just shouldn't be your default) is reasonable.

- **Normal filesystem operations work**: `rm`, file edits, moving files
  — no `EPERM` failures seen. A scratch/temp file (see "Verifying a
  change" below) can just be deleted with `rm` when done.
- **Normal git works**: plain `git add`/`git commit`/`git push`, feature
  branches, no manual `commit-tree`/index workaround needed. This repo's
  real remote (`github.com/krohit81-pixel/expenses-dashboard`) is a
  bind-mounted real clone with a working `git credential` (osxkeychain)
  — `git push` actually reaches GitHub.
- **`gh` (GitHub CLI) is not installed.** For opening/merging a PR, use
  the GitHub REST API directly via `curl`/`python3`, authenticated with
  the same credential `git push` already uses:
  `git credential fill <<< $'protocol=https\nhost=github.com\n'`
  extracts it (never print the token itself — pipe straight into the
  API call). `POST /repos/{owner}/{repo}/pulls` to open, `PATCH` the
  same endpoint with a `/{number}` to edit title/body, `PUT
  .../pulls/{number}/merge` to merge, `DELETE
  /repos/{owner}/{repo}/git/refs/heads/{branch}` to clean up the branch
  after. One branch per logical change (`fix/…`, `feat/…`,
  `cosmetic/…`), `vX.Y.Z: <summary>` commits, matches the convention
  already established across this repo's PR history.
- **`vercel` CLI is available** and, once authenticated, confirms a real
  production deploy: `vercel ls atlas` (or your project name) shows
  Building → Ready status and the deployment URL;
  `vercel inspect <deployment-url>` lists its aliases (this project's
  production domain, `expdash.vercel.app`, is one). The *first*
  `vercel whoami`/`vercel ls` call in a session may trigger an
  unprompted device-auth login that completes on its own — flag that to
  the user rather than silently proceeding, same as any other
  unexpected authorization event. After merging to `main`, Vercel's own
  Git integration deploys automatically; poll `vercel ls` until
  `Ready`, then `curl` the production URL to confirm no error page and
  the expected `APP_VERSION` in the HTML, rather than assuming the merge
  alone means it's live.
- **This dev environment's `.env.local` points at the same real Supabase
  project as production** — there is no separate dev database. Local
  testing (even `next dev` on `localhost`) reads and can write real
  household data. Verify new UI against fixture props/data in a
  temporary route rather than clicking through real mutating buttons
  locally; see "Verifying a change" below.
- **`npm run build` timeout status is unverified** — never actually run
  in these sessions (a successful Vercel deploy was used as the real
  build check every time instead, which is strictly more authoritative
  than a local build anyway). If you need a local build specifically,
  try it and note what actually happens rather than assuming either the
  old "always times out" claim or that it'll just work.
- **Personal data**: statement PDFs and extracted text the user shares
  are real financial data. Never let it end up in a committed test
  fixture or doc. Validate against it in a scratch test/file, confirm,
  then neuter or discard the scratch artifact.

### Verifying a change without touching real data

The access gate (`APP_ACCESS_PASSWORD`) blocks every route except
`/calendar` and `/login` — and this session shouldn't be entering that
password to authenticate through the UI (see the credential-handling
rules governing the session generally). The pattern used successfully
throughout v2.5.1–v2.5.9: create a temporary page at
`src/app/(app)/calendar/preview-temp/page.tsx` (any subpath under
`/calendar/` inherits its gate-free status —
`isPublicPath`/`PUBLIC_PATHS` in `src/middleware.ts` matches by prefix),
render the real component directly with fixture props (not through the
real data-fetching page), screenshot/inspect it via the browser tools,
then delete the file before committing. For anything that would call a
real mutating server action (a real merge, a real transaction write, a
real paid LLM API call), don't click it for real during verification —
either use obviously-fake IDs so the mutation harmlessly fails against
Supabase (confirms the wiring and error path with zero risk), or skip
that specific interaction and say so explicitly rather than guessing
it works.

## Where to look for more detail

- Root `INSTALL.md` — actual env vars, setup, deploy, and a running
  troubleshooting log of real production errors hit so far.
- `supabase/migrations/*.sql` — read the comments, not just the DDL; they
  carry most of the schema's design rationale.
- `docs/01` through `docs/12` — updated to match current reality where
  they hold, explicitly marked where they describe a still-pending future
  direction rather than what's built.
