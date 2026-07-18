# Database Design

## Schema ownership

All application data lives in the `finance` schema of the Supabase
project referred to as "Vitals." `auth` and `storage` are
Supabase-managed. The `finance` schema must be added to Vitals' exposed
API schemas for any client (including the service-role client) to query
it — this is a Supabase project *settings* step, not something a
migration can do.

## Tables actually in use

These are read/written by real code — grep `src/services/` for the
table name if you want to confirm which service owns which table.

| Table | Used by | Notes |
|---|---|---|
| `user_settings` | `UserSettingsService` | One row per owner; base currency, timezone. Middleware checks this exists to gate `/onboarding`. |
| `institutions` | `InstitutionService` | Simple lookup, referenced by `accounts.institution_id`. |
| `accounts` | `AccountService` | `account_type` enum: `checking, savings, cash, credit_card, investment, loan, asset, liability`. Only `checking`/`savings`/`credit_card` are meaningfully exercised by current UI. |
| `credit_cards` | `AccountService` | One-to-one with `accounts` where `account_type = 'credit_card'`. `payment_due_day` drives the "Due by the Nth" label on Home's account cards. |
| `categories` | `CategoryService` | `category_kind` enum: `income, expense`. |
| `recurring_transactions` + `recurring_transaction_splits` | `RecurringTransactionService` | **Reference data, not an auto-projection source** — see `docs/01-product-vision.md`'s cycle-tagging section. A template only counts toward a month if a real transaction is tagged to it. |
| `transactions` + `transaction_splits` | `TransactionService`, `BudgetSnapshotService` | See "The `transactions` table in detail" below — this is the one to understand deeply. |
| `assets`, `liabilities` (+ their `*_attachments` link tables) | `AssetService`, `LiabilityService`, `NetWorthService` | `asset_type`/`liability_type` enums exist but net worth aggregation mostly treats these as flat records. |
| `attachments` + `transaction_attachments`/`account_attachments`/`asset_attachments`/`liability_attachments` | `AttachmentService` | Explicit link tables per entity type, not a polymorphic FK — deliberate choice for referential integrity. |

## Tables that exist but have zero code referencing them

These came from an early, more ambitious migration and were never wired
up. **Do not assume they're part of the working system** — no service
reads or writes them, confirmed by grepping every `.ts`/`.tsx` file for
each table name (excluding the generated types file itself):

- `budgets`, `budget_lines` — an earlier "period + planned amount per
  category" budgeting model. Superseded entirely by
  `BudgetSnapshotService`'s computed-from-transactions approach (see
  the comment at the top of `src/app/(app)/budgets/page.tsx`). If a
  future budgeting feature needs a stored "planned amount," that's new
  design work, not a matter of wiring up these tables — they predate
  the cycle-tagging model and don't have a `cycle_month` concept at
  all.
- `securities`, `investment_transactions` — investment tracking was
  planned, never built. `docs/01-product-vision.md` lists this
  explicitly as out of scope for now.
- `loans` — one-to-one account specialization like `credit_cards`, but
  no loan-specific UI or service was ever built against it.

If you're asked to build investment tracking or a stored-budget
feature, these tables are a reasonable *starting point* to evaluate,
not a foregone conclusion — check whether their shape still fits the
cycle-aware model before reusing them as-is.

## The `transactions` table in detail

This is the center of the whole app. Columns worth knowing precisely:

- `kind`: `income | expense | transfer | adjustment`. `adjustment`
  exists in the enum but isn't meaningfully used by current UI.
- `status`: `pending | posted | void`. `pending` = scheduled/not yet
  happened; `posted` = happened, counts toward account balances
  (`getAccountBalance` only sums `posted` rows); `void` = soft-deleted
  (see `voidTransaction`/`voidTransactionAction` — exposed as a
  "Delete" button on `TransactionRow`, added after a real gap where
  there was no way to remove a mistaken entry).
- `occurred_on`: the literal date money moves (or is scheduled to).
- `cycle_month` (added in migration `20260714000100`, nullable text,
  `"YYYY-MM"` format, checked via regex): which month's cash-flow plan
  this counts toward. **Independent of `occurred_on`.** Null means
  untagged — excluded from every month's `BudgetSnapshotService`
  output until tagged. See `docs/01-product-vision.md` for the full
  reasoning; this is the single most important column in the schema to
  understand before changing anything Budget- or Home-related.
- `recurring_transaction_id`: nullable FK to `recurring_transactions`.
  Present when a transaction was generated from (or manually tagged to)
  a recurring template; null for one-off entries (card payments,
  ad-hoc expenses).

Defaulting behavior for `cycle_month` (in `TransactionService`'s
`createTransaction`/`updateTransaction`, not the schema itself):
omitting it on **create** defaults to `occurredOn`'s own month;
omitting it on **update** means "don't touch it" (a different default
— an edit that only changes the amount shouldn't silently clear or
move an existing tag). Explicit `null` always means "leave/make
untagged."

## Data invariants

- All money uses `numeric(18,2)`. Securities-related tables (unused,
  see above) use `numeric(24,8)` for quantities — irrelevant unless
  investment tracking gets built.
- `currency_code` is uppercase ISO-4217 text, enforced by a check
  constraint (`^[A-Z]{3}$`).
- Amounts are stored positive; `kind` (transactions) or the specific
  in/out convention of the reading code provides direction.
- An integrity-guard migration (`20260710000300`) enforces that
  cross-references (account, category, template, attachment) share the
  same `user_id` as the referencing row — meaningful mostly as a
  data-integrity backstop given there's only one real `user_id` in
  practice (the owner account), not a multi-tenant isolation
  mechanism.

## Migration history (chronological, as of this writing)

1. `20260710000100_create_finance_schema.sql` — the full initial
   schema, including the vestigial tables noted above.
2. `20260710000200_create_finance_attachment_bucket.sql` — private
   Supabase Storage bucket for attachments.
3. `20260710000300_add_finance_integrity_guards.sql` — cross-reference
   `user_id` consistency triggers.
4. `20260714000100_add_transaction_cycle_month.sql` — adds
   `cycle_month` to `transactions`. Nullable, deliberately not
   backfilled (no reliable way to infer intent for pre-existing rows —
   see the migration's own comment). This is the migration that made
   the entire Financial Cycle → Phase product model possible.

Migrations are append-only once applied to Vitals — never edit an
applied migration, add a corrective one instead.

## Supabase access pattern

Every server-side query goes through the service-role client
(`src/lib/supabase/service.ts`), which bypasses RLS entirely. RLS
policies exist in the migrations but are not what's actually protecting
this app's data day to day — the access-gate password (see
`docs/02-system-architecture.md` and `docs/11-security-and-privacy.md`)
is. The browser never receives the service-role key; there's also no
scenario in the current app where the browser talks to Supabase
directly at all for finance data.
