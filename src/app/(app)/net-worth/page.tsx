import type { Metadata } from "next";

import { getNetWorthSummary } from "@/services/NetWorthService";
import { listAssets } from "@/services/AssetService";
import { listLiabilities } from "@/services/LiabilityService";
import { getUserSettings } from "@/services/UserSettingsService";
import { requireUser } from "@/lib/auth/require-user";
import { formatMoneyDisplay, isPositiveMoney } from "@/lib/money";
import { Card, CardLabel, CardValue } from "@/components/ui/card";
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
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Net worth</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every account balance, plus assets and liabilities you&apos;ve added
          directly.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardLabel>Net worth</CardLabel>
          <CardValue
            className={
              isPositiveMoney(summary.netWorth)
                ? "text-emerald-600"
                : "text-destructive"
            }
          >
            {formatMoneyDisplay(summary.netWorth, currency)}
          </CardValue>
        </Card>
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

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-sm font-medium">Assets</h2>
          {standaloneAssets.length === 0 ? (
            <p className="text-sm text-muted-foreground">None added yet.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {standaloneAssets.map((asset) => (
                <li
                  key={asset.id}
                  className="flex items-center justify-between p-4"
                >
                  <span>{asset.name}</span>
                  <span className="font-medium tabular-nums">
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
          <AddAssetForm defaultCurrency={currency} />
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-medium">Liabilities</h2>
          {standaloneLiabilities.length === 0 ? (
            <p className="text-sm text-muted-foreground">None added yet.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {standaloneLiabilities.map((liability) => (
                <li
                  key={liability.id}
                  className="flex items-center justify-between p-4"
                >
                  <span>{liability.name}</span>
                  <span className="font-medium tabular-nums">
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
          <AddLiabilityForm defaultCurrency={currency} />
        </section>
      </div>
    </div>
  );
}
