# Roadmap and Recommended Implementation Order

## Phase 0: Foundation hardening

1. Confirm the Vitals migration history and apply the finance migrations only through a staged process.
2. Add local Supabase config, generated `finance` database types, environment validation, auth middleware, and server-only service client.
3. Add CI quality gates and a migration/RLS test harness.
4. Finish PWA assets and establish accessible application shell/navigation.

## Phase 1: Core ledger

1. Authentication and onboarding with base currency and timezone.
2. Account, institution, category, and credit-card management.
3. Manual income, expense, transfer, and split transaction workflows.
4. Transaction list, search/filter, account balances, and reconciliation state.
5. Dashboard cash-flow summary with clear empty and error states.

**Exit criterion:** A user can faithfully manage a month of manual activity and explain every balance.

## Phase 2: Planning and evidence

1. Budgets and budget-period reporting.
2. Recurring transaction templates and idempotent scheduled generation.
3. Private attachment upload/download and transaction receipt links.
4. Net-worth view using assets, liabilities, and loans.

**Exit criterion:** A user can plan monthly spending, see commitments, and keep evidence with records.

## Phase 3: Import engine

1. Import-specific schema and secure file staging.
2. CSV mapping, parser, normalization, and idempotency.
3. Review queue, duplicate detection, rules, and commit audit log.
4. OFX/QFX support and transfer matching.

**Exit criterion:** A user can import a real statement repeatedly without duplicate ledger records.

## Phase 4: Insights and investments

1. Reporting performance improvements and saved views.
2. Investment account UI, security directory, and transaction entry/import.
3. Holdings, cost basis, and valuation feed design only after data model review.

## Phase 5: Assistant

1. Read-only, audited analytics tools over a de-identified evaluation set.
2. Grounded explanations with source record citations.
3. Draft-only categorization and transaction proposals with explicit confirmation.

## Sequencing rules

- Do not build AI before dependable transaction data and reporting exist.
- Do not build import commit before idempotency, provenance, and RLS tests exist.
- Do not expose investment valuation or tax outputs until calculation semantics and data sources are documented.
- Every phase includes mobile Safari verification, accessibility checks, security review, and migration/rollback planning.
