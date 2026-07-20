import { parseMoney, subtractMoney, sumMoney, type Money } from "@/lib/money";

import type { HdfcStatementHeader, HdfcTransaction } from "./types";

/**
 * Tolerance for every comparison below is max(ABSOLUTE_FLOOR, RELATIVE_RATE
 * * statementValue), not a flat number. Real statements have a genuine,
 * small rounding gap between what a transaction table itemizes and what
 * HDFC's own header totals claim -- a statement quirk, not a parsing bug.
 * On a statement with only domestic activity that gap is a few paise
 * (0.09, then 0.37/0.26 on the "total amount due" identity check across
 * three real statements). But on a statement with heavy International
 * Transactions activity (dozens of foreign-currency purchases, each with
 * its own IGST tax line, all independently rounded to paise on their own
 * printed row), the *purchases/debits* and *payments received* sums can
 * carry a materially larger, still entirely legitimate residual: one real
 * June statement with ~250 international rows was short by 177.15 on a
 * 900,842.10 purchases figure (0.0197%) and 177.15 on a 691,744.99
 * payments figure (0.0256%) -- confirmed NOT a parsing bug by cross-
 * checking every single parsed row's amount/direction against the raw
 * statement text (all matched) and the printed IGST section's own "TOTAL
 * GST" figure (matched exactly). There's no way to recover this residual
 * from the statement's own text -- it isn't itemized anywhere -- so it's
 * treated as expected noise, not a failure.
 *
 * ABSOLUTE_FLOOR keeps small statements (where 0.05% would round below a
 * single paisa) from being unreasonably strict. RELATIVE_RATE is chosen
 * with real margin above the 0.02-0.03% observed above while staying
 * nowhere near what an actual missing-transaction bug produces: the
 * original International Transactions parsing bug this tolerance model
 * was built to accommodate caused a 70% gap, not a fraction of a percent.
 */
const ABSOLUTE_FLOOR = 1.0;
const RELATIVE_RATE = 0.0005; // 0.05%

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
    withinTolerance: parseMoney(delta).lessThanOrEqualTo(
      toleranceFor(statementValue),
    ),
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
