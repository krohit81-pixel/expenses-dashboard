import { parseMoney, subtractMoney, sumMoney, type Money } from "@/lib/money";

import { isBankFeeOrTax } from "./classify-transaction";
import type { AxisStatementHeader, AxisTransaction } from "./types";

const ABSOLUTE_FLOOR = 1.0;
const RELATIVE_RATE = 0.0005;

function toleranceFor(statementValue: Money): number {
  const relative = Math.abs(Number(statementValue)) * RELATIVE_RATE;
  return Math.max(ABSOLUTE_FLOOR, relative);
}

export interface ReconciliationCheck {
  label: string;
  statementValue: Money;
  computedValue: Money;
  delta: Money;
  withinTolerance: boolean;
}

export interface ReconciliationResult {
  ok: boolean;
  checks: ReconciliationCheck[];
}

export class AxisReconciliationError extends Error {
  constructor(public readonly result: ReconciliationResult) {
    const failed = result.checks.filter((c) => !c.withinTolerance);
    const detail = failed
      .map(
        (c) =>
          `${c.label}: statement says ${c.statementValue}, transactions sum to ${c.computedValue} (delta ${c.delta})`,
      )
      .join("; ");
    super(`Statement did not reconcile: ${detail}`);
    this.name = "AxisReconciliationError";
  }
}

function absDelta(a: Money, b: Money): Money {
  const diff = parseMoney(subtractMoney(a, b));
  return (diff.isNegative() ? diff.negated() : diff).toFixed(2) as Money;
}

function check(
  label: string,
  statementValue: Money,
  computedValue: Money,
): ReconciliationCheck {
  const delta = absDelta(statementValue, computedValue);
  return {
    label,
    statementValue,
    computedValue,
    delta,
    withinTolerance: parseMoney(delta).lessThanOrEqualTo(
      toleranceFor(statementValue),
    ),
  };
}

export function reconcileAxisStatement(
  header: AxisStatementHeader,
  transactions: AxisTransaction[],
): ReconciliationResult {
  const debitTransactions = transactions.filter(
    (t) => t.transactionType === "debit",
  );
  // v1.7.3: Axis's own PAYMENT SUMMARY block keeps "purchases" and
  // "other debit charges" (annual fee, GST on that fee, forex
  // transaction fee, etc. -- folded into header.financeCharges by
  // parse-header.ts) as two separate totals. A real June statement
  // exposed this: summing ALL debit rows (including those fee/tax
  // lines) against header.purchasesDebit alone left a delta that was
  // exactly header.financeCharges -- an apples-to-oranges comparison,
  // not a parsing error. isBankFeeOrTax is the same classifier
  // parse-transactions.ts already uses to keep these lines out of the
  // Merchant Dictionary, so reusing it here keeps both places agreeing
  // on which rows are "a real purchase" vs. "a fee/tax charge."
  const purchaseDebitSum = sumMoney(
    debitTransactions
      .filter((t) => !isBankFeeOrTax(t.description))
      .map((t) => t.amount),
  );
  const feeDebitSum = sumMoney(
    debitTransactions
      .filter((t) => isBankFeeOrTax(t.description))
      .map((t) => t.amount),
  );
  const creditSum = sumMoney(
    transactions
      .filter((t) => t.transactionType === "credit")
      .map((t) => t.amount),
  );

  const statementIdentityTotal = (() => {
    const afterPayments = subtractMoney(
      header.previousStatementDue,
      header.paymentsReceived,
    );
    const afterPurchases = parseMoney(afterPayments).plus(
      parseMoney(header.purchasesDebit),
    );
    const afterFinanceCharges = afterPurchases.plus(
      parseMoney(header.financeCharges),
    );
    return afterFinanceCharges.toFixed(2) as Money;
  })();

  const checks = [
    check("purchases/debits", header.purchasesDebit, purchaseDebitSum),
    check("finance charges", header.financeCharges, feeDebitSum),
    check("payments received", header.paymentsReceived, creditSum),
    check("total amount due", header.totalAmountDue, statementIdentityTotal),
  ];

  return { ok: checks.every((c) => c.withinTolerance), checks };
}

export function assertAxisStatementReconciles(
  header: AxisStatementHeader,
  transactions: AxisTransaction[],
): void {
  const result = reconcileAxisStatement(header, transactions);
  if (!result.ok) throw new AxisReconciliationError(result);
}
