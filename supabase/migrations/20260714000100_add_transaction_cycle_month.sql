-- v0.5.0: cycle-month tagging.
--
-- Product pivot: Atlas moves from "record what happened" to "plan cash
-- flow by billing cycle." A transaction's occurred_on (when money
-- actually moves) and its cycle_month (which month's plan it counts
-- toward) are now separate concepts — e.g. paying a card on 30 Jul for
-- what's conceptually August's statement.
--
-- Nullable, deliberately: existing rows predate this concept and aren't
-- backfilled here (no reliable way to infer intent for old data — see
-- the app-layer default-to-occurred_on's-month behavior instead, applied
-- only to new writes going forward).
alter table finance.transactions
  add column cycle_month text
  check (cycle_month is null or cycle_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

comment on column finance.transactions.cycle_month is
  'Which month''s cash-flow plan this counts toward, e.g. "2026-08". Distinct from occurred_on (when money actually moves). Null means untagged — excluded from every month''s Budget snapshot until tagged.';

create index transactions_cycle_month_idx
  on finance.transactions (user_id, cycle_month)
  where cycle_month is not null;
