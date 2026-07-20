-- v1.5.0: link imported transactions to the new Merchant Dictionary.
--
-- merchant_id is the ONLY path a category reaches a transaction through
-- -- there is deliberately no category_id column here. A transaction's
-- category is always resolved live via
-- credit_card_transactions -> merchants -> atlas_categories, so
-- re-categorizing a merchant instantly applies to every transaction
-- that references it, with no re-import and no bulk UPDATE of
-- transaction rows (see src/services/MerchantService.ts's
-- updateMerchant for the one exception -- needs_review below -- and why
-- that one's different).
--
-- merchant_raw/merchant_normalized (from v1.4.0) are untouched: raw text
-- fidelity stays on the transaction row regardless of dictionary state,
-- and merchant_normalized remains a cheap display fallback for the rare
-- row where merchant_id is null (a non-merchant credit, e.g. a payment
-- or cashback line -- see hdfc-infinia's classify-transaction.ts).
alter table finance.credit_card_transactions
  add column merchant_id uuid references finance.merchants(id) on delete set null;

-- Not derived live from "does merchant_id point at a merchant with a
-- null category" on every read, on purpose: that would make "needs
-- review" silently flip for old transactions the moment ANY of a
-- merchant's later transactions gets looked at, with no record of when
-- or why. Stored instead, set once at import time (merchant newly
-- created, or matched to a merchant that's still uncategorized) and
-- explicitly cleared in one bulk statement the moment a human assigns
-- that merchant a category (see updateMerchant in MerchantService.ts)
-- -- an intentional, auditable transition, not a passive recomputation.
alter table finance.credit_card_transactions
  add column needs_review boolean not null default false;

comment on column finance.credit_card_transactions.merchant_id is
  'The resolved Merchant Dictionary entry for this row -- null for non-merchant credits (payments, cashback, refunds; see is_payment/is_cashback/is_refund) where "which merchant" doesn''t apply. Category is ALWAYS read through this, never stored on the transaction.';
comment on column finance.credit_card_transactions.needs_review is
  'True if this row''s merchant had no category at import time. Cleared in bulk when that merchant is categorized (see MerchantService.updateMerchant) -- not silently recomputed on read.';

create index credit_card_transactions_merchant_idx
  on finance.credit_card_transactions (merchant_id);
create index credit_card_transactions_needs_review_idx
  on finance.credit_card_transactions (user_id, needs_review)
  where needs_review;

create trigger assert_credit_card_transactions_merchant_owner
before insert or update on finance.credit_card_transactions
for each row execute function finance.assert_reference_owner('merchants', 'merchant_id');
