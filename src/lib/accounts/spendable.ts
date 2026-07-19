import type { AccountType } from "@/services/AccountService";

/**
 * "Spendable" cash accounts — money you can actually spend today, as
 * opposed to credit cards, loans, investments, or the standalone asset/
 * liability tracking entries. Two unrelated things both need this exact
 * set and would otherwise define it twice:
 *
 * 1. CreateTransactionForm (client component) restricts the general
 *    Transfer tab's account pickers to these types — moving money
 *    to/from a credit card or loan isn't this form's job, that's what
 *    "Log a card payment" is for (v1.1.4).
 * 2. BudgetSnapshotService (server-only) uses it to decide whether a
 *    transfer actually reduces cash-on-hand for the projected balance —
 *    a transfer between two spendable accounts is neutral, but a
 *    transfer INTO a credit card or loan account is a real payment
 *    leaving your spendable money, even though it doesn't touch net
 *    worth (v1.1.5).
 *
 * Deliberately a plain module (no "server-only"), so both a client
 * component and a server-only service can import it — AccountService.ts
 * itself is marked server-only and can't be imported at runtime from a
 * client component, only via `import type`, which is why this constant
 * doesn't just live there.
 */
export const SPENDABLE_ACCOUNT_TYPES: readonly AccountType[] = [
  "checking",
  "savings",
  "cash",
];

export function isSpendableAccountType(type: AccountType): boolean {
  return (SPENDABLE_ACCOUNT_TYPES as AccountType[]).includes(type);
}
