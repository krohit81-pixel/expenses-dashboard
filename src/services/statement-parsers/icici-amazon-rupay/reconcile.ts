import { parseMoney, subtractMoney, sumMoney, type Money } from "@/lib/money";

import { isCashAdvance } from "./classify-transaction";
import type { IciciStatementHeader, IciciTransaction } from "./types";

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

export class IciciReconciliationError extends Error {
  constructor(public readonly result: ReconciliationResult) {
    const failed = result.checks.filter((c) => !c.withinTolerance);
    const detail = failed
      .map(
        (c) =>
          `${c.label}: statement says ${c.statementValue}, transactions sum to ${c.computedValue} (delta ${c.delta})`,
      )
      .join("; ");
    super(`Statement did not reconcile: ${detail}`);
    this.name = "IciciReconciliationError";
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
 * header.purchasesDebit holds "Purchases / Charges" and header.
 * financeCharges holds "Cash Advances" for this issuer (see types.ts) --
 * debit transactions are split between the two using isCashAdvance,
 * mirroring how axis-horizon's reconcile.ts splits its own debit rows
 * with isBankFeeOrTax. The overall identity check (verified against two
 * real statements -- an Amazon Pay card and a RuPay-variant card spent
 * almost entirely via UPI) is: previousBalance + purchasesCharges +
 * cashAdvances - paymentsCredits = totalAmountDue.
 */
export function reconcileIciciStatement(
  header: IciciStatementHeader,
  transactions: IciciTransaction[],
): ReconciliationResult {
  const debitTransactions = transactions.filter(
    (t) => t.transactionType === "debit",
  );
  const purchaseDebitSum = sumMoney(
    debitTransactions
      .filter((t) => !isCashAdvance(t.description))
      .map((t) => t.amount),
  );
  const cashAdvanceDebitSum = sumMoney(
    debitTransactions
      .filter((t) => isCashAdvance(t.description))
      .map((t) => t.amount),
  );
  const creditSum = sumMoney(
    transactions
      .filter((t) => t.transactionType === "credit")
      .map((t) => t.amount),
  );

  const statementIdentityTotal = (() => {
    const afterPrevious = parseMoney(header.previousStatementDue);
    const afterPurchases = afterPrevious.plus(
      parseMoney(header.purchasesDebit),
    );
    const afterCashAdvances = afterPurchases.plus(
      parseMoney(header.financeCharges),
    );
    const afterPayments = afterCashAdvances.minus(
      parseMoney(header.paymentsReceived),
    );
    return afterPayments.toFixed(2) as Money;
  })();

  const checks = [
    check("purchases/charges", header.purchasesDebit, purchaseDebitSum),
    check("cash advances", header.financeCharges, cashAdvanceDebitSum),
    check("payments/credits", header.paymentsReceived, creditSum),
    check("total amount due", header.totalAmountDue, statementIdentityTotal),
  ];

  return { ok: checks.every((c) => c.withinTolerance), checks };
}

export function assertIciciStatementReconciles(
  header: IciciStatementHeader,
  transactions: IciciTransaction[],
): void {
  const result = reconcileIciciStatement(header, transactions);
  if (!result.ok) throw new IciciReconciliationError(result);
}
