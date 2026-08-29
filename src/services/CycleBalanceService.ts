import "server-only";

import { dbNumberToMoney, moneyToDbNumber, type Money } from "@/lib/money";
import { createServiceClient } from "@/lib/supabase/service";
import { OWNER_USER_ID } from "@/lib/owner";

/**
 * v3.5.0 — behind Dashboard's "Account Balance" (Balance section). One
 * editable "cash on hand at the start of this cycle" figure per cycle,
 * set via the pencil icon next to Account Balance. Only this ONE typed
 * number is stored — the displayed running balance (starting + this
 * cycle's posted income − posted expenses) is computed fresh on every
 * read from `finance.transactions`, never persisted, so it can never go
 * stale relative to the real ledger. See
 * supabase/migrations/20260829120000_create_cycle_starting_balances.sql.
 *
 * Deliberately separate from AccountService.correctAccountBalance —
 * that corrects one real account's balance by logging an adjustment
 * transaction; this is a single, simpler whole-cycle "cash on hand"
 * figure, matching what was actually asked for on Dashboard.
 */

/** Null means never set for this cycle — the caller shows a "set your starting balance" prompt rather than silently assuming zero, since zero would look like a real answer instead of "unknown." */
export async function getCycleStartingBalance(
  cycleMonth: string,
): Promise<Money | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("cycle_starting_balances")
    .select("amount")
    .eq("user_id", OWNER_USER_ID)
    .eq("cycle_month", cycleMonth)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load cycle starting balance: ${error.message}`);
  }

  return data ? dbNumberToMoney(data.amount) : null;
}

export async function setCycleStartingBalance(
  cycleMonth: string,
  amount: Money,
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("cycle_starting_balances").upsert(
    {
      user_id: OWNER_USER_ID,
      cycle_month: cycleMonth,
      amount: moneyToDbNumber(amount),
    },
    { onConflict: "user_id,cycle_month" },
  );

  if (error) {
    throw new Error(`Failed to save cycle starting balance: ${error.message}`);
  }
}
