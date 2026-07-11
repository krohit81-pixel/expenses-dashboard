import "server-only";

import {
  dbNumberToMoney,
  moneyToDbNumber,
  negateMoney,
  sumMoney,
  type Money,
} from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { Enum } from "@/lib/db/helpers";
import {
  createAccountInputSchema,
  type CreateAccountInput,
} from "@/features/accounts/schemas";

export type { CreateAccountInput };
export type AccountType = Enum<"account_type">;

export interface CreditCardDetails {
  creditLimit: Money | null;
  statementDay: number | null;
  paymentDueDay: number | null;
  annualPercentageRate: number | null;
}

export interface Account {
  id: string;
  institutionId: string | null;
  name: string;
  accountType: AccountType;
  currencyCode: string;
  openingBalance: Money;
  openingBalanceDate: string | null;
  isArchived: boolean;
  creditCard: CreditCardDetails | null;
}

interface AccountRow {
  id: string;
  institution_id: string | null;
  name: string;
  account_type: AccountType;
  currency_code: string;
  opening_balance: number;
  opening_balance_date: string | null;
  is_archived: boolean;
  credit_cards:
    | {
        credit_limit: number | null;
        statement_day: number | null;
        payment_due_day: number | null;
        annual_percentage_rate: number | null;
      }[]
    | null;
}

function mapRow(row: AccountRow): Account {
  const creditCard = row.credit_cards?.[0];
  return {
    id: row.id,
    institutionId: row.institution_id,
    name: row.name,
    accountType: row.account_type,
    currencyCode: row.currency_code,
    openingBalance: dbNumberToMoney(row.opening_balance),
    openingBalanceDate: row.opening_balance_date,
    isArchived: row.is_archived,
    creditCard: creditCard
      ? {
          creditLimit:
            creditCard.credit_limit == null
              ? null
              : dbNumberToMoney(creditCard.credit_limit),
          statementDay: creditCard.statement_day,
          paymentDueDay: creditCard.payment_due_day,
          annualPercentageRate: creditCard.annual_percentage_rate,
        }
      : null,
  };
}

const ACCOUNT_SELECT =
  "id, institution_id, name, account_type, currency_code, opening_balance, opening_balance_date, is_archived, credit_cards(credit_limit, statement_day, payment_due_day, annual_percentage_rate)";

export async function listAccounts(
  includeArchived = false,
): Promise<Account[]> {
  const supabase = await createClient();
  let query = supabase.from("accounts").select(ACCOUNT_SELECT).order("name");

  if (!includeArchived) {
    query = query.eq("is_archived", false);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load accounts: ${error.message}`);
  }

  return (data as AccountRow[]).map(mapRow);
}

export async function getAccount(accountId: string): Promise<Account | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select(ACCOUNT_SELECT)
    .eq("id", accountId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load account: ${error.message}`);
  }

  return data ? mapRow(data as AccountRow) : null;
}

/**
 * Creates an account, and for account_type "credit_card" also creates the
 * 1:1 finance.credit_cards row. Not atomic yet (no RPC exists for this) —
 * if the second insert fails, the account row is deleted as a best-effort
 * compensating action so we don't leave an orphaned credit_card-typed
 * account with no credit_cards row. A future migration adding a Postgres
 * function would make this a single atomic call; see docs/02's note on
 * "single transaction/RPC" for multi-step workflows.
 */
export async function createAccount(
  input: CreateAccountInput,
): Promise<Account> {
  const parsed = createAccountInputSchema.parse(input);
  const supabase = await createClient();

  const { data: accountRow, error: accountError } = await supabase
    .from("accounts")
    .insert({
      institution_id: parsed.institutionId ?? null,
      name: parsed.name,
      account_type: parsed.accountType,
      currency_code: parsed.currencyCode,
      opening_balance: moneyToDbNumber(parsed.openingBalance),
      opening_balance_date: parsed.openingBalanceDate ?? null,
    })
    .select("id")
    .single();

  if (accountError) {
    throw new Error(`Failed to create account: ${accountError.message}`);
  }

  if (parsed.accountType === "credit_card") {
    const { error: creditCardError } = await supabase
      .from("credit_cards")
      .insert({
        account_id: accountRow.id,
        credit_limit:
          parsed.creditLimit != null
            ? moneyToDbNumber(parsed.creditLimit)
            : null,
        statement_day: parsed.statementDay ?? null,
        payment_due_day: parsed.paymentDueDay ?? null,
        annual_percentage_rate: parsed.annualPercentageRate ?? null,
      });

    if (creditCardError) {
      await supabase.from("accounts").delete().eq("id", accountRow.id);
      throw new Error(
        `Failed to create credit card details: ${creditCardError.message}`,
      );
    }
  }

  const created = await getAccount(accountRow.id);
  if (!created) {
    throw new Error("Account was created but could not be re-read");
  }
  return created;
}

export async function archiveAccount(accountId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("accounts")
    .update({ is_archived: true })
    .eq("id", accountId);

  if (error) {
    throw new Error(`Failed to archive account: ${error.message}`);
  }
}

/**
 * Computes an account's current balance as opening_balance plus every
 * posted transaction that touches it (as the primary account for income/
 * expense/transfer-out, or as the transfer_account_id for transfer-in).
 *
 * Sums in application code rather than a SQL aggregate because no
 * aggregate RPC/view exists yet — acceptable at personal-ledger scale, but
 * revisit with a SQL-side aggregate or materialized view once transaction
 * volume or dashboard latency makes this worth it (see docs/02's note on
 * "materialize once explain analyze justifies it").
 */
export async function getAccountBalance(accountId: string): Promise<Money> {
  const account = await getAccount(accountId);
  if (!account) {
    throw new Error("Account not found");
  }

  const supabase = await createClient();

  const [outgoing, incoming] = await Promise.all([
    supabase
      .from("transactions")
      .select("amount, kind")
      .eq("account_id", accountId)
      .eq("status", "posted"),
    supabase
      .from("transactions")
      .select("amount")
      .eq("transfer_account_id", accountId)
      .eq("status", "posted")
      .eq("kind", "transfer"),
  ]);

  if (outgoing.error) {
    throw new Error(
      `Failed to load account transactions: ${outgoing.error.message}`,
    );
  }
  if (incoming.error) {
    throw new Error(
      `Failed to load incoming transfers: ${incoming.error.message}`,
    );
  }

  let balance = account.openingBalance;
  for (const row of outgoing.data) {
    const amount = dbNumberToMoney(row.amount);
    if (row.kind === "income") {
      balance = sumMoney([balance, amount]);
    } else if (row.kind === "expense" || row.kind === "transfer") {
      balance = sumMoney([balance, negateMoney(amount)]);
    }
    // 'adjustment' kind is intentionally not created by any Milestone 1
    // workflow yet — see docs note in TransactionService about its
    // undefined sign convention in the current schema.
  }
  for (const row of incoming.data) {
    balance = sumMoney([balance, dbNumberToMoney(row.amount)]);
  }

  return balance;
}
