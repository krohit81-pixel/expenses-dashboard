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
| [Current state — read first](./00-current-state.md) | What's actually built, the real auth model, working conventions, working environment. |
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
- **Nav and look (v3.0.0–v3.1.0):** bottom nav is **Dashboard / Log /
  Intel / Calendar** — four tabs, no fifth. "More" is a bordered menu
  button in the top-right of every page's header (moved from a plain
  top-left icon in v2.5.8), paired with the date; the "Atlas" wordmark +
  version live on the left instead (the header's own icon/logo image
  was dropped in v2.5.9), not a nav tab; `/more` itself is unchanged.
  The header dropped its indigo gradient background in v3.0.0 — flush
  with the page background, ink-toned text, no separate colored bar.
  v3.1.0 swapped the app's accent color app-wide from purple to blue and
  rebuilt Dashboard around a Cycle Brief card, a cycle-over-cycle stat
  grid, and a Biggest Changes section (all since replaced — see the
  v3.4.14–v3.5.5 bullet below). Dashboard's cycle prev/next pager gained
  a visible loading spinner in v3.0.0, matching the fix Intel's
  card-level nav already had.
- **Reminders (v3.2.0–v3.3.4):** a "Remind me" toggle on calendar
  events/trips/recurring events, sent via Telegram once linked in
  Settings (generic notification provider, dedupe log — see doc 00's
  v3.2.0 section). v3.2.1 put that on a real schedule
  (`CRON_SECRET`-authenticated `/api/cron/reminders`, every 4 hours) and
  gave the static Ahaana/Rohana school calendars (105 entries) an
  automatic 1-day-before reminder. v3.2.2 added hour-based reminders
  ("3/4 hours before") on a second, more frequent cron
  (`/api/cron/reminders-hourly`, every 15 minutes) for anything with a
  real time of day. v3.3.0 restyled `/calendar` to match Dashboard's
  look and folded "repeats weekly" into Add Event as a toggle. v3.3.1
  numbered Summary's sections and added a quick-access "Add Event" card.
  v3.3.2/v3.3.3 rewrote reminder body text (no repeated title, a
  time/notes line, a people/tagged line). v3.3.4 gave school-calendar
  reminders a tag-derived "smart note."
- **Ahaana's mini app (v3.4.0–v3.4.13):** `/ahaana/*`, a fully separate,
  separately-password-gated section (her password never unlocks the
  rest of Atlas, and vice versa) — a recurring-activity schedule
  (French, Kickboxing, Horse Riding, study blocks), a
  mark-complete-with-notes flow, real device push notifications (she has
  no Telegram — VAPID keys, a service worker, a new `web_push` channel),
  and a weekly summary sent to the parent's Telegram every Sunday, plus
  a read-only "Ahaana's Progress" page reachable only through the main
  household gate. v3.4.3–v3.4.10 chased down a string of real-device
  issues (manifest identity, dark mode, a stale-after-reopen bug, the
  actual push-subscribe flow, tab-highlight state) one at a time until
  it was genuinely solid; v3.4.8 also added a real Edit flow and split
  her page into Dashboard/Log Activity tabs. v3.4.11 added a
  forward-looking "This week — what to expect" section to the parent
  progress page. v3.4.12 added a deliberately minimal school-email proof
  of concept (IMAP + a two-env-var password, no OAuth) — whether it
  actually works depends on the school tenant's own IMAP policy. v3.4.13
  added a manual "Send reminder now" per-calendar-event trigger,
  independent of the automatic reminder schedule. See doc 00's
  v3.4.0–v3.4.13 sections for the full detail.
- **Cycle tracking simplified, Dashboard rebuilt (v3.4.14–v3.5.5):** the
  household found the old Recurring-template + bulk-cycle-tag workflow
  too complicated for how they actually use the app. Recurring and
  `/budgets` were both removed entirely; `/transactions` is the primary
  add/edit/delete/tag-to-cycle screen again, and a one-tap "Repeat last
  cycle" button (excluding card-due transfers — those come from PDF
  imports instead, v3.5.2) replaces templates for anything that
  recurs. Dashboard dropped the old Cycle Brief/stat-grid/Biggest-Changes
  comparison framing for a plain running total (income/expenses/net), an
  interactive Expenses/Income split (Expenses left, Income right on
  wider screens, mark paid/edit/delete inline, reusing `TransactionRow`
  directly), and a Balance section: Expenses Remaining plus a purely
  manually-kept Account Balance (v3.5.1 — nothing auto-adjusts it
  anymore, income doesn't feed it at all) and a Difference figure
  (balance minus what's still pending). v3.5.3 fixed a real bug where a
  confirm dialog stayed open after a successful action. v3.5.4 extended
  Intel's "Generate commentary" to also flag potentially avoidable
  credit card spending from each card's latest billing cycle; v3.5.5
  fixed that output cutting off mid-sentence (a too-tight AI response
  token budget). See doc 00's v3.4.14–v3.5.5 sections for the full
  detail.
- **Combined credit card PDF report (v3.6.0):** a manual "Download
  combined report (PDF)" button on Intel generates a real PDF
  (`@react-pdf/renderer`) across every card's own latest statement —
  Intel's category donut reused as-is, a category-to-merchant
  drill-down, a per-card summary, top merchants/largest transactions,
  an executive-styled cover, and a data-oriented appendix carrying a
  ready-to-paste LLM analysis prompt plus the full combined transaction
  table. Found and fixed a real pre-existing bug in `Button`'s
  `asChild` mode along the way (broke every existing usage, not just
  this one). v3.6.1 fixed two real production bugs found right after
  shipping: the report was actually crashing on Vercel every time (a
  `pdfkit` font-file bundling gap, fixed via `outputFileTracingIncludes`)
  and the trigger gave no loading feedback (a plain `<a href>` full-page
  navigation to a blank tab — replaced with a client-side fetch +
  spinner + error text). See doc 00's v3.6.0/v3.6.1 sections for the
  full detail.
- **Ahaana's weekly report moves to Sunday evening (v3.6.2):** it used
  to ride the general 4-hourly reminders cron, which meant it fired at
  the very first tick that crossed into Sunday — 5:30am IST — before
  that day's own activities had happened. Now has its own dedicated
  cron (`/api/cron/ahaana-weekly-report`, Sunday 20:00 IST). See doc
  00's v3.6.2 section.
- **"Who's Busiest" on the public Calendar tab (v3.6.3):** a new
  section 01 on Calendar's Summary view (Monthly Schedule and This
  Week's Schedule renumbered down to 02/03) — one bar per household
  member, sized by how many calendar items they have in the coming
  week, with a headline naming whoever's busiest. Grew out of a
  "Family" dashboard prototype the household reviewed and put on hold,
  keeping just this one section. See doc 00's v3.6.3 section.
- **Live iCal subscription feed (v3.6.4–v3.6.8):** `GET
  /api/calendar.ics` (public, `ical-generator`) turns every trip,
  school date, manual event, and recurring class rule into a real,
  always-up-to-date feed Apple/Google Calendar can subscribe to — a
  "Subscribe in Apple Calendar" card on `/calendar` links straight to
  it via `webcal://`. v3.6.5 fixed a real bug the same day: every timed
  event came back shifted by a fixed offset on the actual Vercel
  deployment (an `ical-generator` quirk that only worked by coincidence
  in local testing). v3.6.6 added real Apple Calendar alerts
  (`VALARM`), reusing each row's own existing Telegram reminder
  settings. v3.6.7 corrected Rohana's recurring classes to Singapore
  time (she studies there) instead of IST — every timed event now
  carries a real UTC instant computed per-person (Singapore for her,
  IST for everyone else), which also displays correctly for two
  viewers in different zones at once, not just one shared local time.
  v3.6.8 gave manual calendar events a real, optional end time
  (`calendar_events.end_time`, a new column) — a "Bowling" event that
  actually runs 4 hours no longer collapses to the feed's 1-hour
  default. See doc 00's v3.6.4–v3.6.8 sections.
- **Three cron routes move to GitHub Actions (v3.6.9):** clears a real
  blocker to downgrading from Vercel Pro to Hobby — Hobby caps Vercel's
  own cron feature to once a day, but `/api/cron/reminders` (every 4
  hours, for low reminder-edit latency) and the two 15-minute routes
  (`reminders-hourly`, `ahaana-reminders`) all need finer granularity
  than that. Each now runs on its own GitHub Actions
  `schedule:` trigger instead, at its original cadence, authenticated
  with the same `CRON_SECRET` bearer token Vercel itself already used
  — plan-independent either way. `vercel.json` keeps only
  `ahaana-weekly-report`, already Hobby-compliant. See doc 00's v3.6.9
  section.
- Log is a hub for Transactions, Accounts (with inline balance
  correction), and Imports — a statement import also prompts to log its
  due amount as a real Dashboard expense (v2.5.4) and to check for
  AI-suggested duplicate merchants (v2.5.5/v2.5.6). Credit card statement
  imports (HDFC Infinia / Tata Neu Plus, Axis Horizon / Airtel, ICICI
  Amazon Pay / RuPay — six card products across three issuer parsers)
  feed a shared Merchant Dictionary, which supports AI-suggested merges
  plus inline/bulk merging directly on `/merchants` (v2.5.5–v2.5.7).
  Intel has charts and a button-triggered AI insight (shares its
  provider logic with the merchant-merge suggestions via
  `lib/ai/providers.ts`). Calendar (school calendar + trips + one-off
  events + weekly-repeating recurring events, a Summary/Details/Log
  tabbed layout, tap-to-expand day cards, a fixed IST-timezone "today,"
  a public theme toggle) is the one public, gate-free route — see doc 00
  for the v2.2.0–v2.5.2 rebuild/polish history. AIS is a static Income
  Tax summary under More.
- See [00 — Current state](./00-current-state.md) for the full v2.0/v2.1
  revamp writeup — this app moved from a transaction-logging, 3-phase
  model to a cycle-based reporting/intel model — and every version
  section since.
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
