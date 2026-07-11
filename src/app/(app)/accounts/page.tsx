import type { Metadata } from "next";

import { listAccounts, getAccountBalance } from "@/services/AccountService";
import { listInstitutions } from "@/services/InstitutionService";
import { getUserSettings } from "@/services/UserSettingsService";
import { requireUser } from "@/lib/auth/require-user";
import { formatMoneyDisplay } from "@/lib/money";
import { CreateAccountForm } from "@/features/accounts/components/CreateAccountForm";
import { CreateInstitutionForm } from "@/features/institutions/components/CreateInstitutionForm";

export const metadata: Metadata = {
  title: "Accounts",
};

export default async function AccountsPage() {
  const user = await requireUser();
  const [accounts, institutions, settings] = await Promise.all([
    listAccounts(),
    listInstitutions(),
    getUserSettings(user.id),
  ]);

  const balances = await Promise.all(
    accounts.map(async (account) => ({
      account,
      balance: await getAccountBalance(account.id),
    })),
  );

  const defaultCurrency = settings?.baseCurrency ?? "USD";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Accounts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {accounts.length === 0
            ? "No accounts yet — add your first one below."
            : `${accounts.length} account${accounts.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {balances.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {balances.map(({ account, balance }) => (
            <li
              key={account.id}
              className="flex items-center justify-between p-4"
            >
              <div>
                <p className="font-medium">{account.name}</p>
                <p className="text-sm capitalize text-muted-foreground">
                  {account.accountType.replace("_", " ")}
                </p>
              </div>
              <p className="font-medium tabular-nums">
                {formatMoneyDisplay(balance, account.currencyCode)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-medium">Add an account</h2>
        <CreateAccountForm
          institutions={institutions}
          defaultCurrency={defaultCurrency}
        />
      </section>

      <section className="space-y-4 border-t pt-6">
        <CreateInstitutionForm />
      </section>
    </div>
  );
}
