import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getBudget, getBudgetLinesWithActuals } from "@/services/BudgetService";
import { listCategories } from "@/services/CategoryService";
import { requireUser } from "@/lib/auth/require-user";
import { compareMoney, formatMoneyDisplay } from "@/lib/money";
import { SetBudgetLineForm } from "@/features/budgets/components/SetBudgetLineForm";

export const metadata: Metadata = {
  title: "Budget",
};

export default async function BudgetDetailPage({
  params,
}: {
  params: Promise<{ budgetId: string }>;
}) {
  await requireUser();
  const { budgetId } = await params;

  const budget = await getBudget(budgetId);
  if (!budget) {
    notFound();
  }

  const [lines, categories] = await Promise.all([
    getBudgetLinesWithActuals(budgetId),
    listCategories(),
  ]);

  const categoryName = new Map(
    categories.map((category) => [category.id, category.name]),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">{budget.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {budget.periodStart} to {budget.periodEnd}
        </p>
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No categories budgeted yet — add one below.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {lines.map((line) => {
            const overBudget =
              compareMoney(line.actualAmount, line.plannedAmount) > 0;
            return (
              <li
                key={line.id}
                className="flex items-center justify-between p-4"
              >
                <span>
                  {categoryName.get(line.categoryId) ?? "Uncategorized"}
                </span>
                <span className="font-medium tabular-nums">
                  <span className={overBudget ? "text-destructive" : undefined}>
                    {formatMoneyDisplay(line.actualAmount, budget.currencyCode)}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    /{" "}
                    {formatMoneyDisplay(
                      line.plannedAmount,
                      budget.currencyCode,
                    )}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <section className="space-y-4 border-t pt-6">
        <h2 className="text-sm font-medium">Add or update a category</h2>
        <SetBudgetLineForm budgetId={budgetId} categories={categories} />
      </section>
    </div>
  );
}
