import "server-only";

import { addMoney, negateMoney, sumMoney, type Money } from "@/lib/money";
import { listAccounts, getAccountBalance } from "@/services/AccountService";
import { listAssets } from "@/services/AssetService";
import { listLiabilities } from "@/services/LiabilityService";

export interface NetWorthSummary {
  netWorth: Money;
  accountsTotal: Money;
  standaloneAssetsTotal: Money;
  standaloneLiabilitiesTotal: Money;
}

/**
 * Net worth = sum of every account's balance, plus standalone (not
 * account-linked) assets, minus standalone liabilities.
 *
 * Why summing account balances needs no per-type sign-flipping: every
 * account type uses the same balance formula in AccountService
 * (opening_balance + income - expense - transfer_out + transfer_in). For a
 * credit_card or loan account, spending is recorded as an expense against
 * that account, which drives its balance negative — i.e. "you owe more" is
 * already represented as a negative number, exactly what a net worth sum
 * needs. Paying down a card is a transfer into it, which correctly moves
 * its balance back toward zero. So a straight sum across every account
 * type gives the right answer without treating debt-bearing types
 * specially. (This does mean account creation must allow negative opening
 * balances for cards/loans/liabilities to enter existing debt — see the
 * comment in features/accounts/schemas.ts.)
 *
 * Standalone assets/liabilities (account_id IS NULL) use their static
 * acquisition_cost/original_amount, since the schema has no valuation
 * history table — this is a point-in-time figure the person enters and
 * updates manually, not a live-tracked value. Assets/liabilities that ARE
 * linked to an account are deliberately excluded here to avoid double-
 * counting: their value already flows through that account's balance.
 */
export async function getNetWorthSummary(): Promise<NetWorthSummary> {
  const [accounts, assets, liabilities] = await Promise.all([
    listAccounts(),
    listAssets(),
    listLiabilities(),
  ]);

  const balances = await Promise.all(
    accounts.map((account) => getAccountBalance(account.id)),
  );
  const accountsTotal = sumMoney(balances);

  const standaloneAssetsTotal = sumMoney(
    assets
      .filter(
        (asset) => asset.accountId === null && asset.acquisitionCost !== null,
      )
      .map((asset) => asset.acquisitionCost as Money),
  );

  const standaloneLiabilitiesTotal = sumMoney(
    liabilities
      .filter(
        (liability) =>
          liability.accountId === null && liability.originalAmount !== null,
      )
      .map((liability) => liability.originalAmount as Money),
  );

  const netWorth = addMoney(
    addMoney(accountsTotal, standaloneAssetsTotal),
    negateMoney(standaloneLiabilitiesTotal),
  );

  return {
    netWorth,
    accountsTotal,
    standaloneAssetsTotal,
    standaloneLiabilitiesTotal,
  };
}
