import Link from "next/link";
import type { Metadata } from "next";

import { listBudgets } from "@/services/BudgetService";
import { getUserSettings } from "@/services/UserSettingsService";
import { requireUser } from "@/lib/auth/require-user";
import { CreateBudgetForm } from "@/features/budgets/components/CreateBudgetForm";

export const metadata: Metadata = {
  title: "Budgets",
};

export default async function BudgetsPage() {
  const user = await requireUser();
  const [budgets, settings] = await Promise.all([
    listBudgets(),
    getUserSettings(user.id),
  ]);
  const defaultCurrency = settings?.baseCurrency ?? "USD";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Budgets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {budgets.length === 0
            ? "No budgets yet."
            : `${budgets.length} budget period${budgets.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {budgets.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {budgets.map((budget) => (
            <li key={budget.id}>
              <Link
                href={`/budgets/${budget.id}`}
                className="flex items-center justify-between p-4 hover:bg-accent"
              >
                <span className="font-medium">{budget.name}</span>
                <span className="text-sm text-muted-foreground">
                  {budget.periodStart} to {budget.periodEnd}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-4 border-t pt-6">
        <h2 className="text-sm font-medium">Create a budget</h2>
        <CreateBudgetForm defaultCurrency={defaultCurrency} />
      </section>
    </div>
  );
}
