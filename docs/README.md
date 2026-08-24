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
- Feature set as of v3.2.0: bottom nav is **Dashboard / Log / Intel /
  Calendar** — four tabs, no fifth. "More" is a bordered menu button in
  the top-right of every page's header now (v3.1.0, moved from a plain
  icon on the top-left in v2.5.8), paired with the date; the "Atlas"
  wordmark + version live on the left instead (the header's icon/logo
  image itself was dropped in v2.5.9 — wordmark + version only), not a
  nav tab; `/more` itself is unchanged. The header dropped its indigo
  gradient background in v3.0.0 — flush with the page background,
  ink-toned text, no separate colored bar (see doc 00). v3.1.0 also
  swapped the app's accent color app-wide from purple to blue, and
  rebuilt Dashboard around a new Cycle Brief card, a real cycle-over-cycle
  stat grid, and a Biggest Changes section — see doc 00's v3.1.0 section
  for the full breakdown. Dashboard's cycle prev/next pager gained a
  visible loading spinner in v3.0.0, matching the fix Intel's card-level
  nav already had. v3.2.0 added reminders — a "Remind me" toggle on
  calendar events/trips/recurring events, sent via Telegram once linked
  in Settings; see doc 00's v3.2.0 section for the full architecture
  (generic notification provider, dedupe log). v3.2.1 put that pipeline
  on a real schedule — a `CRON_SECRET`-authenticated
  `/api/cron/reminders` route plus a `vercel.json` cron entry running
  every 4 hours — see doc 00's v3.2.1 section; the manual "Run
  reminders now" button in Settings still works too. Same v3.2.1 slice
  also gave the static Ahaana/Rohana school calendars (CNS holidays,
  CA1/CA2 exam dates, NUS calendar — all 105 entries) an automatic,
  always-on 1-day-before reminder through the same pipeline, as a new
  `school_calendar_event` notification type. v3.2.2 added hour-based
  reminders ("3/4 hours before") for anything with a real time of day —
  recurring class events, and calendar events once a new optional Time
  field is set; trips and the school calendars stay day-before-only —
  on a second, more frequent Vercel Cron (`/api/cron/reminders-hourly`,
  every 15 minutes) so precision matches the shorter lead time; see
  doc 00's v3.2.2 section. v3.3.0 restyled `/calendar` to match
  Dashboard's v3.1.0 look (the same numbered/accent-bar `SectionHeading`
  pattern, now shared rather than Dashboard-only), reordered the
  Summary/Log/Details switcher to Summary/**Log**/Details with Log
  reading visually bigger, reordered Log's own cards (event first,
  bigger cards, the standalone recurring-event card removed), and
  folded "repeats weekly" directly into Add Event as a toggle — see
  doc 00's v3.3.0 section. v3.3.1 numbered Summary's month grid as "01
  Monthly Schedule" (This Week's Schedule became "02"), and added a
  new "03 Add Event" quick-access card on Summary itself, opening the
  same Add Event modal Log's own card does. v3.3.2 rewrote every
  reminder's Telegram body text — no more repeating the title
  (Telegram already bolds it as its own line), and now showing a time
  line and a notes line when either is actually set — see doc 00's
  v3.3.2 section. v3.3.3 added a people/tagged line (👥) as the first
  line of that same body, for calendar events/trips/recurring events.
  v3.3.4 gave school-calendar reminders a tag-derived "smart note" — an
  encouraging line (exam/holiday/vacation/event/trip each get their own
  wording) appended automatically, no per-item authoring needed.
  v3.4.0 added **Ahaana's mini app** (`/ahaana/*`) — a fully separate,
  separately-password-gated section (her password never unlocks the
  rest of Atlas, and vice versa) covering her own weekly activities
  and studies: a recurring-activity schedule (French, Kickboxing,
  Horse Riding, study blocks) and a mark-complete-with-notes flow.
  v3.4.1 added Phase 2 — real device push notifications (she has no
  Telegram), genuinely new infrastructure for this app (VAPID keys, a
  service worker, a new `web_push` notification channel alongside
  `telegram`). v3.4.2 closed the loop with Phase 3 — a weekly summary
  of her activity sent to the parent's existing Telegram channel every
  Sunday (or on demand from Settings), plus a read-only "Ahaana's
  Progress" page under `/more` (completion-rate trend + recent notes),
  reachable only through the main household gate, never from `/ahaana`
  itself; see doc 00's v3.4.0/v3.4.1/v3.4.2 sections for the full
  three-phase build. v3.4.3 fixed five issues surfaced by the
  household's first real-device session: her own "Add to Home Screen"
  identity/manifest (was inheriting Atlas's), dark mode forced off for
  her section (no toggle to switch it back), her login screen's logo,
  a stale-after-reopening-from-Home-Screen fix, an encouraging footer
  line, and an hour-based reminder option (1/2/3/4 hours before,
  alongside the existing day-based one) — see doc 00's v3.4.3 section.
  v3.4.3's own manifest fix didn't actually work in production (verified
  against the dev server, which resolves that one field differently);
  v3.4.4 root-caused and properly fixed it — an `app/manifest.ts`
  file-convention route auto-injects its manifest link into every page
  regardless of any layout's own override, so both manifests are now
  plain static files under `public/`, chosen by an explicit,
  path-aware `<link>` the root layout renders itself. v3.4.5-v3.4.7
  chased down her real device's push-subscribe flow one error at a
  time (a gated service worker file, then an inactive-worker race) —
  reminders are now confirmed working end to end on her device.
  v3.4.8 added a visible version number, a real Edit flow for her
  activities (also fixing a real, previously-silent bug where
  Deactivate never actually worked), and split her single page into
  "Dashboard" (the weekly view, now Sunday-start at her own request)
  and "Log Activity" tabs. v3.4.9 fixed a "first login errors, next
  one doesn't" report — the two Ahaana reads her own pages make had
  simply never been wrapped in the same Supabase auth-timing retry
  every other `list*()` in this app already uses. v3.4.10 fixed the
  Dashboard/Log Activity tab highlighting getting stuck (a Client
  Component with `usePathname()`, `AhaanaTabs.tsx`, replacing a
  server-side computation that couldn't react to a client-side
  navigation between two pages sharing one layout), added a loading
  spinner during tab switches, and added alternate-week recurring
  activities (a checkbox, two ordinary activities with `startDate`s a
  week apart interleaving on their own). v3.4.11 added a forward-
  looking "This week — what to expect" section to the existing
  parent-facing "Ahaana's Progress" page (More → Ahaana's Progress,
  built back in v3.4.0 Phase 3) — the household asked for this page
  again without realizing it already existed, and the one real gap it
  had was that it was backward-looking only — see doc 00's v3.4.4
  through v3.4.11 sections.
  Dashboard shows the full cycle-wise income/expense breakdown (absorbed
  Budgets in v2.1.0). Log is a hub for Recurring (bulk cycle-tagging),
  Accounts (with inline balance correction), and Imports — a statement
  import now also prompts to log its due amount as a real Dashboard
  expense (v2.5.4) and to check for AI-suggested duplicate merchants
  (v2.5.5/v2.5.6). Transactions is now a read-only historical log, moved
  under More. Credit card statement imports (HDFC Infinia / Tata Neu
  Plus, Axis Horizon / Airtel, ICICI Amazon Pay / RuPay) feed a shared
  Merchant Dictionary, which now supports AI-suggested merges plus
  inline/bulk merging directly on `/merchants` (v2.5.5–v2.5.7). Intel has
  charts and a button-triggered AI insight (now sharing its provider
  logic with the merchant-merge suggestions via `lib/ai/providers.ts`).
  Calendar (school calendar + trips + one-off events + weekly-repeating
  recurring events, merged into a Summary/Details/Log tabbed layout with
  a tap-to-expand day card, a fixed IST-timezone "today," and a public
  theme toggle) is the one public, gate-free route — see doc 00 for the
  v2.2.0–v2.5.2 rebuild/polish history. AIS is a static Income Tax
  summary under More. See [00 — Current state](./00-current-state.md) for
  the full v2.0/v2.1 revamp writeup — this app moved from a
  transaction-logging, 3-phase model to a cycle-based reporting/intel
  model.
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
