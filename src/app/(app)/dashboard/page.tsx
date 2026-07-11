import type { Metadata } from "next";

import { getCashFlowSummary } from "@/services/ReportingService";
import { listCategories } from "@/services/CategoryService";
import { getUserSettings } from "@/services/UserSettingsService";
import { requireUser } from "@/lib/auth/require-user";
import { formatMoneyDisplay, signedMoneyColorClass } from "@/lib/money";
import { Card, CardLabel, CardValue } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Dashboard",
};

function monthToDateRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

export default async function DashboardPage() {
  const user = await requireUser();
  const range = monthToDateRange();

  const [summary, categories, settings] = await Promise.all([
    getCashFlowSummary(range),
    listCategories(true),
    getUserSettings(user.id),
  ]);

  const currency = settings?.baseCurrency ?? "USD";
  const categoryName = new Map(
    categories.map((category) => [category.id, category.name]),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Month to date &middot; {range.from} to {range.to}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardLabel>Income</CardLabel>
          <CardValue>
            {formatMoneyDisplay(summary.totalIncome, currency)}
          </CardValue>
        </Card>
        <Card>
          <CardLabel>Expenses</CardLabel>
          <CardValue>
            {formatMoneyDisplay(summary.totalExpense, currency)}
          </CardValue>
        </Card>
        <Card>
          <CardLabel>Net</CardLabel>
          <CardValue className={signedMoneyColorClass(summary.net)}>
            {formatMoneyDisplay(summary.net, currency)}
          </CardValue>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Spending by category</h2>
        {summary.expenseByCategory.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No expenses recorded yet this month.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {summary.expenseByCategory
              .sort((a, b) => Number(b.total) - Number(a.total))
              .map((entry) => (
                <li
                  key={entry.categoryId}
                  className="flex items-center justify-between p-4"
                >
                  <span>
                    {categoryName.get(entry.categoryId) ?? "Uncategorized"}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatMoneyDisplay(entry.total, currency)}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
