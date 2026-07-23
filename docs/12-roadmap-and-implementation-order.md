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
  `budget_lines` model) — the Budgets tab now shows an income/fixed-expense
  plan instead; the old feature was deleted, not hidden (recoverable from
  git history per `INSTALL.md`'s v0.3 note).
- Investment tracking — schema exists (`securities`,
  `investment_transactions`) but no UI was ever built; not currently
  planned.

## Plausible next directions (not committed, just the obvious candidates)

- A third statement-parser issuer, following the exact module convention
  in doc 06 — the architecture is designed for this to be additive.
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
