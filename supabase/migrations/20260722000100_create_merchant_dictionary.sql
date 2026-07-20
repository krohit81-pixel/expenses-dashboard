-- v1.5.0: Merchant Intelligence Foundation.
--
-- The Merchant Dictionary: a single, shared source of truth for "what is
-- this merchant, and what category does it belong to," used by every
-- statement parser (today: HDFC Infinia; future: ICICI, Axis, SBI, Amex,
-- ...). Categorization logic must never be hardcoded inside a parser --
-- a parser's only job is to say "this raw text appeared on the
-- statement," never to decide what it means. See
-- src/services/merchant/ for the resolution logic this schema backs.
--
-- Three tables:
--   atlas_categories  -- the master category/subcategory taxonomy
--   merchants         -- one row per real-world merchant
--   merchant_aliases  -- every raw text variant a bank's PDF has ever
--                        produced for a merchant, mapped to it
--
-- Deliberately separate from finance.categories/finance.transactions
-- (the hand-entered ledger) -- same reasoning as
-- credit_card_statements/credit_card_transactions in the previous
-- migration: this is statement-import machinery, not a replacement for
-- the ledger's own category system. Nothing here references, and
-- nothing in the ledger references this.

create table finance.atlas_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  category_name text not null check (char_length(category_name) between 1 and 80),
  -- Self-referencing, not a denormalized parent name column (the spec's
  -- literal "parent_category" field) -- matches finance.categories'
  -- existing parent_id pattern in this same schema, and avoids the
  -- rename-drift problem a text-based parent reference would have.
  -- Null means top-level (e.g. "Food & Dining"); non-null means a
  -- subcategory (e.g. "Food & Dining" > "Coffee Shops").
  parent_category_id uuid references finance.atlas_categories(id) on delete restrict,
  icon text,
  display_order integer not null default 0,
  active boolean not null default true,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  check (parent_category_id is null or parent_category_id <> id)
);

comment on table finance.atlas_categories is
  'The master category/subcategory taxonomy every statement parser categorizes merchants against. Seeded once via scripts/seed-atlas-categories.mjs (the 22 top-level categories from the v1.5 spec) -- not hardcoded into this migration, since seeding needs a real user_id that only exists per-deployment (see bootstrap-owner.mjs for the same reasoning).';

-- A top-level category name must be unique; a subcategory name must be
-- unique within its parent. Two separate partial indexes rather than one
-- plain unique constraint, because a plain `unique (user_id,
-- parent_category_id, category_name)` would silently allow duplicate
-- top-level categories -- Postgres treats every NULL in a unique index
-- as distinct from every other NULL, so rows with parent_category_id
-- null never collide against each other.
create unique index atlas_categories_top_level_name_idx
  on finance.atlas_categories (user_id, category_name)
  where parent_category_id is null;
create unique index atlas_categories_subcategory_name_idx
  on finance.atlas_categories (user_id, parent_category_id, category_name)
  where parent_category_id is not null;

alter table finance.atlas_categories enable row level security;

create policy user_isolation on finance.atlas_categories
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on finance.atlas_categories to authenticated;
grant all privileges on finance.atlas_categories to service_role;

create trigger set_atlas_categories_updated_at
before update on finance.atlas_categories
for each row execute function finance.set_updated_at();

-- ---------------------------------------------------------------------

create table finance.merchants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  -- The canonical matching key (e.g. "Google Cloud") -- what
  -- merchant_aliases.alias ultimately resolves to. display_name starts
  -- identical but can be edited independently (e.g. a nicer label)
  -- without touching the matching key aliases point at.
  merchant_name text not null check (char_length(merchant_name) between 1 and 200),
  display_name text not null check (char_length(display_name) between 1 and 200),

  atlas_category_id uuid references finance.atlas_categories(id) on delete set null,
  atlas_subcategory_id uuid references finance.atlas_categories(id) on delete set null,

  merchant_type text check (merchant_type is null or char_length(merchant_type) <= 60),
  is_recurring boolean not null default false,
  is_subscription boolean not null default false,
  is_transfer boolean not null default false,
  is_income boolean not null default false,

  default_currency char(3) not null default 'INR' check (default_currency ~ '^[A-Z]{3}$'),
  website text check (website is null or char_length(website) <= 300),
  logo_url text check (logo_url is null or char_length(logo_url) <= 300),
  notes text check (notes is null or char_length(notes) <= 2000),

  -- Confidence in the merchant *identity* match (this alias really does
  -- mean this merchant) -- not confidence in its category, which is
  -- either set by a human or simply null. 1.00 for every
  -- parser-auto-created merchant (the raw text unambiguously appeared on
  -- a real statement; there's nothing uncertain about that part).
  -- Reserved for a future fuzzy-matching pass (see this feature's
  -- delivery notes) that would create lower-confidence matches worth
  -- surfacing for review.
  confidence numeric(3, 2) check (confidence is null or confidence between 0 and 1),
  active boolean not null default true,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  unique (user_id, merchant_name)
);

comment on table finance.merchants is
  'One row per real-world merchant, shared across every card issuer''s parser. atlas_category_id/atlas_subcategory_id are the ONLY place a transaction''s category comes from -- see credit_card_transactions.merchant_id and this feature''s delivery notes for why category is always resolved through this join, never copied onto a transaction row.';

create index merchants_user_category_idx
  on finance.merchants (user_id, atlas_category_id);

alter table finance.merchants enable row level security;

create policy user_isolation on finance.merchants
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on finance.merchants to authenticated;
grant all privileges on finance.merchants to service_role;

create trigger set_merchants_updated_at
before update on finance.merchants
for each row execute function finance.set_updated_at();

-- ---------------------------------------------------------------------

create table finance.merchant_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  merchant_id uuid not null references finance.merchants(id) on delete cascade,

  -- The exact raw text a bank's statement produced (e.g.
  -- "GOOGLE CLOUDMUMBAI"), or -- for a normalized-match hit -- the
  -- normalized form a parser computed. One alias always maps to exactly
  -- one merchant (see the unique constraint below); a single merchant
  -- accumulates many aliases over time as different raw variants show
  -- up ("GOOGLE CLOUDMUMBAI", "GOOGLE CLOUDSMUMBAI", "GOOGLE CLOUD
  -- INDIA" all -> the same Google Cloud row).
  alias text not null check (char_length(alias) between 1 and 300),
  -- Free text, not an enum -- matches CardStatementSource loosely
  -- (e.g. "hdfc-infinia") but deliberately not a hard FK/type
  -- dependency on that union, since this table has to outlive whatever
  -- set of cards Atlas currently supports.
  source_bank text check (source_bank is null or char_length(source_bank) <= 60),
  confidence numeric(3, 2) check (confidence is null or confidence between 0 and 1),

  created_at timestamptz not null default timezone('utc', now()),

  unique (user_id, alias)
);

comment on table finance.merchant_aliases is
  'Every raw/normalized text variant that resolves to a merchant. The alias -> merchant_id mapping is deterministic and 1:1 by construction (unique (user_id, alias)) -- see src/services/merchant/resolve.ts for the exact-match-then-normalized-match lookup this supports.';

create index merchant_aliases_merchant_idx
  on finance.merchant_aliases (merchant_id);

alter table finance.merchant_aliases enable row level security;

create policy user_isolation on finance.merchant_aliases
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on finance.merchant_aliases to authenticated;
grant all privileges on finance.merchant_aliases to service_role;

-- Same ownership-integrity guard pattern as every other cross-table
-- reference in this schema -- one trigger per FK column, since
-- assert_reference_owner checks a single column per invocation.
create trigger assert_atlas_categories_parent_owner
before insert or update on finance.atlas_categories
for each row execute function finance.assert_reference_owner('atlas_categories', 'parent_category_id');

create trigger assert_merchants_category_owner
before insert or update on finance.merchants
for each row execute function finance.assert_reference_owner('atlas_categories', 'atlas_category_id');

create trigger assert_merchants_subcategory_owner
before insert or update on finance.merchants
for each row execute function finance.assert_reference_owner('atlas_categories', 'atlas_subcategory_id');

create trigger assert_merchant_aliases_merchant_owner
before insert or update on finance.merchant_aliases
for each row execute function finance.assert_reference_owner('merchants', 'merchant_id');
