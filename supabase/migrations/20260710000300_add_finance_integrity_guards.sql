begin;

create function finance.assert_reference_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  reference_id uuid;
  reference_owner uuid;
begin
  reference_id := nullif(to_jsonb(new) ->> tg_argv[1], '')::uuid;

  if reference_id is null then
    return new;
  end if;

  execute format('select user_id from finance.%I where id = $1', tg_argv[0])
    into reference_owner
    using reference_id;

  if reference_owner is distinct from new.user_id then
    raise exception 'Referenced % record must belong to the same user', tg_argv[0]
      using errcode = '23503';
  end if;

  return new;
end;
$$;

create function finance.assert_account_type()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actual_type text;
begin
  select account_type::text into actual_type
  from finance.accounts
  where id = new.account_id;

  if actual_type is distinct from tg_argv[0] then
    raise exception 'Account must have type %, found %', tg_argv[0], actual_type
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger assert_accounts_institution_owner
before insert or update on finance.accounts
for each row execute function finance.assert_reference_owner('institutions', 'institution_id');

create trigger assert_credit_cards_account_owner
before insert or update on finance.credit_cards
for each row execute function finance.assert_reference_owner('accounts', 'account_id');
create trigger assert_credit_cards_account_type
before insert or update on finance.credit_cards
for each row execute function finance.assert_account_type('credit_card');

create trigger assert_categories_parent_owner
before insert or update on finance.categories
for each row execute function finance.assert_reference_owner('categories', 'parent_id');

create trigger assert_budget_lines_budget_owner
before insert or update on finance.budget_lines
for each row execute function finance.assert_reference_owner('budgets', 'budget_id');
create trigger assert_budget_lines_category_owner
before insert or update on finance.budget_lines
for each row execute function finance.assert_reference_owner('categories', 'category_id');

create trigger assert_recurring_account_owner
before insert or update on finance.recurring_transactions
for each row execute function finance.assert_reference_owner('accounts', 'account_id');
create trigger assert_recurring_transfer_account_owner
before insert or update on finance.recurring_transactions
for each row execute function finance.assert_reference_owner('accounts', 'transfer_account_id');
create trigger assert_recurring_splits_template_owner
before insert or update on finance.recurring_transaction_splits
for each row execute function finance.assert_reference_owner('recurring_transactions', 'recurring_transaction_id');
create trigger assert_recurring_splits_category_owner
before insert or update on finance.recurring_transaction_splits
for each row execute function finance.assert_reference_owner('categories', 'category_id');

create trigger assert_transactions_account_owner
before insert or update on finance.transactions
for each row execute function finance.assert_reference_owner('accounts', 'account_id');
create trigger assert_transactions_transfer_account_owner
before insert or update on finance.transactions
for each row execute function finance.assert_reference_owner('accounts', 'transfer_account_id');
create trigger assert_transactions_template_owner
before insert or update on finance.transactions
for each row execute function finance.assert_reference_owner('recurring_transactions', 'recurring_transaction_id');
create trigger assert_transaction_splits_transaction_owner
before insert or update on finance.transaction_splits
for each row execute function finance.assert_reference_owner('transactions', 'transaction_id');
create trigger assert_transaction_splits_category_owner
before insert or update on finance.transaction_splits
for each row execute function finance.assert_reference_owner('categories', 'category_id');

create trigger assert_loans_account_owner
before insert or update on finance.loans
for each row execute function finance.assert_reference_owner('accounts', 'account_id');
create trigger assert_loans_account_type
before insert or update on finance.loans
for each row execute function finance.assert_account_type('loan');

create trigger assert_assets_account_owner
before insert or update on finance.assets
for each row execute function finance.assert_reference_owner('accounts', 'account_id');
create trigger assert_assets_account_type
before insert or update on finance.assets
for each row when (new.account_id is not null) execute function finance.assert_account_type('asset');

create trigger assert_liabilities_account_owner
before insert or update on finance.liabilities
for each row execute function finance.assert_reference_owner('accounts', 'account_id');
create trigger assert_liabilities_account_type
before insert or update on finance.liabilities
for each row when (new.account_id is not null) execute function finance.assert_account_type('liability');

create trigger assert_investment_transactions_account_owner
before insert or update on finance.investment_transactions
for each row execute function finance.assert_reference_owner('accounts', 'account_id');
create trigger assert_investment_transactions_security_owner
before insert or update on finance.investment_transactions
for each row execute function finance.assert_reference_owner('securities', 'security_id');
create trigger assert_investment_transactions_account_type
before insert or update on finance.investment_transactions
for each row execute function finance.assert_account_type('investment');

create trigger assert_transaction_attachments_transaction_owner
before insert or update on finance.transaction_attachments
for each row execute function finance.assert_reference_owner('transactions', 'transaction_id');
create trigger assert_transaction_attachments_attachment_owner
before insert or update on finance.transaction_attachments
for each row execute function finance.assert_reference_owner('attachments', 'attachment_id');
create trigger assert_account_attachments_account_owner
before insert or update on finance.account_attachments
for each row execute function finance.assert_reference_owner('accounts', 'account_id');
create trigger assert_account_attachments_attachment_owner
before insert or update on finance.account_attachments
for each row execute function finance.assert_reference_owner('attachments', 'attachment_id');
create trigger assert_asset_attachments_asset_owner
before insert or update on finance.asset_attachments
for each row execute function finance.assert_reference_owner('assets', 'asset_id');
create trigger assert_asset_attachments_attachment_owner
before insert or update on finance.asset_attachments
for each row execute function finance.assert_reference_owner('attachments', 'attachment_id');
create trigger assert_liability_attachments_liability_owner
before insert or update on finance.liability_attachments
for each row execute function finance.assert_reference_owner('liabilities', 'liability_id');
create trigger assert_liability_attachments_attachment_owner
before insert or update on finance.liability_attachments
for each row execute function finance.assert_reference_owner('attachments', 'attachment_id');

grant execute on all functions in schema finance to authenticated, service_role;
alter default privileges in schema finance grant execute on functions to authenticated, service_role;

commit;
