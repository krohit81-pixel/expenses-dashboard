import { z } from "zod";

import { Decimal } from "./decimal";

/**
 * A monetary value as a fixed, 2-decimal-place decimal string, e.g. "12.50"
 * or "-3.00". This is the ONLY representation money should take once it
 * leaves a database row — never pass a raw `number` into arithmetic, a
 * form default, or an API response body. See docs/03 and docs/08.
 *
 * Two decimal places matches the `numeric(18,2)` column type used for every
 * money column in the finance schema. Investment quantity/price fields use
 * a different precision (numeric(24,8)) and are out of scope for this
 * module until Milestone 4 (investments).
 */
export type Money = string & { readonly __brand: "Money" };

const MONEY_PATTERN = /^-?\d+\.\d{2}$/;

export function isMoney(value: string): value is Money {
  return MONEY_PATTERN.test(value);
}

/**
 * What a human might reasonably type into an amount field: a plain
 * integer ("202000"), one or two decimal places ("202000.5",
 * "202000.50"), optionally with thousands separators or surrounding
 * whitespace ("2,02,000.00 "). Deliberately more permissive than
 * MONEY_PATTERN — this is the pattern for RAW INPUT, not the invariant
 * for a value already in canonical Money form.
 */
const LENIENT_INPUT_PATTERN =
  /^-?\d{1,3}(,\d{2,3})*(\.\d{1,2})?$|^-?\d+(\.\d{1,2})?$/;

function normalizeAmountInput(raw: string): string {
  return raw.replace(/,/g, "").trim();
}

/**
 * Zod schema for a money amount typed by a human into a form. Accepts
 * common shapes (missing decimals, one decimal place, thousands
 * separators) and always transforms to the canonical 2-decimal Money
 * string — the same guarantee zMoney always made, just without forcing
 * the person to type ".00" themselves. This is what every form's amount
 * field should use; reach for the stricter zMoney only when re-validating
 * a value that's already supposed to be in canonical form (e.g. a
 * round-trip from the database), not when validating what someone typed.
 */
export const zMoney = z
  .string()
  .transform((value) => normalizeAmountInput(value))
  .pipe(
    z
      .string()
      .regex(
        LENIENT_INPUT_PATTERN,
        "Must be a valid amount, e.g. 1200 or 1200.50",
      )
      .transform((value) => new Decimal(value).toFixed(2) as Money),
  );

/** Zod schema for a Money string that must be strictly positive (matches `amount > 0` DB checks). */
export const zPositiveMoney = zMoney.refine(
  (value) => new Decimal(value).greaterThan(0),
  {
    message: "Amount must be greater than zero",
  },
);

/** Zod schema for a Money string that must be zero or positive. */
export const zNonNegativeMoney = zMoney.refine(
  (value) => new Decimal(value).greaterThanOrEqualTo(0),
  { message: "Amount cannot be negative" },
);

function toMoney(value: Decimal): Money {
  return value.toFixed(2) as Money;
}

/** Parses a Money string into a Decimal for arithmetic. Throws if malformed — validate with zMoney first at input boundaries. */
export function parseMoney(value: Money): Decimal {
  return new Decimal(value);
}

export const ZERO: Money = "0.00" as Money;

export function addMoney(a: Money, b: Money): Money {
  return toMoney(parseMoney(a).plus(parseMoney(b)));
}

export function subtractMoney(a: Money, b: Money): Money {
  return toMoney(parseMoney(a).minus(parseMoney(b)));
}

export function negateMoney(a: Money): Money {
  return toMoney(parseMoney(a).negated());
}

export function sumMoney(values: Money[]): Money {
  return values.reduce((total, value) => addMoney(total, value), ZERO);
}

export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  return parseMoney(a).comparedTo(parseMoney(b)) as -1 | 0 | 1;
}

export function isZeroMoney(value: Money): boolean {
  return parseMoney(value).isZero();
}

export function isPositiveMoney(value: Money): boolean {
  return parseMoney(value).greaterThan(0);
}

export function isNegativeMoney(value: Money): boolean {
  return parseMoney(value).lessThan(0);
}

/**
 * Converts a raw Postgres `numeric` value as returned by the generated
 * Database types (typed `number`) into a Money string. This is the ONE
 * place a `number` from a DB row should turn into a Money — do this at
 * the service boundary, immediately after reading the row, never deeper
 * in application logic.
 */
export function dbNumberToMoney(value: number): Money {
  return toMoney(new Decimal(value));
}

/**
 * Converts a Money string into the raw `number` shape the generated
 * Database types expect for an Insert/Update payload. This is the ONE
 * place a Money should turn back into a `number`, immediately before
 * handing a payload to a Supabase client call.
 */
export function moneyToDbNumber(value: Money): number {
  return parseMoney(value).toNumber();
}

/**
 * Tailwind text color class for a signed amount: green if positive, red if
 * negative, undefined (inherit) if exactly zero. Use this everywhere an
 * amount's sign drives its color — don't reimplement with isPositiveMoney
 * alone, which misclassifies zero as "not positive" and would render it
 * the same as negative.
 */
export function signedMoneyColorClass(value: Money): string | undefined {
  if (isPositiveMoney(value)) return "text-emerald-600";
  if (isNegativeMoney(value)) return "text-destructive";
  return undefined;
}

/**
 * Formats a Money string for display using Intl.NumberFormat. This is the
 * only place currency symbols/locale formatting should be decided — do not
 * concatenate currency symbols manually elsewhere in the UI.
 */
export function formatMoneyDisplay(
  value: Money,
  currencyCode: string,
  locale: string = "en-US",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    currencyDisplay: "symbol",
  }).format(parseMoney(value).toNumber());
}
