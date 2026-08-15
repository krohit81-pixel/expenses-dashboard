# Roadmap

> The original phase plan below (Phase 0 foundation → Phase 5 assistant)
> was the pre-implementation target. The app has since shipped well past
> Phase 3 in some areas (import engine) while skipping or narrowing others
> (no OFX, no chat assistant) based on what the user actually needed. This
> doc replaces the phase plan with what's actually shipped, by version,
> plus plausible next directions — kept current going forward.

## Shipped, by version (high-level; see `git log` and `INSTALL.md` for exact detail)

- **v0.x** — Foundation: ledger core (accounts, transactions, categories,
  budgets v1, recurring, attachments, net worth), the single-owner
  access-gate auth model (replacing an earlier, fragile per-request
  Supabase Auth design), a full redesign, first Intel charts, and an
  Anthropic-backed AI insight.
- **v1.0–v1.1** — Calendar tab: static school calendar merged with
  user-entered trips; timezone-correctness fix for the date shown in the
  app header (India-local, not server-local).
- **v1.2–v1.3** — Credit-card statement import, milestone 1: PDF text
  extraction (`pdf.js`, password-aware), proven against a real HDFC
  Infinia statement, table-layout-preserving but not yet structured
  parsing.
- **v1.4.0** — Statement import, milestone 2: structured, deterministic
  HDFC Infinia parsing + reconciliation + persistence
  (`credit_card_statements`/`credit_card_transactions`).
- **v1.5.0–v1.5.3** — Merchant Dictionary: shared merchant/category
  resolution (`atlas_categories`/`merchants`/`merchant_aliases`) wired
  into statement saving, a `/merchants` admin UI, and exclusion of bank
  fee/tax lines from merchant resolution.
- **v1.6.0–v1.6.3** — Intel maturity: card-level category breakdown by
  billing cycle, Gemini as an alternate AI provider, `cycle_month` added
  to statements/transactions, button-triggered (not page-load) AI
  insight, several rounds of Intel page UX refinement, and folding
  planned credit-card dues into the same totals the ledger-based charts
  and AI insight use.
- **v1.7.0–v1.7.3** — Axis Horizon: a second card issuer added to the
  statement-parser architecture (after review/alignment of an
  externally-drafted implementation), a mid-flight rename
  (Axis "Atlas" → "Horizon") plus real password wiring, and two
  production-only bugs found and fixed after real-world use: a PDF-layout
  font-metric fragility that silently zeroed out every transaction on one
  environment, and a reconciliation bug from not splitting "purchases"
  from "finance charges" the way Axis's own statement does.
- **v1.8.0–v1.9.0** — ICICI Amazon Pay: a third card issuer
  (`icici-amazon`, later renamed `icici-amazon-rupay` in v1.9.0 once a
  second real statement, a RuPay-variant card, confirmed one shared parser
  covers both products).
- **v1.10.0** — Axis Horizon generalized to `axis-horizon-airtel` after a
  second real statement (an Airtel co-branded Mastercard) reconciled
  against the same parser with zero code changes.
- **v1.11.0** — HDFC Infinia generalized to `hdfc-infinia-tata` after a
  second real statement (a Tata Neu Plus co-branded card); unlike the
  other two generalizations, this one keeps two separate
  `CardStatementSource` entries with distinct password env vars, since
  HDFC's co-branded cards aren't guaranteed to share the core product's
  password formula.
- **v1.12.0–v1.13.0** — AIS: an HTML prototype, then a real static `/ais`
  page (Income Tax Annual Information Statement summary for the current
  FY, hand-maintained reference data, not ledger-backed), linked from
  More.
- **v2.0.0 — total revamp.** The household steered the app from a
  transaction-logging tool toward a reporting/intel-first tool: the
  3-phase Planning/Execution/Tracking system (`lib/dates/phase.ts`,
  `HomePhaseView`, `ChecklistItem`) was deleted outright, leaving the
  monthly "cycle" as the only time concept. Home (now Dashboard) was
  rebuilt around "how is this cycle looking" instead of phase checklists.
  Transactions was demoted to a read-only historical log and dropped from
  primary nav (4 tabs — Home/Calendar/Intel + More — down from 5). See
  [00 — Current state](./00-current-state.md) for the full writeup; this
  is the single biggest shape change in the app's history so far.
- **v2.1.0** — Nav restructure to **Dashboard / Log / Intel / Calendar +
  More** (5 primary tabs again, but a different 5): Dashboard absorbed
  Budgets' full cycle-wise breakdown; a new Log tab became the hub for
  Recurring, Accounts, and Imports. Recurring gained bulk cycle-tagging
  (opt-out — everything due starts pre-checked, `isDueInCycle` +
  `applyCycleTags`) replacing one-at-a-time tagging, and dropped
  transfer-kind templates from its lists (card dues now come from
  statement imports). Accounts gained inline balance correction —
  computes the delta between the shown and typed balance and logs it as
  an ordinary income/expense transaction, since there's no stored balance
  column to overwrite.
- **v2.2.0** — Recurring calendar events: `finance.recurring_calendar_events`
  (a weekly-repeating *rule*, not stored occurrences — `days_of_week`,
  `start_time`/`end_time`, a bounded `start_date`–`end_date`), a pure
  `expandRecurringOccurrences` helper shared by server and client, and a
  weekly timetable widget folded into the existing month grid and
  detailed list. v2.2.1–v2.2.2 fixed a "Save" button staying stuck loading
  after a successful add (the same pre-existing bug in three modals — a
  stale `isSubmitting` never reset because modals stay mounted, just
  hidden) and added the "this week, day by day" agenda view from the
  original brainstorm prototype that hadn't shipped with v2.2.0.
- **v2.3.0** — `/calendar` restructured so the month grid leads (was
  buried below the weekly views and travel windows), with This
  week/Good windows/Detailed events/Recurring events demoted to
  collapsed-by-default sections and a new Logging section replacing three
  always-visible add-cards. Every day cell became clickable and opened a
  new Outlook-style `DayViewModal` (full-screen, an all-day band plus a
  24-hour timeline) instead of adding a trip or editing a chip in place.
- **v2.4.0** — The weekly timetable and the day-by-day text list merged
  into one always-expanded "This week's schedule" view (all-day band +
  hourly grid). The "Recurring" label's solid dark purple lightened to
  match `TripDetailedList`'s existing softer treatment, `DayViewModal`'s
  timeline blocks became person-colored, and `/calendar` split into three
  switchable sections (Dashboard / Report / Log) behind a pill tab
  switcher instead of one long collapsed-by-default scroll.
- **v2.5.0** — `DayViewModal` (the full-screen day view) replaced by
  `DayDetailCard`, an inline panel that expands right below whichever day
  was tapped instead of a modal — validated first as an HTML prototype,
  including a rejected "spanning bars across days" idea (reverted back to
  one chip per day per item after review). Chips across the month grid
  and week view switched to a "bold top bar" style (`ChipBadge`); same-day
  recurring occurrences collapse into one "N classes" summary chip in
  those compact views. `WeekScheduleGrid` rebuilt as a day-list (was an
  hourly timeline) that can page ±1 week instead of only ever showing the
  current week. Ahaana's CA1/CA2 subject-by-subject test schedule added
  from the school's own circular.
- **v2.5.1** — Calendar cosmetic pass: the selected-day ring went from
  `ring-ink` (near-black in light mode) to a soft accent-tinted
  background + thin accent ring; `PersonNames` (color-coded names,
  capped + truncated) replaced the color-only `PersonDots` stack in
  `DayDetailCard`; the section pill switcher renamed Dashboard/Report/Log
  → Summary/Details/Log; the public footer paragraph condensed to one
  line (the public/no-password notice only).
- **v2.5.2** — Login page's "shared calendar, no password needed" link
  became a real secondary button, not plain underlined text.
  `todayISODate()` fixed from UTC to explicit `Asia/Kolkata` — it was
  silently a day behind every morning between midnight and 5:30am IST.
  `DayDetailCard`'s heading condensed to one line, "In N days" dropped;
  its Schedule rows show the full time range with AM/PM instead of a
  bare start hour. A compact `ThemeToggleButton` added to `Hero`'s new
  `topRightAction` slot, reachable from `/calendar` without logging in.
- **v2.5.3** — `withAuthTimingRetry` (`lib/supabase/retry.ts`): retries a
  Supabase query once on the transient "JWT issued at future" error seen
  on the first request after idle traffic — applied to `/calendar`'s
  server-side fetches and `middleware.ts`'s `user_settings` check, the
  two places most exposed to a cold first request. Found via a real
  production server-side exception, reported from Vercel logs.
- **v2.5.4** — `LogCardDuePrompt`: a statement import only ever wrote to
  `credit_card_statements`/`credit_card_transactions` (Intel's reporting
  tables), never a real `finance.transactions` row — so an imported
  card due never showed up as a Dashboard expense, no matter how
  correctly it parsed. The bridge that used to exist for this
  (`CardPaymentQuickLog`, a standalone manual form) was removed from the
  UI in the v2.0 redesign and nothing replaced its job. Fixed by
  pre-filling the same log-payment action right after a successful/
  duplicate import; the only real guess is which `Account` the
  statement's card corresponds to (`guessCardAccountId`, keyword-scored,
  always shown as an editable picker).
- **v2.5.5–v2.5.6** — AI-suggested merchant merges
  (`MerchantMergeSuggestionService`): `MerchantDictionaryService`'s
  resolver only ever does exact alias/name matching, so any
  statement-text variation spawns a new "unmapped" merchant instead of
  matching an existing one. "Find likely duplicates" on `/merchants`
  (and, v2.5.6, right after an import) sends unmapped/established
  merchant *names only* to the configured AI provider (`lib/ai/
  providers.ts`, factored out of `IntelService.ts` so both features
  share one provider-selection implementation) for advisory-only
  suggestions — the model never merges anything itself, every suggestion
  needs an explicit human click, reusing the pre-existing
  `mergeMerchants()`. `scripts/suggest-merchant-merges.mjs` (report-only)
  and `apply-merchant-merges.mjs` (explicit ID-pair apply) cover a
  one-off backlog sweep outside the UI — run once against the real
  household data, found 4 candidates, applied 3, correctly left one
  (two BBPS payments differing only by reference number) unmerged as a
  likely false positive.
- **v2.5.7** — Merging moved onto the `/merchants` list itself: a
  "Merge" button next to "Edit" on every row (was only reachable from a
  merchant's own detail page before), plus checkbox multi-select with a
  "Merge N into…" bulk bar (`MerchantListWithSelection`,
  `bulkMergeMerchantsAction`, sequential per-source). Merge-target
  dropdowns are built from the unfiltered merchant list — building them
  from whatever's on screen breaks on the "uncategorized only" filter,
  which would otherwise only offer other uncategorized merchants as a
  target.
- **v2.5.8** — "More" converted from a fifth nav-bar item (`BottomNav`/
  `TopNav`) to a hamburger icon in `Hero`'s top-left, next to the
  wordmark — plain link to `/more`, not a new dropdown/drawer.
  `BottomNav` goes from 5 columns to 4.
- **v2.5.9** — `Hero`'s `atlas-mark.png` icon dropped; header reads
  hamburger + "Atlas" + version, no image. Asset itself untouched, still
  used on `/login`.

## What was explicitly descoped or replaced along the way

- CSV/OFX bank import and a staging/review/commit workflow — never built;
  the actual need was credit-card PDF statements specifically.
- A general-purpose, tool-calling AI assistant — replaced by a much
  narrower button-triggered insight (doc 07).
- Multi-environment Supabase (local/staging/prod) and RLS as the live
  auth boundary — replaced by a single-owner, service-role model (doc 00,
  doc 11) after the original per-request Supabase Auth design proved
  fragile under real mobile usage.
- Category-envelope budgeting (the original `finance.budgets`/
  `budget_lines` model) — replaced by an income/fixed-expense plan instead;
  the old feature was deleted, not hidden (recoverable from git history per
  `INSTALL.md`'s v0.3 note). That replacement itself lived as a standalone
  Budgets tab through v2.0.0, then was absorbed into Dashboard in v2.1.0
  (see the v2.1.0 entry above) — `/budgets` still runs, just unlinked.
- The 3-phase Planning/Execution/Tracking system and per-transaction
  logging as the primary daily interaction — deleted in v2.0.0 in favor of
  cycle-level planning (key in expected income/expenses once, don't track
  individual postings). Transactions is now a read-only historical log.
- Investment tracking — schema exists (`securities`,
  `investment_transactions`) but no UI was ever built; not currently
  planned.

## Plausible next directions (not committed, just the obvious candidates)

- A fourth statement-parser issuer, following the exact module convention
  in doc 06 — the architecture is designed for this to be additive. (A
  third, ICICI Amazon Pay/RuPay, shipped in v1.8.0–v1.9.0.)
- A dedicated Dashboards tab, or sections within Intel — flagged by the
  household as a later addition when the v2.0.0 revamp was requested, not
  yet built.
- Hardening the PDF-layout extraction against the font-metric fragility
  documented in doc 06, e.g. reducing reliance on `\s{2,}` heuristics
  further, or adding a lower-confidence fallback path instead of an
  all-or-nothing reconciliation gate.
- Revisiting investment tracking if it becomes a real need — the schema
  is already there.
- Anything the user asks for next — this app is driven entirely by actual
  usage and real bugs hit in production, not a pre-set backlog. Treat this
  roadmap as a history, not a queue.

## Sequencing principle that has actually held

Every feature so far was built against **real data** before being trusted:
a real (redacted) statement PDF, a real reconciliation failure, a real
production screenshot of a bug. Synthetic fixtures come after a fix is
proven against reality, to lock it in — not before. Keep doing this;
it's caught every non-obvious bug in this app's history so far (see doc
06's "Known fragility" section for the clearest example).
