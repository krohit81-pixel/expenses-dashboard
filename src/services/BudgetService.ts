import "server-only";

import {
  addMoney,
  dbNumberToMoney,
  moneyToDbNumber,
  ZERO,
  type Money,
} from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import {
  createBudgetInputSchema,
  setBudgetLineInputSchema,
  type CreateBudgetInput,
  type SetBudgetLineInput,
} from "@/features/budgets/schemas";

export type { CreateBudgetInput, SetBudgetLineInput };

export interface Budget {
  id: string;
  name: string;
  currencyCode: string;
  periodStart: string;
  periodEnd: string;
}

export interface BudgetLine {
  id: string;
  budgetId: string;
  categoryId: string;
  plannedAmount: Money;
  rolloverEnabled: boolean;
}

export interface BudgetLineWithActual extends BudgetLine {
  actualAmount: Money;
}

export async function listBudgets(): Promise<Budget[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budgets")
    .select("id, name, currency_code, period_start, period_end")
    .order("period_start", { ascending: false });

  if (error) {
    throw new Error(`Failed to load budgets: ${error.message}`);
  }

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    currencyCode: row.currency_code,
    periodStart: row.period_start,
    periodEnd: row.period_end,
  }));
}

export async function getBudget(budgetId: string): Promise<Budget | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budgets")
    .select("id, name, currency_code, period_start, period_end")
    .eq("id", budgetId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load budget: ${error.message}`);
  }

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    currencyCode: data.currency_code,
    periodStart: data.period_start,
    periodEnd: data.period_end,
  };
}

export async function createBudget(input: CreateBudgetInput): Promise<Budget> {
  const parsed = createBudgetInputSchema.parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("budgets")
    .insert({
      name: parsed.name,
      currency_code: parsed.currencyCode,
      period_start: parsed.periodStart,
      period_end: parsed.periodEnd,
    })
    .select("id, name, currency_code, period_start, period_end")
    .single();

  if (error) {
    throw new Error(`Failed to create budget: ${error.message}`);
  }

  return {
    id: data.id,
    name: data.name,
    currencyCode: data.currency_code,
    periodStart: data.period_start,
    periodEnd: data.period_end,
  };
}

/**
 * Creates or updates the planned amount for a category within a budget.
 * unique(budget_id, category_id) is a plain multi-column constraint (not
 * an expression index, unlike categories' uniqueness guard), so Supabase's
 * upsert onConflict can target it directly.
 */
export async function setBudgetLine(
  input: SetBudgetLineInput,
): Promise<BudgetLine> {
  const parsed = setBudgetLineInputSchema.parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("budget_lines")
    .upsert(
      {
        budget_id: parsed.budgetId,
        category_id: parsed.categoryId,
        planned_amount: moneyToDbNumber(parsed.plannedAmount),
        rollover_enabled: parsed.rolloverEnabled,
      },
      { onConflict: "budget_id,category_id" },
    )
    .select("id, budget_id, category_id, planned_amount, rollover_enabled")
    .single();

  if (error) {
    throw new Error(`Failed to save budget line: ${error.message}`);
  }

  return {
    id: data.id,
    budgetId: data.budget_id,
    categoryId: data.category_id,
    plannedAmount: dbNumberToMoney(data.planned_amount),
    rolloverEnabled: data.rollover_enabled,
  };
}

/**
 * Every budget line for `budgetId`, each with its actual spend for the
 * budget's period — summed from transaction_splits (income and expense
 * transactions both write splits, so this works for either kind of
 * category) rather than a SQL aggregate, for the same "no aggregate
 * RPC/view exists yet" reason noted throughout the other services.
 */
export async function getBudgetLinesWithActuals(
  budgetId: string,
): Promise<BudgetLineWithActual[]> {
  const budget = await getBudget(budgetId);
  if (!budget) {
    throw new Error("Budget not found");
  }

  const supabase = await createClient();

  const { data: lines, error: linesError } = await supabase
    .from("budget_lines")
    .select("id, budget_id, category_id, planned_amount, rollover_enabled")
    .eq("budget_id", budgetId);

  if (linesError) {
    throw new Error(`Failed to load budget lines: ${linesError.message}`);
  }

  if (lines.length === 0) {
    return [];
  }

  const categoryIds = lines.map((line) => line.category_id);

  const { data: splits, error: splitsError } = await supabase
    .from("transaction_splits")
    .select("category_id, amount, transactions!inner(occurred_on, status)")
    .in("category_id", categoryIds)
    .eq("transactions.status", "posted")
    .gte("transactions.occurred_on", budget.periodStart)
    .lte("transactions.occurred_on", budget.periodEnd);

  if (splitsError) {
    throw new Error(`Failed to load budget actuals: ${splitsError.message}`);
  }

  const actualByCategory = new Map<string, Money>();
  for (const split of splits) {
    const amount = dbNumberToMoney(split.amount);
    actualByCategory.set(
      split.category_id,
      addMoney(actualByCategory.get(split.category_id) ?? ZERO, amount),
    );
  }

  return lines.map((line) => ({
    id: line.id,
    budgetId: line.budget_id,
    categoryId: line.category_id,
    plannedAmount: dbNumberToMoney(line.planned_amount),
    rolloverEnabled: line.rollover_enabled,
    actualAmount: actualByCategory.get(line.category_id) ?? ZERO,
  }));
}
