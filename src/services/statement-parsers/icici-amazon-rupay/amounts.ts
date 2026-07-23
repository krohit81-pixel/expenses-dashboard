import { zMoney, type Money } from "@/lib/money";

// Same Indian digit-grouping shape as HDFC/Axis (e.g. "38,50,000.00",
// "7,35,757.25") -- the leading currency glyph pdf.js's extracted text
// renders for ICICI's "₹" (a stray backtick, "`1,12,465.38") is left for
// callers to ignore, same as HDFC's own "C" glyph noise -- this pattern
// only ever looks at the digit run itself.
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
