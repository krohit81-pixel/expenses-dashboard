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
