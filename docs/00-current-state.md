# Current State — Read This First

Every other doc in this folder was written as a **pre-implementation target
architecture**, before any product code existed. The app has since been
built out substantially, and in a few places diverged from that original
target on purpose, after hitting real constraints. This doc is the
correction layer: what's actually true today, current as of **v3.4.1**
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

## v3.1.1: header/footer spacing fix

Two small spacing corrections reported right after v3.1.0 shipped:

- **Hero's `min-h-[190px]` dropped to `min-h-[100px]`.** That floor dates
  from when every bottom-nav page's Hero carried real
  title/label/amount/sub content tall enough to need it. Since v3.1.0,
  Dashboard's Hero is chrome-only (wordmark + `subtitle`, no
  title/label/amount/sub — see the v3.1.0 section above), so the old
  floor forced roughly 90px of dead empty space under it before "01
  Cycle Brief" even started. 100px matches what the shortest real
  content already needs on its own; pages with more content (a plain
  `title`, or the full title/label/amount/sub set) still grow past it
  exactly as before.
- **`BottomNav`'s per-link padding, `py-3` → `pt-2.5 pb-1.5`**
  (`src/components/app-nav.tsx`). The 12px `py-3` bottom padding was
  stacking on top of the nav's own `env(safe-area-inset-bottom)`
  padding, reading as an oversized gap under every label on a real
  notched phone. The safe-area padding itself is untouched — that's
  the real, necessary device-mandated gap protecting the
  home-indicator gesture area, not what was being fixed.

## v3.1.2: Recurring's "Generate due transactions" now respects the viewed cycle

Reported directly: browse Recurring forward to a future cycle (the
page's own month-nav, e.g. September while today is still in August's
cycle) and click "Generate due transactions" — it used to call
`generateDueTransactions()` with no `asOf` at all, which defaults to
literal today, so it silently caught up whatever's due by *today's*
real date regardless of which cycle was on screen. "This tagging
should be done to the cycle selected above. Currently it is not," in
the household's own words.

Fix: `GenerateDueTransactionsButton` (`src/features/recurring/components/`)
now takes a `cycleMonth` prop, submitted as a hidden form field;
`generateDueTransactionsAction` reads it and passes
`cycleWindowEnd(cycleMonth)` (new, `lib/dates/month.ts` — the last real
date inside that cycle's own window, e.g. `"2026-09-24"` for cycle
`"2026-09"`, mirroring `currentCycleMonth`'s own rollover rule) as
`asOf`. `generateDueTransactions` already supported an `asOf`
parameter for exactly this; it just wasn't wired up from the UI. A
browsed-to past cycle now just limits catch-up to that cycle's own
window instead of running past it.

Also fixed alongside, same root cause (Recurring's cycle-nav not
correctly propagating into client state): `RecurringCycleTagger` gained
`key={cycleMonth}` on its call site — without it, React reconciled the
same component instance across cycle navigation and its `checked`
selection state carried over from whichever cycle was viewed
previously instead of resetting to the new cycle's own due list. The
`cycleMonth` hidden input driving "Apply to this cycle" itself was
already correctly prop-driven (verified, not changed) — only the
pre-checked *selection* was stale, not which cycle got tagged.

## v3.2.0: calendar-event reminders, first notification channel Telegram

The first slice of a generic notification architecture (financial-event
reminders — recurring due dates, card statement dues — come later, same
shape, not built yet): a "Remind me" toggle on Add/Edit event, trip,
and recurring-event, sent via Telegram once linked. Two-round design
pass before any code (financial-event architecture research, then a
refinement pass separating Event/Rule/Channel and confirming the
Vercel plan) — see git history for both; this section covers what
actually shipped.

- **Schema**: `finance.notification_channels` (where a reminder can
  go — one row per (user, channel_type), v1 only populates `telegram`,
  `config` jsonb holds the channel-specific target so a future channel
  doesn't need its own table), `finance.notification_rules` (created
  now for a later financial-event UI, **not read** by this pass — see
  below), and `finance.notification_log` (the dedupe/audit trail — a
  **partial** unique index over `status = 'sent'` rows only, so a
  logged failure never blocks a later retry of the same reminder).
  `calendar_events`/`trips`/`recurring_calendar_events` each gained
  `remind_enabled`/`remind_lead_days` directly on the row — no
  separate rule object to create/manage for this pass, since "add
  event → toggle a reminder" is naturally a couple of columns on the
  event itself. Migration:
  `supabase/migrations/20260822061100_create_notifications.sql` —
  **applied to the real Supabase project** (household ran it directly
  via the SQL editor after the v3.2.0 deploy briefly broke `/calendar`
  — see the troubleshooting note below). `src/lib/db/database-types.ts`
  is still the hand-extended version from this session, though (no
  live Supabase CLI available) — a real `npm run db:types` run once
  someone has CLI access would confirm/replace it, not urgent since
  the hand-added shape has been running in production without issue.
- **No new "future expense" event-source table.** Confirmed during
  research: `finance.recurring_transactions` (any `frequency`, plus
  `ends_on` capping it to a single occurrence) already covers both
  genuinely recurring and one-off future financial obligations — a
  real gap worth closing later for financial events, but not a reason
  to add a competing table.
- **Provider abstraction**: `src/lib/notifications/provider.ts`
  (`NotificationProvider` interface, mirrors `lib/ai/providers.ts`'s
  shape on purpose), `providers/telegram.ts` (the only implementation
  so far — plain `fetch` against Telegram's Bot API,
  `TELEGRAM_BOT_TOKEN`-gated), `registry.ts` (the one place that maps
  a channel type to its provider — a second channel later is a new
  file plus one registry entry, nothing else changes).
- **Channel linking isolated**: `NotificationChannelService` is the
  only thing that knows a Telegram chat ID is entered by hand today
  (Settings → `TelegramSettingsForm` → `saveTelegramChatIdAction`) —
  `getSendTarget()` is the one function everything else calls. A
  future `/start`-webhook linking flow only changes what's *inside*
  this service. No webhook built.
- **Detectors + engine**: `src/lib/notifications/detect-reminders.ts`
  (pure functions, unit-tested — reuses `expandRecurringOccurrences`
  for the recurring-event case rather than re-deriving occurrence
  math) feed `ReminderService.runReminders()`, which fetches real rows
  via the existing `list*()` service functions, dedupes against
  `notification_log`, and sends. `RunRemindersButton` (Settings) is
  the manual trigger — same role `GenerateDueTransactionsButton` plays
  for `generateDueTransactions`, lets the whole pipeline be exercised
  before any scheduler exists.
- **UI**: `ReminderFields` (`src/features/calendar/components/`) is
  the one shared checkbox+lead-time-select component used by
  `AddEventModal`, `AddTripModal`, and `AddRecurringEventModal` — a
  plain checkbox (this app has no dedicated Switch component), styled
  like `RecurringCycleTagger`'s bulk-tagging checkboxes.
  `remindLeadDays` offers 0/1/3 days in the UI but the column itself
  isn't constrained to those values, so a richer picker later needs no
  migration.
- **End-to-end confirmed working in production**, post-deploy:
  `TELEGRAM_BOT_TOKEN` is set in Vercel (this line previously also
  claimed `CRON_SECRET` was already set as of v3.2.0 — **that was
  wrong**, caught in the v3.2.1 session by actually checking
  `vercel env ls production` instead of trusting this doc: the var
  didn't exist yet, and `/api/cron/reminders` 503'd until it was added
  and Production was redeployed — see the v3.2.1 section below for
  the real timeline); the household linked a Telegram **group** (not a
  personal DM) as the
  destination — `finance.notification_channels.config.chat_id` holds
  the group's id as a negative number string (e.g. `"-4930398936"`,
  no `-100` prefix since it's a plain `"group"` type chat, not a
  `"supergroup"`); `verified_at` is set after a real "Send test
  message" landed in the group. "Run reminders now" (Settings) has
  been used successfully. One real bug hit and fixed along the way,
  worth knowing if it resurfaces: the chat-ID `<Input>` is a plain
  text field with no numeric sanitization, so nothing in the app
  strips a leading `-` — the one time it went missing was a pure
  data-entry slip when the id was first pasted in, not a code issue.
- **Vercel Cron wiring shipped in v3.2.1** — see that section below.
  `/api/cron/reminders` and `vercel.json` did not exist as of v3.2.0
  itself; the manual "Run reminders now" button was the only trigger
  for that release.

## v3.2.1: Vercel Cron wiring for reminders

Puts the already-working manual reminder trigger (v3.2.0) on a timer —
nothing about the reminder detection/send logic itself changed.

- **`src/app/api/cron/reminders/route.ts`** (new): a `GET` Route
  Handler that calls `ReminderService.runReminders()` — the exact same
  function `RunRemindersButton`'s server action already called. Not
  behind the access-gate cookie (Vercel Cron has no browser session to
  carry one); authenticates itself instead by checking
  `Authorization: Bearer $CRON_SECRET` against `serverEnv.CRON_SECRET`,
  via `timingSafeStringEqual` (`access-gate-core.ts` — the same tested
  primitive the access-gate cookie itself uses, reused rather than
  writing a second timing-safe comparison). Two failure modes, both
  before `runReminders()` is ever called: `503` if `CRON_SECRET` isn't
  set at all (refuses to run unauthenticated rather than treating "no
  secret configured" as "anything goes"), `401` for a missing/wrong/
  non-`Bearer` token. See `route.test.ts` for all four rejection paths
  plus the happy path.
- **`middleware.ts`'s `PUBLIC_PATHS` gained `/api/cron`** — a different
  reason than `/calendar`'s public-by-design exemption: the access-gate
  cookie check would otherwise redirect every cron invocation to
  `/login` before the route's own `CRON_SECRET` check ever ran, since
  Vercel Cron requests carry no cookie. The route still authenticates
  itself independently; this bypass only skips the cookie gate, not
  authentication generally.
- **`vercel.json`** (new, repo root): one `crons` entry,
  `"schedule": "0 */4 * * *"` — every 4 hours, chosen (asked directly)
  over a once- or twice-daily schedule for lower latency between an
  event's reminder being added/edited and it actually firing;
  `notification_log`'s dedupe (already built in v3.2.0) makes the more
  frequent invocations safe — a candidate already sent is skipped, not
  resent, on every subsequent run within the same lead-day window.
  Confirmed on the project's Vercel Pro plan, which has no Hobby-tier
  once-daily cron ceiling.
- **`CRON_SECRET` is still optional at the env-schema level**
  (`src/lib/env/server.ts`) — the app must still boot in a fresh
  environment before anyone's set it in Vercel — but is now
  effectively required in production: unset, the route 503s on every
  invocation instead of silently doing nothing.
- **Verified**: `npx tsc --noEmit && npx eslint . && npx prettier
  --check . && npx vitest run` all pass locally, including the new
  `route.test.ts`. A real Vercel deploy + a real scheduled cron run
  landing a Telegram message has **not** been confirmed in this
  session — see the handoff note in this doc's version-history commit
  for what's still open.

**Same PR, a second reminder source added on request**: the static
Ahaana/Rohana school calendars (`src/features/calendar/data.ts` — CNS
holidays, CA1/CA2 exam dates, NUS calendar, every tag: holiday/exam/
vacation/event/trip, 105 entries total) now get an automatic,
always-on 1-day-before reminder, same delivery pipeline as everything
else. Household asked directly ("for all the school calendars ... I
would want a notification reminder created for all that events for 1
day before") and confirmed scope as literally everything, not a
holiday/exam-only subset, when asked to choose.

- **New `school_calendar_event` notification type**
  (`supabase/migrations/20260822095409_add_school_calendar_event_notification_type.sql`
  — `ALTER TYPE ... ADD VALUE`, **not yet applied to the real Supabase
  project as of this PR** — same "apply the migration before the code
  that depends on it goes live" lesson v3.2.0 already hit once with
  `/calendar`. This one's blast radius is smaller (only reminder sends
  touch this column, not every page load), but still: **apply this
  migration before merging/deploying**, or `ReminderService.runReminders()`
  will throw the first time a school-calendar candidate is actually due
  and the insert into `notification_log` fails on the missing enum
  value.
- **Deliberately a distinct type, not reusing `'calendar_event'`** —
  these are static data-file rows, not `finance.calendar_events` rows,
  and never will be: turning all 105 into real DB rows would make each
  show up twice on `/calendar` (once from the static list already
  rendered via `buildSchoolCalendarItems()`, once as a new DB-backed
  event). No new table, no UI, no per-item toggle — see the migration's
  own comment.
- **`detectSchoolCalendarReminders`** (`lib/notifications/detect-reminders.ts`)
  is the new pure detector, wired into `ReminderService.runReminders()`
  alongside the other three. Fixed lead time
  (`SCHOOL_CALENDAR_LEAD_DAYS = 1`), not per-item — there's no toggle
  UI for static data. `eventKey` is built from person + startDate +
  slugified title (no stable id exists on a data-file row); a later
  edit to a title string in `data.ts` will cause that one item's
  reminder to resend once — an accepted tradeoff, not a bug, for
  static once-a-year data.
- **Dedup already covers this correctly, no extra logic needed**: it's
  the same `notification_log` partial-unique-index mechanism every
  other event type uses — a school-calendar reminder fires once, ever,
  per (item, lead time, channel), regardless of how many times the
  4-hourly cron ticks on its due day.

## v3.2.2: hour-based reminders ("3/4 hours before")

Household asked (right after v3.2.1 shipped) for a more granular
option alongside the existing 0/1/3-*day* lead times, specifically for
things that have a real time of day — a class, or an event logged with
a specific time — not for trips or the static school calendars.

- **Scope, exactly as asked**: recurring calendar event rules (already
  had a real `start_time`) and manually-logged calendar events (gained
  an *optional* new `start_time` — the household explicitly wanted "to
  add the time for events getting logged into the screen"). Trips stay
  day-before-only, no time field, per explicit instruction ("even for
  trips, we can have it a day before, don't need time"). The static
  Ahaana/Rohana school calendars are untouched — same reasoning as
  v3.2.1's own scoping, no time data exists in that source at all.
- **New `remind_lead_hours` column** on both `calendar_events` and
  `recurring_calendar_events` (nullable, `check (> 0)`, unconstrained
  beyond that — same "don't over-constrain a column for a UI-level
  choice" precedent `remind_lead_days` already set; the UI only offers
  3/4 hours). Mutually exclusive with `remind_lead_days` in practice:
  a row with `remind_lead_hours` set is skipped entirely by the
  day-based detectors and picked up only by the new hourly ones — see
  `detect-reminders.ts`'s comments on each detector for exactly how.
  Migration:
  `supabase/migrations/20260822102845_add_hourly_reminders.sql` — same
  "apply this in the Supabase SQL editor before the code that depends
  on it ships" requirement v3.2.1's own migration had.
- **`notification_log` gained `lead_time_unit`** (`'days'` default |
  `'hours'`), part of the sent-dedupe key now alongside
  `lead_time_days` — without it, a 3-day and a 3-hour reminder for the
  same event would collide in the dedupe index, each looking like a
  duplicate of the other. The partial unique index was dropped and
  recreated to include it (Postgres has no in-place "add a column to
  an index").
- **Two new pure detectors**
  (`detectCalendarEventHourlyReminders`/`detectRecurringEventHourlyReminders`,
  `lib/notifications/detect-reminders.ts`) — unlike every day-based
  detector, these compare a real UTC instant, not a date string:
  `istDateTimeToUtcMillis` combines a date+time as an **IST**
  wall-clock value (this household's real timezone; Vercel's servers
  aren't in it) into the equivalent UTC instant, and a candidate is
  "due" for the whole window between the reminder threshold and the
  event's own start — same "due for a while, dedup makes repeat runs
  harmless" shape the day-based detectors already use, just measured
  in hours instead of a day.
- **A second, more frequent Vercel Cron** — `/api/cron/reminders-hourly`
  (new route, same `checkCronAuth` bearer-token check as the original
  route, now factored into `src/lib/cron-auth.ts` so the two can't
  drift), `every 15 minutes` in `vercel.json`. Deliberate architecture
  choice, asked directly: keep the existing 4-hour cron exactly as
  infrequent as it already was for day-level reminders, add a
  dedicated frequent one only for the new hour-based case, rather than
  tightening the single existing schedule (worst-case lag on an
  hour-based reminder is therefore ~15 minutes).
  `ReminderService.runHourlyReminders()` is the new engine function
  this route calls, alongside the existing `runReminders()` (day-based,
  unchanged) — both now share a `sendCandidates()` helper for the
  actual dedupe/send/record loop, factored out of `runReminders` during
  this pass.
- **UI**: `ReminderFields` (`src/features/calendar/components/`) gained
  an opt-in `allowHourly` prop and a Days-before/Hours-before segmented
  toggle — `AddTripModal` never passes it (unchanged, byte-for-byte the
  same submitted fields as before this existed);
  `AddRecurringEventModal` always passes it true (a rule always has a
  time); `AddEventModal` passes `Boolean(startTime)` — the Hours option
  only appears once the event's own new, optional Time field has a
  value, and clearing that field also clears any active hour-based
  reminder rather than leaving it pointing at nothing.
- **Verified**: `npx tsc --noEmit && npx eslint . && npx prettier
  --check . && npx vitest run` all pass (510 passed). A full local
  `npm run build` also completed successfully. New UI verified visually
  via the `/calendar/preview-temp` scratch-page pattern (deleted before
  committing) — confirmed the Time field, the Days/Hours toggle
  appearing only once a time is set (AddEventModal) vs. always
  (AddRecurringEventModal), and the 3/4-hour option list.

## v3.3.0: Calendar restyle + Log reorder + recurring folded into Add Event

Household: `/calendar` "looks so outdated" next to Dashboard's v3.1.0
"classy and sleek" rebuild — asked to reuse Dashboard's visual
language, reorder Log to the middle and make it bigger, and let
"Repeats weekly" happen right inside Add Event instead of needing a
separate section. Purely a UI/UX pass — no schema change, no new
migration.

- **`SectionHeading` (`src/features/dashboard/components/`) is now
  shared, not Dashboard-only.** Extended with two optional additions
  so Calendar's more varied headers (some collapsible, a couple with
  their own extra nav controls) can reuse the exact same numbered/
  accent-bar/uppercase-title look without forcing every call site
  through a rigid shape: `right` (arbitrary content after `meta` — a
  "this week" jump button, month-nav arrows) and `onClick`/`expanded`
  (turns the whole heading into a real collapse/expand toggle, chevron
  included, instead of Dashboard's always-static one). Applied to
  `WeekScheduleGrid`, `GoodTravelWindows`, `TripDetailedList`,
  `RecurringEventsList`, and `LoggingSection` — replacing each one's
  old plain `<h2 className="font-display text-[15px] font-bold...">`.
  `TripCalendarGrid`'s own month-label header was deliberately left
  alone — it's a card-internal month-nav row (same role as
  Dashboard's `DashboardMonthNav` living inside `CycleBriefCard`), not
  a page-level section, so the numbered treatment would be a style
  mismatch there.
- **Log moved from last to the middle of the Summary/Details/Log
  pill switcher** (`TravelCalendarSection.tsx`) — now Summary/Log/
  Details — and reads visually bigger than its two siblings
  (`flex-[1.4]` + `text-[13.5px]` vs `flex-1` + `text-[12.5px]`),
  since it's the tab people actually tap to do something on, not just
  review data like the other two.
- **`LoggingSection` reordered and trimmed**: Add an event now comes
  first (opened by default, since it's the more common action) with
  Add a trip below it — was Trip/Event/Recurring. Each `LogCard` is
  sized up a notch too (bigger icon tile, `rounded-[22px]`, more
  padding, a larger title) as part of Log reading like the primary
  tab it now visually is.
- **The standalone "Add a recurring event" card is gone.**
  `AddEventModal` itself gained a "Repeats weekly" checkbox
  (add-flow only, `!isEditing` — see its own comment for why editing
  an existing single event was deliberately left out of scope: there's
  no obviously-right meaning for "turn this existing event into a
  recurring rule mid-edit"). Toggling it on:
  - swaps which server action the same `<form>` submits to
    (`createRecurringCalendarEventAction` instead of
    `createCalendarEventAction` — both actions happen to already share
    almost every field name: title, people, notes,
    remindEnabled/remindLeadDays/remindLeadHours, startDate, endDate,
    startTime; only mode/daysOfWeek/endTime are recurring-specific
    additions rendered conditionally into the same form)
  - hides the Category select (recurring rules have no `tag` column)
  - relabels Start/End date as "From"/"Until"
  - adds a day-of-week picker (reuses `AddRecurringEventModal`'s own
    now-exported `DAY_OPTIONS`, not a second copy) and an "Ends" time
    alongside the existing Start time field, defaulting both times in
    (08:00/09:30) the moment the toggle flips on rather than leaving a
    required field empty
  - changes the submit button to "Save recurring event"

  `AddRecurringEventModal` itself is **unchanged** and still exists —
  it's what opens when an existing rule is tapped for editing
  (grid/week view/Recurring events list all still call
  `onRecurringClick` → the same edit modal as before). Only the
  standalone **add** entry point moved into `AddEventModal`.
- **Verified visually** against the real `/calendar` page (public
  route, no scratch page needed): tab reorder/sizing, the restyled
  numbered section headers on Details and Summary, `LoggingSection`'s
  new order/sizing, and the "Repeats weekly" toggle actually
  transforming the Add Event form (Category disappears, From/Until +
  Starts/Ends + day picker + Mode appear, button label changes) —
  screenshots taken during the session. `npx tsc --noEmit && npx
  eslint . && npx prettier --check . && npx vitest run` all still
  pass (510 passed, unchanged — this pass added no new pure-function
  logic to unit test, it's forms/layout), and a full local `npm run
  build` completed successfully.

## v3.3.1: Summary page — Monthly Schedule numbered, new Add Event card

Small follow-up requested right after v3.3.0 shipped: the Summary tab's
month grid never had a numbered section header (deliberately, at the
time — see v3.3.0's note on why `TripCalendarGrid`'s own header was
left alone), and there was no quick way to add an event without
switching to the Log tab first. Both addressed:

- **`TripCalendarGrid` is now wrapped in its own `<section>` with
  `SectionHeading index="01" title="Monthly Schedule"`** — the
  component itself is unchanged; `TravelCalendarSection` just wraps it.
- **`WeekScheduleGrid`'s own header renumbered `01` → `02`** (still
  "This Week's Schedule", nothing else changed there) to make room for
  Monthly Schedule as `01`.
- **New `03 Add Event` card on Summary** — a plain button (not a
  `Link`, since it opens the same `AddEventModal` state Log's own "Add
  an event" card already drives — this is a second door into the
  identical modal, not a separate flow) styled like Dashboard's own
  link-cards (`rounded-[20px] bg-surface p-5` + icon tile + title/
  subtitle + right-aligned CTA text). Summary now reads Monthly
  Schedule → This Week's Schedule → Add Event, so adding something no
  longer requires switching tabs first.
- **Verified visually** against the real `/calendar` page: confirmed
  "01 Monthly Schedule" renders above the grid, "02 This Week's
  Schedule" keeps its own content unchanged, and clicking the new "03
  Add Event" card's "+ Add" button actually opens `AddEventModal` (not
  just a static card) — including the "Repeats weekly" toggle from
  v3.3.0 being present in it, same as reaching the modal from Log.
  `npx tsc --noEmit && npx eslint . && npx prettier --check . && npx
  vitest run` all pass (510 passed, unchanged), and a full local `npm
  run build` completed successfully.

## v3.3.2: reminder notification text — no repeated title, time/notes shown

The very first real reminder to fire on the new cron (the "VJ Flat
visit with Daddy" one, confirmed landing at the 5:30pm IST tick right
on schedule) surfaced a real readability issue: `TelegramProvider`
sends `*{title}*\n{body}` — bold title, then body — but every
detector's `body` string repeated the full title again inside itself
("VJ Flat visit with Daddy — Aug 23, 2026 (in 1 day)"), so the actual
message read the same sentence twice. Household asked to see mockups
before changing anything (via a couple of format options with
previews); chose "labeled lines with emoji," applied to all four
reminder types, not just calendar events.

- **`buildBody()`** (`lib/notifications/detect-reminders.ts`, new) —
  joins an array of lines, dropping any `null`/`undefined` entry
  (no time set, no notes) instead of rendering an empty line. Every
  detector's body is now built through this instead of a hand-rolled
  "X — Y (Z)" sentence.
- **Calendar events**: `📅 {date}[ at {time}]` (time line only when
  `startTime` is set) → `⏰ {N days before / Today}` → `📝 {notes}`
  (only when set). Same shape for the hourly variant, just `⏰ Nh
  before` and time is always present (hourly reminders require a
  `startTime` to exist at all).
- **Trips**: `📅 Departs {date}` → `✈️ {flight}` (only when set) →
  `⏰ {lead label}` → `📝 {notes}` (only when set).
- **Recurring events**: `📅 {occurrence date} at {time}` → `⏰ {lead
  label}` → `📝 {notes}` (only when set, read from the occurrence's
  own `notes`, copied from the rule). Same shape hourly.
- **School calendar events**: `👤 {person}` → `📅 {date}` → `⏰ {lead
  label}` — no time/notes fields exist on the static source data, so
  those lines just never applied here; person replaces the old
  "Ahaana: " prefix as its own line instead.
- New helpers: `formatTime12h` ("6:00 PM" from a stored "HH:MM"
  24-hour time) and `daysBeforeLabel`/`hoursBeforeLabel` (replacing
  the old `whenLabel`, which produced "in N days" for use mid-sentence
  — these produce "N days before"/"Today"/"Nh before" for use as their
  own line).
- **Verified**: new unit tests per detector (`detect-reminders.test.ts`)
  assert the exact new body string for both the bare case (no time, no
  notes) and the richer case (time and/or notes set), plus that the
  title never appears inside the body. `npx tsc --noEmit && npx eslint
  . && npx prettier --check . && npx vitest run` all pass (515 passed
  — +5 new). A full local `npm run build` completed successfully. Not
  re-verified against a real Telegram send in this session (that would
  require waiting for a real event to come due, or clicking a real
  send button, which this session doesn't do) — the exact body strings
  are unit-tested directly instead.

## v3.3.3: reminder notification text — added a people/tagged line

Follow-up to v3.3.2, spotted immediately after that shipped: the new
body format dropped who an event/trip/class was actually tagged to —
the same `people` (`CalendarEvent`/`RecurringCalendarEvent`) /
`travelerNames` (`Trip`) array every "Who's this for" UI already reads
and displays, just never surfaced in the reminder message itself.

- **`peopleLine()`** (`lib/notifications/detect-reminders.ts`, new) —
  `👥 {names.join(", ")}`, or `null` (dropped by `buildBody`) when
  nobody's tagged. Added as the **first** line of the body — before
  the date — for calendar events, trips, and recurring events (both
  day- and hour-based variants), mirroring the ordering
  `detectSchoolCalendarReminders` already used for its own single
  `person` field (v3.2.1). School-calendar reminders themselves are
  unchanged — that `👤 {person}` line already covered this.
- A tagged calendar event/trip/class now reads, e.g.:
  ```
  Dinner with the Sharmas
  👥 Rohit, Ahaana
  📅 Aug 24, 2026 at 7:00 PM
  ⏰ 1 day before
  📝 Bring wine
  ```
- **Verified**: extended/updated the v3.3.2 unit tests — the two
  richer-case tests (trip with a tagged traveller, recurring rule with
  a tagged person) now assert the people line appears first; a new
  test confirms a multi-person calendar event joins names with ", "
  and that the bare (nobody tagged) case still omits the line
  entirely. `npx tsc --noEmit && npx eslint . && npx prettier --check
  . && npx vitest run` all pass (516 passed — +1 new). A full local
  `npm run build` completed successfully.

## v3.3.4: school-calendar reminders — a tag-derived "smart note"

Household request: "put something smart in the notes" for the
CNS/CA/NUS school-calendar reminders — an exam gets encouragement, a
holiday gets a "make the most of it," etc. Over 100 static entries
across both calendars, so this is derived purely from each item's own
`tag`, not typed per item — one lookup table to tweak wording for
every entry, rather than 100+ individual notes to maintain.

- **`TAG_SMART_NOTE`** (`lib/notifications/detect-reminders.ts`, new)
  — a `Record<EventTag, string>` (every tag gets a line, not a
  `Partial`, so the reminder never looks like it forgot to say
  anything):
  - `exam`: "All the best! Prepare well." — covers Ahaana's CA1/CA2
    subject tests too (a CA *is* an exam-tagged entry — no separate
    case needed, confirmed with the household) and Rohana's own
    examination-period entries.
  - `holiday`: "Enjoy the holiday — make the most of it!"
  - `vacation`: "Enjoy the break — make the most of it!" (a longer
    stretch than a single holiday, worded slightly differently but
    same spirit — household only specified exam/holiday explicitly;
    this and the two below are a reasonable extension, open to
    adjustment).
  - `event`: "Hope it goes well!" — the one tag broad enough (Orientation,
    PTM, Sports Day, subject-choice deadlines...) that nothing more
    specific fits every case.
  - `trip`: "Have a safe and fun trip!" (the one static "Educational
    Trip, Grades 6–8" entry).
- Rendered as the reminder's 4th line, after person/date/lead-time:
  e.g. `👤 Ahaana` → `📅 Aug 10, 2026` → `⏰ 1 day before` → `📝 All
  the best! Prepare well.`
- **Verified**: updated/added unit tests in
  `detect-reminders.test.ts` confirming the exact body string
  (person/date/lead-time/note, in that order) and that different tags
  produce different notes. `npx tsc --noEmit && npx eslint . && npx
  prettier --check . && npx vitest run` all pass (517 passed — +1
  new). A full local `npm run build` completed successfully.

## v3.4.0: Ahaana's mini app (Phase 1 of 3 — access, schedule, completion+notes)

Household request: a self-contained section of Atlas only Ahaana can
reach, covering her weekly activities and studies, planned and built
across three phases. Phase 1 (this release): access
gate, schema, the weekly schedule view, mark-complete + notes. Phase 2
(real push notifications, since she has no Telegram) and Phase 3
(weekly Telegram report to the parent + a progress/intel page) are
**not built yet** — separate follow-up releases.

- **A second, fully separate access gate.** New `AHAANA_ACCESS_PASSWORD`
  env var (optional at the schema level, same reasoning as
  `CRON_SECRET` — the app must still boot before anyone's set it in
  Vercel; her gate just refuses every `/ahaana` request until it is).
  `src/lib/ahaana-gate.ts` mirrors `access-gate.ts`, but — real
  correction made mid-build, not merely planned — signs her cookie
  with a **derived** key (`APP_SESSION_SECRET + ":ahaana-gate"`), not
  the raw `APP_SESSION_SECRET` the main gate uses. Reusing the exact
  same secret would have meant a valid `app_access` cookie value,
  copied into the `ahaana_access` slot, would also verify successfully
  (`access-gate-core.ts`'s sign/verify functions only check an HMAC
  signature — they carry no notion of *which* gate issued a token) —
  precisely the "her password is the only key that works there"
  guarantee this gate exists to provide, broken. The derived key needs
  no new env var and fixes this completely.
  `middleware.ts` branches on `/ahaana` **before** the main gate check
  and returns early either way, so her section never falls through to
  the household password check, and vice versa. Verified directly in
  this session: wrong password rejected, correct password redirects
  to `/ahaana`, her cookie does **not** grant access to `/dashboard`
  (redirects to the main `/login`).
- **Schema**: `finance.ahaana_activities` (the recurring weekly
  template — French, Kickboxing, Horse Riding, a study block; same
  shape as `finance.recurring_calendar_events` but kept as its own
  table since that one feeds the shared family `/calendar` page and
  this one never should) and `finance.ahaana_activity_logs` (one row
  per occurrence once marked complete — `covered_notes`/`next_notes`,
  unique on `(activity_id, occurrence_date)` so resubmitting edits
  rather than duplicates). Migration:
  `supabase/migrations/20260823024123_create_ahaana_activities.sql` —
  **not yet applied to the real Supabase project** (same
  household-runs-it-in-the-SQL-editor step every migration in this
  app needs) — until it is, `/ahaana` and `/ahaana/manage` both 500
  with "Could not find the table" (confirmed directly — the gate
  itself works, only the DB call fails, exactly the expected failure
  mode).
- **`expandAhaanaOccurrences`** (`lib/dates/ahaana-activities.ts`) — a
  near-identical sibling of `expandRecurringOccurrences`, not a
  generalization of it; unit-tested the same way.
- **UI**: `/ahaana` (this week's occurrences, grouped by day, each
  expandable to a "mark complete" form) and `/ahaana/manage` (add,
  deactivate, delete a recurring activity — editing an existing one's
  fields isn't in this pass; deactivate + re-add covers it for now).
  Both live in a new `src/app/ahaana/` tree, deliberately outside the
  `(app)` route group (no `BottomNav`/`TopNav`, no
  `requireUser()`/household-gate assumptions) with their own minimal
  layout.
- **Verified**: unit tests for `expandAhaanaOccurrences`
  (`npx tsc --noEmit && npx eslint . && npx prettier --check . && npx
  vitest run` all pass, 522 passed — +5 new). A full local
  `npm run build` completed successfully. Browser-verified end to end
  in this session: the gate's password/redirect/cross-section
  behavior against the real dev server, and both new pages' actual UI
  (weekly view, mark-complete form, add-activity form, activity list)
  against fixture props via a temporary `preview-temp` scratch page
  under `/ahaana/(gated)/` (deleted before committing, same pattern
  used throughout this app's history).

## v3.4.1: Ahaana's mini app (Phase 2 of 3 — real device push notifications)

Second of three phases. She has no Telegram, so this is genuinely new
infrastructure — no push capability of any kind existed in this app
before this pass (checked: no service worker, no VAPID keys, no
`web-push` dependency).

- **New dependency**: `web-push` (+`@types/web-push` dev dep). A VAPID
  key pair was generated once (`npx web-push generate-vapid-keys`) —
  new optional env vars `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/
  `VAPID_SUBJECT`. **Never regenerate this pair once real subscriptions
  exist** — the public key is baked into each subscription at creation
  time; a new pair silently breaks every existing one.
  `VAPID_SUBJECT` deliberately uses the project's own URL, not a
  personal email — the Web Push spec requires a contact URL/mailto,
  and a personal email would be sent to Google/Mozilla/Apple's push
  infrastructure on every single send.
- **`web_push` is a new `notification_channel_type`** (migration:
  `supabase/migrations/20260823032457_add_web_push_and_ahaana_reminders.sql`,
  **not yet applied**) — reuses `finance.notification_channels`
  (same table `telegram` already uses), `config` holding the push
  subscription object instead of a chat ID.
  `NotificationChannelService.mapRow` branches on `channel_type` to
  build `target` (JSON-stringifies the subscription for `web_push`) —
  every existing caller (`getSendTarget`, `ReminderService`) is
  untouched, since `target` is still just `string | null` either way.
  New `setWebPushSubscription()`, the web_push sibling of
  `setTelegramTarget`.
- **A real correctness fix made mid-build**: adding a second real
  channel meant `ReminderService.sendCandidates()`'s old default of
  "try every registered channel" (`listChannelTypes()`) would have
  sent the household's own calendar/trip/school reminders to Ahaana's
  device too, and her activity reminders to the household Telegram
  group. `sendCandidates()` now takes an explicit, required
  `channelTypes` parameter — `runReminders()`/`runHourlyReminders()`
  pass `["telegram"]`, the new `runAhaanaReminders()` passes
  `["web_push"]`. `registry.ts`'s `listChannelTypes()` is kept (some
  future caller with no opinion still wants a sane default) but no
  real caller relies on it anymore.
- **`finance.ahaana_activities` gained `remind_enabled`/
  `remind_lead_days`** (same migration) — day-based only, same shape
  every other reminder-capable table already has. `detectAhaanaActivityReminders`
  (new, `lib/notifications/detect-ahaana-reminders.ts` — kept separate
  from `detect-reminders.ts` since it detects from a different domain
  object and only ever targets one channel) mirrors the existing
  day-based detectors' shape. New `notification_event_type` member,
  `ahaana_activity`, for its own dedupe/log entries (same reasoning as
  `school_calendar_event`'s own addition in v3.2.1).
- **New cron**: `GET /api/cron/ahaana-reminders` (same `checkCronAuth`
  helper as the other two routes), a third `vercel.json` entry, every
  4 hours (same cadence as the household's own day-based reminders —
  no new tradeoff to weigh here, so not asked separately).
- **`public/ahaana-sw.js`** — a minimal service worker (shows a
  `Notification` on `push`, focuses/opens `/ahaana` on
  `notificationclick`), registered only from `/ahaana`, never the main
  app. `EnablePushButton` (`features/ahaana/components/`) is the
  client-side "enable reminders" control — adapts to three real
  states: iOS Safari not yet added to the Home Screen (shows an
  install instruction instead of a button that would silently fail —
  Web Push doesn't exist at all for a plain iOS Safari tab before
  iOS 16.4's PWA support), not yet subscribed (a real button), and
  already subscribed (a quiet confirmation). The activity form
  (`ManageActivitiesSection`) gained the same `remind_enabled`/
  `remind_lead_days` toggle every other reminder-capable form already
  has, reusing the existing generic `ReminderFields` component as-is
  (day-only mode, same as `AddTripModal`'s usage) rather than building
  a second one.
- **Verified**: new unit tests for `detectAhaanaActivityReminders`
  (mirrors `detect-reminders.test.ts`'s style) and the new cron route's
  auth behavior (401/503/200, same pattern as the other two routes'
  own tests). `npx tsc --noEmit && npx eslint . && npx prettier
  --check . && npx vitest run` all pass (532 passed — +10 new). A full
  local `npm run build` completed successfully.
  `EnablePushButton` was browser-verified against the real dev
  server (not just fixture-rendered) — it correctly read this
  session's actual `Notification.permission` state (denied, in this
  automated browser) and rendered the matching UI, confirming the
  detection logic runs against real browser APIs, not just plausible
  in theory. **Not verified**: an actual push notification arriving on
  a real device — that needs a real subscribe (deferred, same
  "don't click a real mutating external send from this session"
  reasoning as every other notification feature's rollout) once this
  is deployed and the household tries it on Ahaana's own device.

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
- **`npm run build` completed successfully in-session for the first time
  in the v3.2.1 session** — full production build, ~7s compile plus
  static generation, no timeout, no truncation. Earlier revisions of
  this doc called the timeout status "unverified" since every prior
  session used a successful Vercel deploy as the build check instead;
  that's still a fine fallback if a future session's sandbox behaves
  differently, but don't assume a local build won't complete — try it
  first.
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
