-- v3.5.0: "Account Balance" on Dashboard's new Balance section — one
-- editable starting-cash-on-hand figure per cycle, set once (or edited
-- any time) via the pencil icon next to "Account Balance". The
-- dashboard then computes the LIVE running balance itself
-- (starting_balance + this cycle's posted income − posted expenses,
-- from finance.transactions) rather than storing that derived number —
-- only the one input a person actually types is persisted here, same
-- "store what was entered, derive the rest" reasoning as everything
-- else in finance.transactions/cycle_month.
--
-- Deliberately separate from finance.accounts' own balance-correction
-- flow (AccountService.correctAccountBalance) — that corrects one real
-- account's balance by logging an adjustment transaction; this is a
-- single, simpler "cash on hand" figure for the whole cycle, matching
-- what the household actually asked for on Dashboard, not a
-- multi-account reconciliation tool.
create table finance.cycle_starting_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- "2026-08" — same cycle_month convention as finance.transactions.
  cycle_month text not null check (cycle_month ~ '^\d{4}-\d{2}$'),
  amount numeric(18, 2) not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, cycle_month)
);

comment on table finance.cycle_starting_balances is
  'One editable "cash on hand at the start of this cycle" figure per cycle_month, behind Dashboard''s Balance section. The displayed running balance (starting + posted income − posted expenses this cycle) is computed on read, never stored.';
comment on column finance.cycle_starting_balances.amount is
  'Can be negative (an overdrawn starting position) — not constrained positive, unlike a transaction amount.';

create trigger set_cycle_starting_balances_updated_at
  before update on finance.cycle_starting_balances
  for each row execute function finance.set_updated_at();

alter table finance.cycle_starting_balances enable row level security;

create policy user_isolation on finance.cycle_starting_balances
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on finance.cycle_starting_balances to authenticated;
grant all privileges on finance.cycle_starting_balances to service_role;
