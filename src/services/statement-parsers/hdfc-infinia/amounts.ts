import { zMoney, type Money } from "@/lib/money";

/**
 * Finds the first Indian-grouped decimal amount (e.g. "1,51,388.00") in a
 * string, ignoring whatever currency-symbol noise surrounds it. Written
 * this way rather than stripping a fixed set of symbols first because the
 * symbol itself is unreliable: this statement's embedded font maps the ₹
 * glyph to a literal "C" in its text layer (see extract-text.ts's note on
 * pdftotext showing the same thing) -- a differently-exported statement
 * might render it as an actual ₹, "Rs.", "INR", or nothing at all. Only
 * the digits are load-bearing.
 */
const AMOUNT_TOKEN = /(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)/;

export function findAmount(text: string): Money | null {
  const match = text.match(AMOUNT_TOKEN);
  if (!match) return null;
  const result = zMoney.safeParse(match[1]);
  return result.success ? result.data : null;
}

/** All amount-shaped tokens in a string, in reading order. */
export function findAllAmounts(text: string): Money[] {
  const matches = text.match(new RegExp(AMOUNT_TOKEN, "g")) ?? [];
  return matches
    .map((m) => zMoney.safeParse(m))
    .filter((r): r is { success: true; data: Money } => r.success)
    .map((r) => r.data);
}

/** A plain (non-decimal) Indian-grouped integer, e.g. "1,09,391" or "0". */
const INTEGER_TOKEN = /(\d{1,3}(?:,\d{2,3})*)/;

export function findInteger(text: string): number | null {
  const match = text.match(INTEGER_TOKEN);
  if (!match) return null;
  const n = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}
