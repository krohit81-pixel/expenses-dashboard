begin;

create schema if not exists finance;
create extension if not exists pgcrypto;

create type finance.account_type as enum (
  'checking', 'savings', 'cash', 'credit_card', 'investment', 'loan', 'asset', 'liability'
);
create type finance.category_kind as enum ('income', 'expense');
create type finance.transaction_kind as enum ('income', 'expense', 'transfer', 'adjustment');
create type finance.transaction_status as enum ('pending', 'posted', 'void');
create type finance.recurrence_frequency as enum ('daily', 'weekly', 'monthly', 'quarterly', 'yearly');
create type finance.asset_type as enum ('real_estate', 'vehicle', 'valuable', 'other');
create type finance.liability_type as enum ('personal', 'tax', 'medical', 'other');
create type finance.investment_transaction_type as enum ('buy', 'sell', 'dividend', 'interest', 'fee', 'split');

create function finance.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table finance.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  base_currency char(3) not null default 'USD' check (base_currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'UTC',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table finance.institutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  website text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, name)
);

create table finance.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  institution_id uuid references finance.institutions(id) on delete set null,
  name text not null,
  account_type finance.account_type not null,
  currency_code char(3) not null default 'USD' check (currency_code ~ '^[A-Z]{3}$'),
  opening_balance numeric(18, 2) not null default 0,
  opening_balance_date date,
  external_reference text,
  is_archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, name)
);

create table finance.credit_cards (
  account_id uuid primary key references finance.accounts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  credit_limit numeric(18, 2) check (credit_limit is null or credit_limit >= 0),
  statement_day smallint check (statement_day between 1 and 31),
  payment_due_day smallint check (payment_due_day between 1 and 31),
  annual_percentage_rate numeric(7, 4) check (annual_percentage_rate is null or annual_percentage_rate >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table finance.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  parent_id uuid references finance.categories(id) on delete restrict,
  kind finance.category_kind not null,
  name text not null,
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text,
  is_archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (parent_id is null or parent_id <> id)
);

create table finance.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  currency_code char(3) not null default 'USD' check (currency_code ~ '^[A-Z]{3}$'),
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (period_end >= period_start),
  unique (user_id, name, period_start, period_end)
);

create table finance.budget_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  budget_id uuid not null references finance.budgets(id) on delete cascade,
  category_id uuid not null references finance.categories(id) on delete restrict,
  planned_amount numeric(18, 2) not null check (planned_amount >= 0),
  rollover_enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (budget_id, category_id)
);

create table finance.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null references finance.accounts(id) on delete restrict,
  transfer_account_id uuid references finance.accounts(id) on delete restrict,
  kind finance.transaction_kind not null,
  amount numeric(18, 2) not null check (amount > 0),
  currency_code char(3) not null check (currency_code ~ '^[A-Z]{3}$'),
  payee text,
  memo text,
  frequency finance.recurrence_frequency not null,
  interval_count integer not null default 1 check (interval_count > 0),
  starts_on date not null,
  ends_on date,
  next_occurrence_on date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ends_on is null or ends_on >= starts_on),
  check (
    (kind = 'transfer' and transfer_account_id is not null and transfer_account_id <> account_id)
    or (kind <> 'transfer' and transfer_account_id is null)
  )
);

create table finance.recurring_transaction_splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recurring_transaction_id uuid not null references finance.recurring_transactions(id) on delete cascade,
  category_id uuid not null references finance.categories(id) on delete restrict,
  amount numeric(18, 2) not null check (amount > 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (recurring_transaction_id, category_id)
);

create table finance.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null references finance.accounts(id) on delete restrict,
  transfer_account_id uuid references finance.accounts(id) on delete restrict,
  recurring_transaction_id uuid references finance.recurring_transactions(id) on delete set null,
  kind finance.transaction_kind not null,
  status finance.transaction_status not null default 'posted',
  amount numeric(18, 2) not null check (amount > 0),
  currency_code char(3) not null check (currency_code ~ '^[A-Z]{3}$'),
  exchange_rate numeric(18, 8) check (exchange_rate is null or exchange_rate > 0),
  occurred_on date not null,
  payee text,
  memo text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (kind = 'transfer' and transfer_account_id is not null and transfer_account_id <> account_id)
    or (kind <> 'transfer' and transfer_account_id is null)
  )
);

create table finance.transaction_splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  transaction_id uuid not null references finance.transactions(id) on delete cascade,
  category_id uuid not null references finance.categories(id) on delete restrict,
  amount numeric(18, 2) not null check (amount > 0),
  memo text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (transaction_id, category_id)
);

create table finance.loans (
  account_id uuid primary key references finance.accounts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  original_principal numeric(18, 2) not null check (original_principal >= 0),
  interest_rate numeric(7, 4) check (interest_rate is null or interest_rate >= 0),
  originated_on date,
  maturity_on date,
  payment_amount numeric(18, 2) check (payment_amount is null or payment_amount >= 0),
  payment_due_day smallint check (payment_due_day between 1 and 31),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (maturity_on is null or originated_on is null or maturity_on >= originated_on)
);

create table finance.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid unique references finance.accounts(id) on delete set null,
  asset_type finance.asset_type not null,
  name text not null,
  acquired_on date,
  acquisition_cost numeric(18, 2) check (acquisition_cost is null or acquisition_cost >= 0),
  currency_code char(3) not null default 'USD' check (currency_code ~ '^[A-Z]{3}$'),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table finance.liabilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid unique references finance.accounts(id) on delete set null,
  liability_type finance.liability_type not null,
  name text not null,
  original_amount numeric(18, 2) check (original_amount is null or original_amount >= 0),
  interest_rate numeric(7, 4) check (interest_rate is null or interest_rate >= 0),
  currency_code char(3) not null default 'USD' check (currency_code ~ '^[A-Z]{3}$'),
  due_on date,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Investment tables are intentionally separated from the main transaction ledger for future rollout.
create table finance.securities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  symbol text not null,
  name text not null,
  exchange text,
  currency_code char(3) not null default 'USD' check (currency_code ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (symbol <> '')
);

create table finance.investment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null references finance.accounts(id) on delete restrict,
  security_id uuid not null references finance.securities(id) on delete restrict,
  kind finance.investment_transaction_type not null,
  occurred_on date not null,
  quantity numeric(24, 8) not null check (quantity > 0),
  unit_price numeric(24, 8),
  fees numeric(18, 2) not null default 0 check (fees >= 0),
  total_amount numeric(18, 2) not null check (total_amount >= 0),
  currency_code char(3) not null check (currency_code ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table finance.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  storage_bucket text not null default 'finance-attachments',
  storage_path text not null,
  file_name text not null,
  content_type text,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (storage_bucket, storage_path)
);

create table finance.transaction_attachments (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  transaction_id uuid not null references finance.transactions(id) on delete cascade,
  attachment_id uuid not null references finance.attachments(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (transaction_id, attachment_id)
);

create table finance.account_attachments (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null references finance.accounts(id) on delete cascade,
  attachment_id uuid not null references finance.attachments(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (account_id, attachment_id)
);

create table finance.asset_attachments (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  asset_id uuid not null references finance.assets(id) on delete cascade,
  attachment_id uuid not null references finance.attachments(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (asset_id, attachment_id)
);

create table finance.liability_attachments (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  liability_id uuid not null references finance.liabilities(id) on delete cascade,
  attachment_id uuid not null references finance.attachments(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (liability_id, attachment_id)
);

create index accounts_user_id_idx on finance.accounts(user_id);
create index categories_user_parent_idx on finance.categories(user_id, parent_id);
create unique index categories_user_parent_kind_name_key
  on finance.categories (user_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, name);
create index budgets_user_period_idx on finance.budgets(user_id, period_start, period_end);
create index transactions_user_date_idx on finance.transactions(user_id, occurred_on desc);
create index transactions_account_date_idx on finance.transactions(account_id, occurred_on desc);
create index transaction_splits_transaction_idx on finance.transaction_splits(transaction_id);
create index recurring_transactions_due_idx on finance.recurring_transactions(user_id, next_occurrence_on) where is_active;
create index investment_transactions_account_date_idx on finance.investment_transactions(account_id, occurred_on desc);
create unique index securities_user_symbol_exchange_key
  on finance.securities (user_id, symbol, coalesce(exchange, ''));

create trigger set_user_settings_updated_at before update on finance.user_settings for each row execute function finance.set_updated_at();
create trigger set_institutions_updated_at before update on finance.institutions for each row execute function finance.set_updated_at();
create trigger set_accounts_updated_at before update on finance.accounts for each row execute function finance.set_updated_at();
create trigger set_credit_cards_updated_at before update on finance.credit_cards for each row execute function finance.set_updated_at();
create trigger set_categories_updated_at before update on finance.categories for each row execute function finance.set_updated_at();
create trigger set_budgets_updated_at before update on finance.budgets for each row execute function finance.set_updated_at();
create trigger set_budget_lines_updated_at before update on finance.budget_lines for each row execute function finance.set_updated_at();
create trigger set_recurring_transactions_updated_at before update on finance.recurring_transactions for each row execute function finance.set_updated_at();
create trigger set_transactions_updated_at before update on finance.transactions for each row execute function finance.set_updated_at();
create trigger set_loans_updated_at before update on finance.loans for each row execute function finance.set_updated_at();
create trigger set_assets_updated_at before update on finance.assets for each row execute function finance.set_updated_at();
create trigger set_liabilities_updated_at before update on finance.liabilities for each row execute function finance.set_updated_at();
create trigger set_securities_updated_at before update on finance.securities for each row execute function finance.set_updated_at();
create trigger set_investment_transactions_updated_at before update on finance.investment_transactions for each row execute function finance.set_updated_at();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'user_settings', 'institutions', 'accounts', 'credit_cards', 'categories', 'budgets',
    'budget_lines', 'recurring_transactions', 'recurring_transaction_splits', 'transactions',
    'transaction_splits', 'loans', 'assets', 'liabilities', 'securities',
    'investment_transactions', 'attachments', 'transaction_attachments', 'account_attachments',
    'asset_attachments', 'liability_attachments'
  ] loop
    execute format('alter table finance.%I enable row level security', table_name);
    execute format(
      'create policy user_isolation on finance.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      table_name
    );
  end loop;
end;
$$;

grant usage on schema finance to authenticated, service_role;
grant select, insert, update, delete on all tables in schema finance to authenticated;
grant all privileges on all tables in schema finance to service_role;
grant usage, select on all sequences in schema finance to authenticated, service_role;
grant execute on all functions in schema finance to authenticated, service_role;
alter default privileges in schema finance grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema finance grant all privileges on tables to service_role;
alter default privileges in schema finance grant usage, select on sequences to authenticated, service_role;

commit;
