-- Phase 2 of statement imports (v1.4.0): structured, persisted statement
-- and transaction data, parsed deterministically (no LLM) from the text
-- v1.3.x's extraction pipeline already proved it can reliably read. HDFC
-- Infinia only, for now — see src/services/statement-parsers/hdfc-infinia/
-- for the parser this schema backs. Every field below was verified
-- against a real Infinia statement's actual layout before being decided,
-- not guessed at from the spec alone (see that parser's own comments for
-- specifics, e.g. why the per-transaction "PI" column can't always be
-- extracted as text).
--
-- Two tables, not a join into finance.transactions: this is a read-only
-- mirror of what the statement PDF actually says, kept deliberately
-- separate from the ledger (finance.transactions, which is Atlas's own
-- record of money movement, entered or reconciled by hand). Feeding
-- parsed statement rows into the ledger automatically is a distinct,
-- later decision -- this phase is "can we reliably turn a PDF into
-- structured data," not "should Atlas trust that data as ground truth
-- for budgeting." Kept in the `finance` schema anyway (not a new schema)
-- since it's still per-user financial data, following the same
-- ownership/RLS pattern as everything else here.

create table finance.credit_card_statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  issuer text not null check (char_length(issuer) between 1 and 40),
  card_type text not null check (char_length(card_type) between 1 and 40),
  card_last4 char(4) not null check (card_last4 ~ '^[0-9]{4}$'),
  primary_cardholder text not null check (char_length(primary_cardholder) between 1 and 120),

  statement_date date not null,
  billing_period_start date not null,
  billing_period_end date not null check (billing_period_end >= billing_period_start),
  due_date date not null,

  total_amount_due numeric(18, 2) not null,
  minimum_due numeric(18, 2) not null,
  previous_statement_due numeric(18, 2) not null,
  payments_received numeric(18, 2) not null,
  purchases_debit numeric(18, 2) not null,
  finance_charges numeric(18, 2) not null,
  available_credit_limit numeric(18, 2) not null,
  total_credit_limit numeric(18, 2) not null,
  available_cash_limit numeric(18, 2) not null,

  reward_points_balance integer not null default 0,
  reward_points_earned integer not null default 0,
  reward_points_expiring_30_days integer not null default 0,
  reward_points_expiring_60_days integer not null default 0,
  cashback_amount numeric(18, 2) not null default 0,

  -- Bonus scope beyond the spec's exact statement-level field list: the
  -- two per-program/per-transaction summary tables HDFC prints near the
  -- end of the statement (Rewards Program Points Summary, Cash Back
  -- Summary). Neither has a fixed column count worth normalizing into
  -- its own table yet at one card's worth of real-world shape, so these
  -- are stored as the parser's own array-of-objects output rather than
  -- guessed-at columns.
  reward_points_summary jsonb not null default '[]'::jsonb,
  cashback_summary jsonb not null default '[]'::jsonb,

  statement_currency char(3) not null default 'INR' check (statement_currency ~ '^[A-Z]{3}$'),
  pdf_filename text not null check (char_length(pdf_filename) between 1 and 255),
  -- sha256 hex digest of the extracted statement text -- see
  -- StatementImportService for why hashing the text (not the original
  -- PDF bytes) is the right choice: two different-but-equivalent PDF
  -- exports of the same statement (e.g. a password-protected original
  -- vs. a locally re-saved copy) will still hash identically as long as
  -- the underlying text is the same, so duplicate detection isn't
  -- fooled by re-encoding.
  statement_hash char(64) not null check (statement_hash ~ '^[0-9a-f]{64}$'),

  created_at timestamptz not null default timezone('utc', now()),

  -- Primary duplicate guard. The spec asks for "statement hash +
  -- statement date + card number" -- in practice the hash alone already
  -- captures date and card number (they're both printed in the text
  -- that gets hashed), so a hash collision without a date/card match
  -- would mean the hash function itself failed, not a real duplicate.
  -- The composite constraint here still checks all three explicitly
  -- rather than relying on that argument holding forever.
  unique (user_id, statement_hash, statement_date, card_last4)
);

comment on table finance.credit_card_statements is
  'One row per successfully parsed & reconciled HDFC Infinia statement PDF. Read-only mirror of the statement, not the ledger -- see finance.transactions for Atlas''s own money-movement records.';
comment on column finance.credit_card_statements.statement_hash is
  'sha256 of the extracted statement text, used (with statement_date + card_last4) to reject re-importing the same statement twice.';
comment on column finance.credit_card_statements.purchases_debit is
  'The statement''s own "PURCHASES/DEBIT (Current Billing Cycle)" total -- used by the reconciliation check, not derived from summing transaction rows (the two should agree; reconciliation is what checks that they do).';

create index credit_card_statements_user_date_idx
  on finance.credit_card_statements (user_id, statement_date desc);

alter table finance.credit_card_statements enable row level security;

create policy user_isolation on finance.credit_card_statements
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on finance.credit_card_statements to authenticated;
grant all privileges on finance.credit_card_statements to service_role;

-- ---------------------------------------------------------------------

create table finance.credit_card_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  statement_id uuid not null references finance.credit_card_statements(id) on delete cascade,

  transaction_date date not null,
  transaction_time time,

  -- Always populated: the full description text as printed, exactly as
  -- it appeared (possibly reassembled across a line wrap -- see the
  -- parser). merchant_raw/merchant_normalized are null for rows that
  -- aren't really "a merchant" (a cashback-event line, a payment line)
  -- -- description still holds their text either way.
  description text not null check (char_length(description) between 1 and 500),
  merchant_raw text check (merchant_raw is null or char_length(merchant_raw) between 1 and 300),
  merchant_normalized text check (merchant_normalized is null or char_length(merchant_normalized) between 1 and 300),

  amount numeric(18, 2) not null check (amount >= 0),
  currency char(3) not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  transaction_type text not null check (transaction_type in ('debit', 'credit')),

  is_payment boolean not null default false,
  is_cashback boolean not null default false,
  is_refund boolean not null default false,
  is_emi boolean not null default false,

  credit_type text check (credit_type is null or credit_type in ('payment', 'cashback', 'refund', 'reversal')),
  payment_reference text check (payment_reference is null or char_length(payment_reference) <= 100),

  emi_merchant text check (emi_merchant is null or char_length(emi_merchant) <= 300),
  emi_amount numeric(18, 2) check (emi_amount is null or emi_amount >= 0),

  reward_points integer,
  -- Per-transaction PI is a colour-coded marker in the one real
  -- statement this was built against, not printed text -- see the
  -- parser's own comment on why these two columns are nullable rather
  -- than always populated. Kept as separate code/name columns (matching
  -- the spec) so a future, differently-rendered statement that *does*
  -- print PI as text slots in without a schema change.
  purchase_indicator_code text check (purchase_indicator_code is null or char_length(purchase_indicator_code) <= 60),
  purchase_indicator_name text check (purchase_indicator_name is null or char_length(purchase_indicator_name) <= 120),

  cardholder_type text not null check (cardholder_type in ('primary', 'addon')),
  cardholder_name text not null check (char_length(cardholder_name) between 1 and 120),

  page_number integer not null check (page_number >= 1),
  sequence_number integer not null check (sequence_number >= 1),
  raw_text text not null,

  created_at timestamptz not null default timezone('utc', now()),

  unique (statement_id, sequence_number)
);

comment on table finance.credit_card_transactions is
  'One row per transaction line parsed from a credit_card_statements PDF. amount is always the printed magnitude (never negative); transaction_type carries the debit/credit direction, matching how the statement itself distinguishes them (a leading "+" before the amount, in HDFC''s case).';
comment on column finance.credit_card_transactions.raw_text is
  'The exact text this row was parsed from (joined across a line wrap if the description wrapped in the source PDF) -- kept so a parsing miss can be diagnosed against the real source line without re-fetching the PDF.';
comment on column finance.credit_card_transactions.cardholder_type is
  'primary = matches the statement''s own primary_cardholder; addon = a different name found under its own cardholder-name header within the transaction table (e.g. a spouse or child''s add-on card).';

create index credit_card_transactions_statement_idx
  on finance.credit_card_transactions (statement_id, sequence_number);
create index credit_card_transactions_user_date_idx
  on finance.credit_card_transactions (user_id, transaction_date desc);

alter table finance.credit_card_transactions enable row level security;

create policy user_isolation on finance.credit_card_transactions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on finance.credit_card_transactions to authenticated;
grant all privileges on finance.credit_card_transactions to service_role;

-- Same ownership-integrity guard pattern as every other cross-table
-- reference in this schema (see 20260710000300_add_finance_integrity_guards.sql)
-- -- effectively a no-op today, since this app runs as a single fixed
-- owner, but keeps the invariant enforced at the database layer rather
-- than only in application code, same as everywhere else.
create trigger assert_credit_card_transactions_statement_owner
before insert or update on finance.credit_card_transactions
for each row execute function finance.assert_reference_owner('credit_card_statements', 'statement_id');
