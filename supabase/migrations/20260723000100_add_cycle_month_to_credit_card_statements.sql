-- v1.6.1: statements are now tagged to the cash-flow cycle they'll
-- actually be PAID from, not the calendar month they happen to be
-- dated in. HDFC generates a statement a few weeks before its due
-- date; the household pays it out of the FOLLOWING month's income --
-- e.g. a statement dated 17 Jun is paid using July's income, so it
-- belongs to cycle "2026-07", not "2026-06". Mirrors the existing
-- finance.transactions.cycle_month concept (see the v0.5.0 migration,
-- 20260714000100_add_transaction_cycle_month.sql) applied to
-- statements instead of ledger rows -- see
-- src/lib/statement-cycle.ts for the (statement month + 1) rule this
-- column is computed from, at import time
-- (CreditCardStatementService.saveHdfcInfiniaStatement).
--
-- Every card-related Intel aggregate (the by-category donuts,
-- month-on-month expenditure, income vs. expenses) now groups by this
-- column instead of individual transaction_date values, so every
-- transaction on one statement counts toward the same month even
-- though its billing period can span a calendar-month boundary.
--
-- Backfilled (not left null) for any statement imported before this
-- column existed -- unlike finance.transactions.cycle_month (which
-- has no reliable way to infer old intent), a statement's own
-- statement_date deterministically implies its cycle_month by the
-- same rule used for new imports, so there's no ambiguity to leave
-- unresolved here.
alter table finance.credit_card_statements
  add column cycle_month text;

update finance.credit_card_statements
set cycle_month = to_char(statement_date + interval '1 month', 'YYYY-MM');

alter table finance.credit_card_statements
  alter column cycle_month set not null,
  add constraint credit_card_statements_cycle_month_check
    check (cycle_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

comment on column finance.credit_card_statements.cycle_month is
  'Which month''s cash-flow cycle this statement is paid from, e.g. "2026-07" for a statement dated 17 Jun -- always statement_date''s month + 1 (see src/lib/statement-cycle.ts). Distinct from statement_date/billing_period_* (when the statement itself covers), same distinction as finance.transactions.cycle_month vs occurred_on.';

create index credit_card_statements_cycle_month_idx
  on finance.credit_card_statements (user_id, cycle_month);
