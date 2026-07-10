# Testing Strategy

## Test pyramid

| Level | Focus | Examples |
| --- | --- | --- |
| Unit | Pure calculations and parsers | currency math, split totals, fingerprinting, date recurrence |
| Integration | Services plus database | RLS, triggers, transaction creation, import commit idempotency |
| Component | Interactive UI behavior | form validation, filter URL state, keyboard behavior |
| End-to-end | Critical user journeys | sign-in, add transaction, import/review/commit, attachment upload |
| Security | Authorization and abuse cases | cross-user IDs, signed URLs, service key absence, prompt injection |

## Database test requirements

Run migrations against a fresh local Supabase instance in CI. Test RLS using two authenticated test users and verify both direct table access and RPC behavior. Test all ownership triggers, subtype constraints, storage policies, and migration upgrade paths.

## Essential fixtures

- A checking account, cash account, and credit card in multiple currencies.
- Income, expense, transfer, pending, posted, and void transactions.
- Split transactions and recurring templates.
- Current and expired budgets.
- CSV files with duplicate rows, malformed dates, decimal comma, and transfer pairs.
- Two users with deliberately guessed foreign IDs to prove isolation.

## Financial correctness tests

Use table-driven tests for rounding, negative representations from statements, timezone boundaries, monthly recurrence on the 29th-31st, leap years, and inclusive reporting periods. Snapshot only presentational output; assert financial results directly.

## Release gates

Required before production: typecheck, lint, build, migration test, unit suite, affected integration suite, Playwright critical path, accessibility scan, dependency/security scan, and manual review of mobile Safari behavior. A failed import, authorization, or ledger test blocks release.
