import type { Metadata } from "next";

import { listAccounts, getAccountBalance } from "@/services/AccountService";
import { listInstitutions } from "@/services/InstitutionService";
import { getUserSettings } from "@/services/UserSettingsService";
import { requireUser } from "@/lib/auth/require-user";
import { formatMoneyDisplay, isNegativeMoney } from "@/lib/money";
import { Hero } from "@/components/ui/hero";
import { CreateAccountForm } from "@/features/accounts/components/CreateAccountForm";
import { CreateInstitutionForm } from "@/features/institutions/components/CreateInstitutionForm";

export const metadata: Metadata = {
  title: "Accounts",
};

/**
 * Statement/attachment uploads (AccountAttachmentUploader,
 * AttachmentService) used to render here per-account — removed per
 * explicit request, since it read as "upload a statement now" when
 * nothing is done with it yet. The underlying service and DB tables are
 * untouched; this belongs on the future Imports page once that's real,
 * not here.
 */
export default async function AccountsPage() {
  const user = await requireUser();
  const [accounts, institutions, settings] = await Promise.all([
    listAccounts(),
    listInstitutions(),
    getUserSettings(user.id),
  ]);

  const rows = await Promise.all(
    accounts.map(async (account) => ({
      account,
      balance: await getAccountBalance(account.id),
    })),
  );

  const defaultCurrency = settings?.baseCurrency ?? "USD";

  return (
    <div>
      <Hero
        title="Accounts"
        label={accounts.length === 0 ? undefined : "Total accounts"}
        amount={accounts.length === 0 ? undefined : String(accounts.length)}
        sub={
          accounts.length === 0
            ? "No accounts yet — add your first one below."
            : undefined
        }
      />

      <div className="space-y-8 p-5 sm:p-8">
        {rows.length > 0 && (
          <section>
            <h2 className="mb-3 font-display text-[15px] font-bold text-ink">
              Your accounts
            </h2>
            <ul className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
              {rows.map(({ account, balance }) => (
                <li
                  key={account.id}
                  className="flex items-center justify-between gap-3 border-b border-line px-[18px] py-3.5 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {account.name}
                    </p>
                    <p className="text-xs capitalize text-ink-faint">
                      {account.accountType.replace("_", " ")}
                    </p>
                  </div>
                  <p
                    className={`whitespace-nowrap font-display text-[15px] font-bold ${isNegativeMoney(balance) ? "text-negative" : "text-ink"}`}
                  >
                    {formatMoneyDisplay(balance, account.currencyCode)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <h2 className="mb-4 font-display text-[15px] font-bold text-ink">
            Add an account
          </h2>
          <CreateAccountForm
            institutions={institutions}
            defaultCurrency={defaultCurrency}
          />
        </section>

        <section className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <CreateInstitutionForm />
        </section>
      </div>
    </div>
  );
}
