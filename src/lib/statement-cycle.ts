import { shiftMonth } from "@/lib/dates/month";

/**
 * Which cash-flow cycle a credit card statement belongs to -- v1.6.1,
 * at the household's request. A statement generated mid-month is
 * always tagged to the FOLLOWING calendar month's cycle, regardless of
 * issuer or the statement's own printed due date: "when I upload the 6
 * statements around mid of the month, generation date + 1 month should
 * be used for tagging to the cycle month" (v3.8.1's own explicit
 * confirmation, after checking real data). Only the statement's own
 * month matters, not the exact day -- every real statement across all
 * three issuers has generated in the 12th-18th window so far, so "next
 * calendar month" is correct regardless of exactly where in that
 * window a given statement lands.
 *
 * v3.8.1 -- looked like a bug, confirmed NOT one: ICICI's real due date
 * lands only ~18 days after generation (HDFC/Axis take ~20-21), just
 * short enough to stay inside the SAME calendar month instead of
 * spilling into the next one (e.g. a statement generated 12 Sep, due
 * 30 Sep -- still September, not October). That looked like the
 * generation-month-plus-one rule mistagging ICICI a cycle too late
 * relative to its own printed due date. It isn't: checked directly
 * with the household, who confirmed the rule is deliberately
 * due-date-independent -- EVERY mid-month statement, ICICI included,
 * is meant to land in the following month's cycle regardless of what
 * its own due date says. Verified against all 20 real statements ever
 * imported at the time: generation-month+1 matches HDFC/Axis's own due
 * dates 14/14 times (their due date already happens to fall in the
 * following month too) and was the intentionally correct answer for
 * ICICI's 6/6 statements despite each one's own due date technically
 * falling a month earlier. A `cycleMonthForDueDate` variant (read the
 * cycle straight off the due date) was tried and reverted in this same
 * version -- don't reintroduce it without re-confirming this
 * conversation's conclusion first.
 *
 * Mirrors finance.transactions.cycle_month (see the v0.5.0 migration)
 * applied to statements instead of individual ledger rows -- see
 * CreditCardStatementService.saveHdfcStatement (and its Axis/ICICI
 * counterparts) for where this gets computed and stored
 * (credit_card_statements.cycle_month), and CreditCardIntelService for
 * how every card-related Intel/Cards aggregate groups by it instead of
 * individual transaction dates.
 */
export function cycleMonthForStatementDate(statementDate: string): string {
  const statementMonth = statementDate.slice(0, 7);
  return shiftMonth(statementMonth, 1);
}
