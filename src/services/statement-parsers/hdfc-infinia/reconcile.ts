import { parseMoney, subtractMoney, sumMoney, type Money } from "@/lib/money";

import type { HdfcStatementHeader, HdfcTransaction } from "./types";

/**
 * Absolute-value tolerance for every comparison below, in rupees. Not
 * zero: the one real statement this was built against has a genuine
 * 0.09 rounding gap in HDFC's OWN printed totals (previousStatementDue
 * - paymentsReceived + purchasesDebit + financeCharges lands at
 * 1,51,387.91 against a printed total of 1,51,388.00) -- a statement
 * quirk, not a parsing bug. A tolerance this small still catches any
 * real reconciliation failure (a missed or double-counted row moves the
 * delta by whole rupees, not paise) while not raising false alarms on
 * HDFC's own printed rounding.
 */
const TOLERANCE = 0.1;

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

export class HdfcReconciliationError extends Error {
  constructor(public readonly result: ReconciliationResult) {
    const failed = result.checks.filter((c) => !c.withinTolerance);
    const detail = failed
      .map(
        (c) =>
          `${c.label}: statement says ${c.statementValue}, transactions sum to ${c.computedValue} (delta ${c.delta})`,
      )
      .join("; ");
    super(`Statement did not reconcile: ${detail}`);
    this.name = "HdfcReconciliationError";
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
    withinTolerance: parseMoney(delta).lessThanOrEqualTo(TOLERANCE),
  };
}

/**
 * Verifies that the parsed transactions actually add up to what the
 * statement header itself claims, per Step 10 of the spec: total debits
 * + credits + payments should equal the statement's own totals. This is
 * the automated gate between parsing and persisting -- Atlas saves a
 * statement automatically once parsed (no manual review step), so this
 * check is what stands in for a human eyeballing the numbers before
 * anything is written to the database.
 *
 * Three checks, each independently useful for narrowing down what went
 * wrong if one fails:
 *   1. Sum of debit transactions vs. the header's PURCHASE/DEBITS figure.
 *   2. Sum of credit transactions vs. the header's PAYMENTS RECEIVED figure
 *      (this bucket includes card payments, cashback, and refunds, not
 *      just literal "CREDIT CARD PAYMENT" rows -- see classify-transaction.ts).
 *   3. The full statement identity: previous dues - payments + purchases
 *      + finance charges = total amount due, using the HEADER's own
 *      figures (not the computed sums) -- this one catches a header
 *      *parsing* mistake independently of whether the transaction table
 *      parsed correctly, since it never touches the transactions array.
 */
export function reconcileHdfcStatement(
  header: HdfcStatementHeader,
  transactions: HdfcTransaction[],
): ReconciliationResult {
  const debitSum = sumMoney(
    transactions
      .filter((t) => t.transactionType === "debit")
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
    check("purchases/debits", header.purchasesDebit, debitSum),
    check("payments received", header.paymentsReceived, creditSum),
    check("total amount due", header.totalAmountDue, statementIdentityTotal),
  ];

  return { ok: checks.every((c) => c.withinTolerance), checks };
}

/** Throws HdfcReconciliationError if the statement doesn't reconcile. */
export function assertHdfcStatementReconciles(
  header: HdfcStatementHeader,
  transactions: HdfcTransaction[],
): void {
  const result = reconcileHdfcStatement(header, transactions);
  if (!result.ok) throw new HdfcReconciliationError(result);
}
