import type { Metadata } from "next";

import { getNetWorthSummary } from "@/services/NetWorthService";
import { listAssets } from "@/services/AssetService";
import { listLiabilities } from "@/services/LiabilityService";
import { getUserSettings } from "@/services/UserSettingsService";
import { requireUser } from "@/lib/auth/require-user";
import { formatMoneyDisplay } from "@/lib/money";
import { Card, CardLabel, CardValue } from "@/components/ui/card";
import { Hero } from "@/components/ui/hero";
import {
  AddAssetForm,
  AddLiabilityForm,
} from "@/features/net-worth/components/AddAssetLiabilityForms";

export const metadata: Metadata = {
  title: "Net worth",
};

export default async function NetWorthPage() {
  const user = await requireUser();
  const [summary, assets, liabilities, settings] = await Promise.all([
    getNetWorthSummary(),
    listAssets(),
    listLiabilities(),
    getUserSettings(user.id),
  ]);

  const currency = settings?.baseCurrency ?? "USD";
  const standaloneAssets = assets.filter((asset) => asset.accountId === null);
  const standaloneLiabilities = liabilities.filter(
    (liability) => liability.accountId === null,
  );

  return (
    <div>
      <Hero
        title="Net worth"
        label="Net worth"
        amount={formatMoneyDisplay(summary.netWorth, currency)}
        sub="Every account balance, plus assets and liabilities you've added directly."
      />

      <div className="space-y-8 p-5 sm:p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardLabel>From accounts</CardLabel>
            <CardValue>
              {formatMoneyDisplay(summary.accountsTotal, currency)}
            </CardValue>
          </Card>
          <Card>
            <CardLabel>Other assets &minus; liabilities</CardLabel>
            <CardValue>
              {formatMoneyDisplay(summary.standaloneAssetsTotal, currency)}{" "}
              &minus;{" "}
              {formatMoneyDisplay(summary.standaloneLiabilitiesTotal, currency)}
            </CardValue>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <section className="space-y-4">
            <h2 className="font-display text-[15px] font-bold text-ink">
              Assets
            </h2>
            {standaloneAssets.length === 0 ? (
              <p className="text-sm text-ink-faint">None added yet.</p>
            ) : (
              <ul className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
                {standaloneAssets.map((asset) => (
                  <li
                    key={asset.id}
                    className="flex items-center justify-between gap-3 border-b border-line px-[18px] py-3.5 last:border-b-0"
                  >
                    <span className="text-sm font-semibold text-ink">
                      {asset.name}
                    </span>
                    <span className="font-display text-sm font-bold text-ink">
                      {asset.acquisitionCost
                        ? formatMoneyDisplay(
                            asset.acquisitionCost,
                            asset.currencyCode,
                          )
                        : "\u2014"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
              <AddAssetForm defaultCurrency={currency} />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-[15px] font-bold text-ink">
              Liabilities
            </h2>
            {standaloneLiabilities.length === 0 ? (
              <p className="text-sm text-ink-faint">None added yet.</p>
            ) : (
              <ul className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
                {standaloneLiabilities.map((liability) => (
                  <li
                    key={liability.id}
                    className="flex items-center justify-between gap-3 border-b border-line px-[18px] py-3.5 last:border-b-0"
                  >
                    <span className="text-sm font-semibold text-ink">
                      {liability.name}
                    </span>
                    <span className="font-display text-sm font-bold text-ink">
                      {liability.originalAmount
                        ? formatMoneyDisplay(
                            liability.originalAmount,
                            liability.currencyCode,
                          )
                        : "\u2014"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
              <AddLiabilityForm defaultCurrency={currency} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
