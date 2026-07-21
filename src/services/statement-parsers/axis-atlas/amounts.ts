import { zMoney, type Money } from "@/lib/money";

/**
 * Unlike HDFC (which always prints thousands-grouped figures, e.g.
 * "1,51,388.00"), a real Axis Atlas/HORIZON statement prints at least
 * one figure with NO thousands separator at all -- the eDGE Miles
 * points balance ("26276", not "26,276"). The original HDFC-derived
 * pattern (`\d{1,3}(?:,\d{2,3})*`) silently truncated an ungrouped
 * multi-digit number at the first 3 digits (matching just "262" out of
 * "26276"), since `(?:,\d{2,3})*` allows zero repetitions and a bare
 * digit run has no comma to require more. The alternation below tries
 * the comma-grouped shape first (still required to have at least one
 * comma group, so it won't mis-split an ungrouped number early) and
 * falls back to a plain digit run.
 */
const AMOUNT_TOKEN = /(\d{1,3}(?:,\d{2,3})+(?:\.\d{2})?|\d+(?:\.\d{2})?)/;

export function findAmount(text: string): Money | null {
  const match = text.match(AMOUNT_TOKEN);
  if (!match) return null;
  const result = zMoney.safeParse(match[1]);
  return result.success ? result.data : null;
}

const DECIMAL_AMOUNT_TOKEN = /(\d{1,3}(?:,\d{2,3})+\.\d{2}|\d+\.\d{2})/;

export function findDecimalAmount(text: string): Money | null {
  const match = text.match(DECIMAL_AMOUNT_TOKEN);
  if (!match) return null;
  const result = zMoney.safeParse(match[1]);
  return result.success ? result.data : null;
}

export function findAllAmounts(text: string): Money[] {
  const matches = text.match(new RegExp(AMOUNT_TOKEN, "g")) ?? [];
  return matches
    .map((m) => zMoney.safeParse(m))
    .filter((r): r is { success: true; data: Money } => r.success)
    .map((r) => r.data);
}

const INTEGER_TOKEN = /(\d{1,3}(?:,\d{2,3})+|\d+)/;

export function findInteger(text: string): number | null {
  const match = text.match(INTEGER_TOKEN);
  if (!match) return null;
  const n = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}
