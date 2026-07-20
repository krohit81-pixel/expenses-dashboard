import { shiftMonth } from "@/lib/dates/month";

/**
 * Which cash-flow cycle a credit card statement belongs to -- v1.6.1,
 * at the household's request. HDFC generates a statement a few weeks
 * before its due date, and the household pays it out of the
 * FOLLOWING month's income, not the month the statement happens to be
 * dated in: a statement dated 17 Jun is paid using July's income, so
 * it's tagged to cycle "2026-07", not "2026-06" (and a statement dated
 * 17 Jul belongs to "2026-08", and so on). Only the statement's own
 * month matters here, not the day it was generated on -- every HDFC
 * Infinia statement so far has generated mid-month, so "next calendar
 * month" is the correct cycle regardless of the exact day.
 *
 * Mirrors finance.transactions.cycle_month (see the v0.5.0 migration)
 * applied to statements instead of individual ledger rows -- see
 * CreditCardStatementService.saveHdfcInfiniaStatement for where this
 * gets computed and stored (credit_card_statements.cycle_month), and
 * CreditCardIntelService for how every card-related Intel aggregate
 * groups by it instead of individual transaction dates.
 */
export function cycleMonthForStatementDate(statementDate: string): string {
  const statementMonth = statementDate.slice(0, 7);
  return shiftMonth(statementMonth, 1);
}
