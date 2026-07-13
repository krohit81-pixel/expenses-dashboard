import "server-only";

import { sumMoney, type Money } from "@/lib/money";
import { occurrencesUpTo } from "@/lib/dates/recurrence";
import { listRecurringTransactions } from "@/services/RecurringTransactionService";
import { listTransactions } from "@/services/TransactionService";

export interface SnapshotLine {
  id: string;
  name: string;
  amount: Money;
  currencyCode: string;
  /** True if this reflects a real logged transaction; false if it's the
   * template's default amount projected forward (no transaction exists
   * for this template in this month yet). */
  isActual: boolean;
}

export interface OneOffLine {
  id: string;
  payee: string | null;
  amount: Money;
  currencyCode: string;
  kind: "income" | "expense" | "transfer";
  transferAccountId: string | null;
}

export interface MonthlyBudgetSnapshot {
  /** "2026-08" */
  month: string;
  income: SnapshotLine[];
  fixedExpenses: SnapshotLine[];
  /** Card payments and other one-off items logged for this month —
   * anything not generated from a recurring template. This is the piece
   * that answers "what's my situation for August" beyond just the
   * standing recurring plan. */
  oneOff: OneOffLine[];
  incomeTotal: Money;
  fixedExpenseTotal: Money;
}

function monthBounds(month: string): { start: string; end: string } {
  const [year, monthNum] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(year, monthNum, 0)).toISOString().slice(0, 10);
  return { start, end };
}

/**
 * Whether a recurring template has any occurrence within [start, end],
 * regardless of the template's stored next_occurrence_on — walks from
 * the template's true starts_on, same math used for generation, just
 * read-only here. Safe at personal-recurring-template scale (a handful
 * of templates, each active at most a few years) — occurrencesUpTo has
 * its own internal safety cap regardless.
 */
function occursInMonth(
  startsOn: string,
  frequency: Parameters<typeof occurrencesUpTo>[1],
  intervalCount: number,
  endsOn: string | null,
  start: string,
  end: string,
): boolean {
  const occurrences = occurrencesUpTo(
    startsOn,
    frequency,
    intervalCount,
    startsOn,
    end,
    endsOn,
  );
  return occurrences.some((date) => date >= start && date <= end);
}

/**
 * Builds a snapshot for any month — past (history, since actual
 * transactions already exist by then if the app was used), present, or
 * future (a forward projection). Same query logic works for all three:
 * for a template that occurs in the target month, prefer an actual
 * transaction already generated from it if one exists, otherwise fall
 * back to the template's projected default amount.
 */
export async function getMonthlyBudgetSnapshot(
  month: string,
): Promise<MonthlyBudgetSnapshot> {
  const { start, end } = monthBounds(month);

  const templates = await listRecurringTransactions();
  const incomeExpenseTemplates = templates.filter((t) => t.kind !== "transfer");

  const income: SnapshotLine[] = [];
  const fixedExpenses: SnapshotLine[] = [];

  for (const template of incomeExpenseTemplates) {
    if (
      !occursInMonth(
        template.startsOn,
        template.frequency,
        template.intervalCount,
        template.endsOn,
        start,
        end,
      )
    ) {
      continue;
    }

    const { transactions: actualMatches } = await listTransactions({
      recurringTransactionId: template.id,
      occurredFrom: start,
      occurredTo: end,
      limit: 5,
    });
    const actual = actualMatches.find((t) => t.status !== "void");

    const line: SnapshotLine = actual
      ? {
          id: template.id,
          name: template.payee ?? "Untitled",
          amount: actual.amount,
          currencyCode: actual.currencyCode,
          isActual: true,
        }
      : {
          id: template.id,
          name: template.payee ?? "Untitled",
          amount: template.amount,
          currencyCode: template.currencyCode,
          isActual: false,
        };

    (template.kind === "income" ? income : fixedExpenses).push(line);
  }

  const { transactions: oneOffTransactions } = await listTransactions({
    oneOffOnly: true,
    occurredFrom: start,
    occurredTo: end,
    limit: 200,
  });

  const oneOff: OneOffLine[] = oneOffTransactions
    .filter((t) => t.status !== "void")
    .map((t) => ({
      id: t.id,
      payee: t.payee,
      amount: t.amount,
      currencyCode: t.currencyCode,
      kind: t.kind as "income" | "expense" | "transfer",
      transferAccountId: t.transferAccountId,
    }));

  const incomeTotal = sumMoney(income.map((line) => line.amount));
  const fixedExpenseTotal = sumMoney(fixedExpenses.map((line) => line.amount));

  return {
    month,
    income,
    fixedExpenses,
    oneOff,
    incomeTotal,
    fixedExpenseTotal,
  };
}
